#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stochasticAlgorithms = new Set([
  'hybrid_pipeline',
  'simulated_annealing',
  'tabu_search',
]);

const profileDefinitions = {
  smoke: {
    description: 'Sanidade rápida com budgets curtos, repetição e seed alternativa.',
    deterministicSeed: 123,
    alternativeSeeds: [999],
    greedyBudgets: [5, 20],
    hybridBudgets: [5, 20],
    saBudgets: [5, 20],
    tabuBudgets: [10],
    jointBudgets: [15],
    repeatBudget: 20,
    repeatCount: 2,
    multilineHybridBudgets: [15, 20],
  },
  ci: {
    description:
      'Perfil padrão da CI com matriz suficiente para gerar centenas de validações derivadas.',
    deterministicSeed: 123,
    alternativeSeeds: [999, 2026],
    greedyBudgets: [5, 10, 15],
    hybridBudgets: [5, 10, 15],
    saBudgets: [5, 10, 15],
    tabuBudgets: [5, 10],
    jointBudgets: [5, 10],
    repeatBudget: 15,
    repeatCount: 3,
    multilineHybridBudgets: [10, 15],
  },
  extended: {
    description:
      'Perfil estendido para investigação local com budgets maiores e mais seeds alternativas.',
    deterministicSeed: 123,
    alternativeSeeds: [999, 2026, 4242],
    greedyBudgets: [5, 8, 12, 20],
    hybridBudgets: [5, 8, 12, 20],
    saBudgets: [5, 8, 12, 20],
    tabuBudgets: [5, 10, 15],
    jointBudgets: [5, 10, 15],
    repeatBudget: 20,
    repeatCount: 3,
    multilineHybridBudgets: [12, 20],
  },
};

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile' && argv[index + 1]) {
      parsed.profile = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--output-dir' && argv[index + 1]) {
      parsed.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return parsed;
}

const cliArgs = parseArgs(process.argv.slice(2));

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

const apiBaseUrl =
  process.env.OTIMIZ_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  readEnvValue(path.join(rootDir, 'frontend/.env.local'), 'NEXT_PUBLIC_API_URL') ||
  `http://127.0.0.1:${readEnvValue(path.join(rootDir, 'backend/.env'), 'PORT') || '3006'}/api/v1`;

const loginEmail = process.env.OTIMIZ_LOGIN_EMAIL || 'admin@otimiz.com';
const loginPassword = process.env.OTIMIZ_LOGIN_PASSWORD || '123456';
const pollIntervalMs = Number(process.env.OTIMIZ_POLL_INTERVAL_MS || 1000);
const pollTimeoutMs = Number(process.env.OTIMIZ_POLL_TIMEOUT_MS || 120000);
const costEpsilon = Number(process.env.OTIMIZ_COST_EPSILON || 0.01);
const failOnWarning = process.env.OTIMIZ_BATTERY_FAIL_ON_WARNING === 'true';
const profileName =
  cliArgs.profile || process.env.OTIMIZ_BATTERY_PROFILE || 'ci';
const outputDir = path.resolve(
  rootDir,
  cliArgs.outputDir ||
    process.env.OTIMIZ_BATTERY_OUTPUT_DIR ||
    path.join('artifacts', 'optimization-battery', profileName),
);

if (!profileDefinitions[profileName]) {
  throw new Error(
    `Perfil de bateria desconhecido: ${profileName}. Perfis suportados: ${Object.keys(profileDefinitions).join(', ')}`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value) {
  const parsed = toNumber(value);
  return parsed == null ? null : Number(parsed.toFixed(2));
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '--';
}

function formatBudget(value) {
  return Number.isFinite(Number(value)) ? `${Number(value)}s` : '--';
}

function formatCurrency(value) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '--';
}

function formatPercent(value) {
  return Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : '--';
}

function summarizeScope(lineIds) {
  if (lineIds.length === 1) return 'single';
  if (lineIds.length === 2) return 'multi2';
  if (lineIds.length === 3) return 'multi3';
  return `multi${lineIds.length}`;
}

function stableSignature(result) {
  return [
    result.status,
    formatNumber(result.totalCost),
    result.totalVehicles,
    result.totalCrew,
    result.totalTrips,
    result.cctViolations ?? 0,
  ].join('|');
}

function sameOutcome(left, right) {
  return stableSignature(left) === stableSignature(right);
}

function compareCosts(lowCost, highCost) {
  const low = toNumber(lowCost);
  const high = toNumber(highCost);

  if (low == null || high == null) return 'unknown';
  if (Math.abs(high - low) <= costEpsilon) return 'same';
  return high < low ? 'better' : 'worse';
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  return null;
}

function costDelta(lowCost, highCost) {
  const low = toNumber(lowCost);
  const high = toNumber(highCost);

  if (low == null || high == null) return null;
  return round2(high - low);
}

function percentDelta(baseValue, newValue) {
  const base = toNumber(baseValue);
  const next = toNumber(newValue);

  if (base == null || next == null || Math.abs(base) <= costEpsilon) return null;
  return round2(((next - base) / base) * 100);
}

function createValidation(validations, level, category, subject, message, details = null) {
  validations.push({
    id: validations.length + 1,
    level,
    category,
    subject,
    message,
    details,
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const detail = typeof json === 'string' ? json : JSON.stringify(json);
    throw new Error(`HTTP ${response.status} ${response.statusText} :: ${detail}`);
  }

  return json;
}

function headers(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function pickReproducibility(run) {
  return run?.resultSummary?.reproducibility || run?.resultSummary?.meta?.reproducibility || null;
}

function pickPerformance(run) {
  return run?.resultSummary?.performance || run?.resultSummary?.meta?.performance || null;
}

function pickHardIssues(run) {
  return extractArray(
    run?.resultSummary?.meta?.hard_constraint_report?.output?.hard_issues,
  ).length;
}

function pickWarnings(run) {
  return extractArray(run?.resultSummary?.warnings).length;
}

function costValue(run) {
  return round2(
    run?.totalCost ?? run?.resultSummary?.total_cost ?? run?.resultSummary?.totalCost ?? NaN,
  );
}

async function login() {
  const payload = { email: loginEmail, password: loginPassword };
  const response = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.accessToken;
}

async function getLines(token) {
  const payload = await fetchJson(`${apiBaseUrl}/lines`, { headers: headers(token) });
  return extractArray(payload);
}

async function getTrips(token, lineId) {
  const payload = await fetchJson(`${apiBaseUrl}/trips?lineId=${lineId}`, {
    headers: headers(token),
  });
  return extractArray(payload);
}

async function createRun(token, payload) {
  return fetchJson(`${apiBaseUrl}/optimization/run`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
}

async function getRun(token, runId) {
  return fetchJson(`${apiBaseUrl}/optimization/${runId}`, { headers: headers(token) });
}

async function waitForCompletion(token, runId) {
  const deadline = Date.now() + pollTimeoutMs;
  let lastRun = null;

  while (Date.now() < deadline) {
    lastRun = await getRun(token, runId);
    if (['completed', 'failed', 'cancelled'].includes(lastRun.status)) {
      return lastRun;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timeout aguardando run ${runId}. Ultimo status: ${lastRun?.status ?? 'desconhecido'}`,
  );
}

async function discoverScenarioLines(token) {
  const preferred = [16, 38, 39];
  const available = [];
  const seenLineIds = new Set();

  for (const lineId of preferred) {
    const trips = await getTrips(token, lineId).catch(() => []);
    if (Array.isArray(trips) && trips.length > 0) {
      available.push({ lineId, tripCount: trips.length });
      seenLineIds.add(lineId);
    }
  }

  const lines = await getLines(token);
  for (const line of lines) {
    if (seenLineIds.has(line.id)) continue;
    const trips = await getTrips(token, line.id).catch(() => []);
    if (Array.isArray(trips) && trips.length > 0) {
      available.push({ lineId: line.id, tripCount: trips.length });
      seenLineIds.add(line.id);
    }
    if (available.length >= 3) break;
  }

  return available;
}

function buildCaseName(metadata) {
  const budget = String(metadata.budget).padStart(2, '0');
  const seedPart = metadata.seed == null ? 'sNA' : `s${metadata.seed}`;
  const repeatPart = `r${metadata.repeatIndex}`;
  return `${metadata.algorithm}-${metadata.lineScope}-b${budget}-${seedPart}-${repeatPart}`;
}

function createCase(profile, algorithm, lineIds, budget, options = {}) {
  const lineScope = summarizeScope(lineIds);
  const repeatIndex = options.repeatIndex ?? 1;
  const seed = options.seed ?? null;
  const payload = {
    name: `battery-${profile}-${algorithm}-${lineScope}-b${budget}${seed == null ? '' : `-s${seed}`}${repeatIndex > 1 ? `-r${repeatIndex}` : ''}`,
    algorithm,
    operationMode: 'urban',
    timeBudgetSeconds: budget,
  };

  if (lineIds.length === 1) payload.lineId = lineIds[0];
  else payload.lineIds = lineIds;

  if (seed != null) {
    payload.vspParams = { randomSeed: seed };
  }

  return {
    algorithm,
    budget,
    lineIds,
    lineScope,
    profile,
    repeatIndex,
    seed,
    name: buildCaseName({ algorithm, budget, lineScope, repeatIndex, seed }),
    payload,
  };
}

function buildCases(availableLines, profile) {
  const config = profileDefinitions[profile];
  const single = availableLines[0]?.lineId;
  const second = availableLines[1]?.lineId;
  const third = availableLines[2]?.lineId;
  const deterministicSeed = config.deterministicSeed;
  const cases = [];

  if (!single) {
    throw new Error('Nenhuma linha com viagens encontrada para a bateria.');
  }

  for (const budget of config.greedyBudgets) {
    cases.push(createCase(profile, 'greedy', [single], budget));
  }

  for (const budget of config.hybridBudgets) {
    cases.push(
      createCase(profile, 'hybrid_pipeline', [single], budget, {
        seed: deterministicSeed,
      }),
    );
  }

  for (let repeatIndex = 2; repeatIndex <= config.repeatCount; repeatIndex += 1) {
    cases.push(
      createCase(profile, 'hybrid_pipeline', [single], config.repeatBudget, {
        repeatIndex,
        seed: deterministicSeed,
      }),
    );
  }

  for (const seed of config.alternativeSeeds) {
    cases.push(
      createCase(profile, 'hybrid_pipeline', [single], config.repeatBudget, {
        seed,
      }),
    );
  }

  for (const budget of config.saBudgets) {
    cases.push(
      createCase(profile, 'simulated_annealing', [single], budget, {
        seed: deterministicSeed,
      }),
    );
  }

  for (let repeatIndex = 2; repeatIndex <= config.repeatCount; repeatIndex += 1) {
    cases.push(
      createCase(profile, 'simulated_annealing', [single], config.repeatBudget, {
        repeatIndex,
        seed: deterministicSeed,
      }),
    );
  }

  for (const seed of config.alternativeSeeds) {
    cases.push(
      createCase(profile, 'simulated_annealing', [single], config.repeatBudget, {
        seed,
      }),
    );
  }

  for (const budget of config.tabuBudgets) {
    cases.push(
      createCase(profile, 'tabu_search', [single], budget, {
        seed: deterministicSeed,
      }),
    );
  }

  if (config.tabuBudgets.length) {
    cases.push(
      createCase(profile, 'tabu_search', [single], config.tabuBudgets.at(-1), {
        seed: config.alternativeSeeds[0],
      }),
    );
  }

  for (const budget of config.jointBudgets) {
    cases.push(createCase(profile, 'joint_solver', [single], budget));
  }

  if (second && config.multilineHybridBudgets[0]) {
    cases.push(
      createCase(profile, 'hybrid_pipeline', [single, second], config.multilineHybridBudgets[0], {
        seed: deterministicSeed,
      }),
    );
  }

  if (second && third && config.multilineHybridBudgets[1]) {
    cases.push(
      createCase(
        profile,
        'hybrid_pipeline',
        [single, second, third],
        config.multilineHybridBudgets[1],
        { seed: deterministicSeed },
      ),
    );
  }

  return cases;
}

async function runBatteryCase(token, batteryCase) {
  const created = await createRun(token, batteryCase.payload);
  const completed = await waitForCompletion(token, created.id);
  const reproducibility = pickReproducibility(completed);
  const performance = pickPerformance(completed);

  return {
    algorithm: batteryCase.algorithm,
    caseName: batteryCase.name,
    deterministicReplayPossible:
      asBoolean(
        reproducibility?.deterministicReplayPossible ??
          reproducibility?.deterministic_replay_possible,
      ) ?? false,
    inputHash: reproducibility?.inputHash || reproducibility?.input_hash || null,
    lineIds: batteryCase.lineIds,
    lineScope: batteryCase.lineScope,
    paramsHash: reproducibility?.paramsHash || reproducibility?.params_hash || null,
    profile: batteryCase.profile,
    repeatIndex: batteryCase.repeatIndex,
    requestedBudget: batteryCase.budget,
    requestedSeed: batteryCase.seed,
    runId: completed.id,
    solverMs: toNumber(performance?.total_elapsed_ms) ?? toNumber(completed.durationMs),
    status: completed.status,
    totalCost: costValue(completed),
    totalCrew: completed.totalCrew,
    totalTrips: completed.totalTrips,
    totalVehicles: completed.totalVehicles,
    durationMs: completed.durationMs,
    cctViolations: completed.cctViolations,
    errorMessage: completed.errorMessage,
    hardIssuesCount: pickHardIssues(completed),
    warningCount: pickWarnings(completed),
    timeBudgetS: reproducibility?.timeBudgetS || reproducibility?.time_budget_s || batteryCase.budget,
  };
}

function formatCaseSummary(caseResult) {
  return [
    caseResult.caseName.padEnd(42),
    String(caseResult.runId).padStart(4),
    caseResult.status.padEnd(10),
    String(caseResult.totalVehicles).padStart(4),
    String(caseResult.totalCrew).padStart(4),
    formatNumber(caseResult.totalCost).padStart(12),
    `${caseResult.durationMs ?? '--'}ms`.padStart(10),
  ].join(' | ');
}

function groupBy(items, buildKey) {
  return items.reduce((accumulator, item) => {
    const key = buildKey(item);
    const group = accumulator.get(key) || [];
    group.push(item);
    accumulator.set(key, group);
    return accumulator;
  }, new Map());
}

function buildCoreValidations(results, validations) {
  for (const result of results) {
    const subject = result.caseName;

    createValidation(
      validations,
      result.status === 'completed' ? 'pass' : 'failure',
      'execution',
      subject,
      result.status === 'completed'
        ? 'Execução concluída com status completed.'
        : `Execução terminou com status ${result.status}.`,
    );
    createValidation(
      validations,
      result.errorMessage ? 'failure' : 'pass',
      'execution',
      subject,
      result.errorMessage ? `Run reportou erro: ${result.errorMessage}` : 'Run não reportou errorMessage.',
    );
    createValidation(
      validations,
      toNumber(result.totalCost) != null ? 'pass' : 'failure',
      'metrics',
      subject,
      toNumber(result.totalCost) != null ? 'Custo total numérico presente.' : 'Custo total ausente ou inválido.',
    );
    createValidation(
      validations,
      toNumber(result.totalVehicles) != null && Number(result.totalVehicles) > 0 ? 'pass' : 'failure',
      'metrics',
      subject,
      Number(result.totalVehicles) > 0
        ? 'Quantidade de veículos é positiva.'
        : 'Quantidade de veículos é nula ou inválida.',
    );
    createValidation(
      validations,
      toNumber(result.totalCrew) != null && Number(result.totalCrew) > 0 ? 'pass' : 'failure',
      'metrics',
      subject,
      Number(result.totalCrew) > 0
        ? 'Quantidade de tripulantes é positiva.'
        : 'Quantidade de tripulantes é nula ou inválida.',
    );
    createValidation(
      validations,
      toNumber(result.totalTrips) != null && Number(result.totalTrips) > 0 ? 'pass' : 'failure',
      'metrics',
      subject,
      Number(result.totalTrips) > 0
        ? 'Quantidade de viagens é positiva.'
        : 'Quantidade de viagens é nula ou inválida.',
    );
    createValidation(
      validations,
      result.inputHash ? 'pass' : 'failure',
      'reproducibility',
      subject,
      result.inputHash ? 'Input hash presente.' : 'Input hash ausente.',
    );
    createValidation(
      validations,
      result.paramsHash ? 'pass' : 'failure',
      'reproducibility',
      subject,
      result.paramsHash ? 'Params hash presente.' : 'Params hash ausente.',
    );
    createValidation(
      validations,
      Math.abs(Number(result.timeBudgetS) - Number(result.requestedBudget)) <= costEpsilon
        ? 'pass'
        : 'failure',
      'reproducibility',
      subject,
      Math.abs(Number(result.timeBudgetS) - Number(result.requestedBudget)) <= costEpsilon
        ? 'Budget reportado confere com o budget solicitado.'
        : `Budget reportado (${result.timeBudgetS}) diverge do solicitado (${result.requestedBudget}).`,
    );
  }
}

function buildInputHashValidations(results, validations) {
  const groups = groupBy(results, (result) => `${result.lineScope}:${result.lineIds.join(',')}`);

  for (const [groupKey, items] of groups.entries()) {
    const baseline = items.find((item) => item.inputHash) ?? items[0];
    for (const item of items) {
      createValidation(
        validations,
        item.inputHash === baseline.inputHash ? 'pass' : 'failure',
        'input-hash',
        groupKey,
        item.inputHash === baseline.inputHash
          ? `Input hash estável em ${item.caseName}.`
          : `Input hash divergiu em ${item.caseName}: ${item.inputHash} vs ${baseline.inputHash}.`,
      );
    }
  }
}

function buildDeterminismValidations(results, validations) {
  const groups = groupBy(
    results.filter((result) => result.requestedSeed != null),
    (result) =>
      [
        result.algorithm,
        result.lineScope,
        result.requestedBudget,
        result.requestedSeed,
      ].join(':'),
  );

  for (const [groupKey, items] of groups.entries()) {
    if (items.length < 2) continue;
    const baseline = items[0];

    for (const item of items.slice(1)) {
      const reproducibleClaim =
        baseline.deterministicReplayPossible === true &&
        item.deterministicReplayPossible === true;
      const matchingOutcome = sameOutcome(baseline, item);

      createValidation(
        validations,
        matchingOutcome ? 'pass' : reproducibleClaim ? 'failure' : 'warning',
        'determinism',
        groupKey,
        matchingOutcome
          ? `Mesma seed e mesmo budget reproduziram a mesma solução (${item.caseName}).`
          : reproducibleClaim
            ? `Mesma seed e mesmo budget divergiram entre ${baseline.caseName} e ${item.caseName}, apesar de o solver marcar replay determinístico.`
            : `Mesma seed e mesmo budget divergiram entre ${baseline.caseName} e ${item.caseName}; a execução permanece estocástica por depender de budget temporal.`,
      );
      createValidation(
        validations,
        baseline.inputHash === item.inputHash ? 'pass' : 'failure',
        'determinism',
        groupKey,
        baseline.inputHash === item.inputHash
          ? 'Input hash permaneceu estável entre repetições.'
          : 'Input hash divergente entre repetições do mesmo cenário.',
      );
      createValidation(
        validations,
        baseline.paramsHash === item.paramsHash ? 'pass' : 'failure',
        'determinism',
        groupKey,
        baseline.paramsHash === item.paramsHash
          ? 'Params hash permaneceu estável entre repetições.'
          : 'Params hash divergente entre repetições do mesmo cenário.',
      );
    }
  }
}

function buildBudgetSummaries(results, validations) {
  const completed = results.filter((result) => result.status === 'completed');
  const groups = groupBy(
    completed,
    (result) => `${result.algorithm}:${result.lineScope}:${result.requestedSeed ?? 'no-seed'}`,
  );
  const summaries = [];

  for (const [groupKey, items] of groups.entries()) {
    const representativeByBudget = new Map();
    for (const item of items) {
      const existing = representativeByBudget.get(item.requestedBudget);
      if (!existing || Number(item.totalCost) < Number(existing.totalCost)) {
        representativeByBudget.set(item.requestedBudget, item);
      }
    }

    const budgetEntries = [...representativeByBudget.entries()].sort(
      (left, right) => left[0] - right[0],
    );
    const representativeItems = budgetEntries.map(([, item]) => item);
    const bestResult = representativeItems.reduce((best, item) =>
      Number(item.totalCost) < Number(best.totalCost) ? item : best,
    );
    const worstResult = representativeItems.reduce((worst, item) =>
      Number(item.totalCost) > Number(worst.totalCost) ? item : worst,
    );
    const minBudgetResult = representativeItems[0];
    let improvements = 0;
    let plateaus = 0;
    let regressions = 0;

    for (let leftIndex = 0; leftIndex < representativeItems.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < representativeItems.length;
        rightIndex += 1
      ) {
        const low = representativeItems[leftIndex];
        const high = representativeItems[rightIndex];
        const outcome = compareCosts(low.totalCost, high.totalCost);
        const delta = costDelta(low.totalCost, high.totalCost);
        const pct = percentDelta(low.totalCost, high.totalCost);

        if (outcome === 'better') improvements += 1;
        if (outcome === 'same') plateaus += 1;
        if (outcome === 'worse') regressions += 1;

        createValidation(
          validations,
          outcome === 'worse' ? 'warning' : 'pass',
          'budget-evolution',
          groupKey,
          outcome === 'better'
            ? `Budget ${high.requestedBudget}s melhorou custo em ${formatCurrency(Math.abs(delta))} frente a ${low.requestedBudget}s.`
            : outcome === 'same'
              ? `Budget ${low.requestedBudget}s e ${high.requestedBudget}s produziram o mesmo custo final.`
              : `Budget ${high.requestedBudget}s piorou custo em ${formatCurrency(delta)} frente a ${low.requestedBudget}s.`,
          { lowerBudget: low.requestedBudget, higherBudget: high.requestedBudget, delta, pct },
        );
      }
    }

    summaries.push({
      algorithm: representativeItems[0].algorithm,
      lineScope: representativeItems[0].lineScope,
      requestedSeed: representativeItems[0].requestedSeed,
      budgets: representativeItems.map((item) => item.requestedBudget),
      bestBudget: bestResult.requestedBudget,
      bestCost: bestResult.totalCost,
      bestVehicles: bestResult.totalVehicles,
      bestCrew: bestResult.totalCrew,
      minBudget: minBudgetResult.requestedBudget,
      minBudgetCost: minBudgetResult.totalCost,
      improvementVsMinBudget: round2(
        Number(minBudgetResult.totalCost) - Number(bestResult.totalCost),
      ),
      improvementVsMinBudgetPct: percentDelta(
        minBudgetResult.totalCost,
        bestResult.totalCost,
      ) == null
        ? null
        : Math.abs(percentDelta(minBudgetResult.totalCost, bestResult.totalCost)),
      averageCost: round2(
        representativeItems.reduce((sum, item) => sum + Number(item.totalCost), 0) /
          representativeItems.length,
      ),
      worstCost: worstResult.totalCost,
      pairwise: {
        improvements,
        plateaus,
        regressions,
      },
      interpretation:
        round2(Number(minBudgetResult.totalCost) - Number(bestResult.totalCost)) > costEpsilon
          ? 'Mais tempo reduziu custo neste cenário.'
          : regressions > 0
            ? 'Budgets maiores tiveram regressões pontuais ou plateau.'
            : 'Os budgets testados convergiram para a mesma solução final.',
    });
  }

  return summaries.sort((left, right) =>
    `${left.algorithm}:${left.lineScope}`.localeCompare(`${right.algorithm}:${right.lineScope}`),
  );
}

function buildSeedSummaries(results, validations) {
  const completed = results.filter(
    (result) => result.status === 'completed' && stochasticAlgorithms.has(result.algorithm),
  );
  const groups = groupBy(
    completed,
    (result) => `${result.algorithm}:${result.lineScope}:${result.requestedBudget}`,
  );
  const summaries = [];

  for (const [groupKey, items] of groups.entries()) {
    const seeds = [...new Set(items.map((item) => item.requestedSeed).filter(Boolean))].sort(
      (left, right) => left - right,
    );

    if (seeds.length < 2) continue;

    const uniqueSolutions = new Set(items.map((item) => stableSignature(item)));
    const uniqueSolutionCount = uniqueSolutions.size;
    createValidation(
      validations,
      uniqueSolutionCount > 1 ? 'pass' : 'warning',
      'seed-variation',
      groupKey,
      uniqueSolutionCount > 1
        ? `Seeds diferentes geraram ${uniqueSolutionCount} soluções distintas.`
        : 'Seeds diferentes convergiram para a mesma solução final.',
      { seeds, uniqueSolutionCount },
    );

    summaries.push({
      algorithm: items[0].algorithm,
      lineScope: items[0].lineScope,
      requestedBudget: items[0].requestedBudget,
      seeds,
      uniqueSolutionCount,
      uniqueCostCount: new Set(items.map((item) => formatNumber(item.totalCost))).size,
    });
  }

  return summaries.sort((left, right) =>
    `${left.algorithm}:${left.lineScope}:${left.requestedBudget}`.localeCompare(
      `${right.algorithm}:${right.lineScope}:${right.requestedBudget}`,
    ),
  );
}

function buildAlgorithmSummaries(results, budgetSummaries) {
  const completed = results.filter((result) => result.status === 'completed');
  const groups = groupBy(completed, (result) => `${result.algorithm}:${result.lineScope}`);
  const budgetMap = groupBy(
    budgetSummaries,
    (summary) => `${summary.algorithm}:${summary.lineScope}`,
  );

  return [...groups.entries()]
    .map(([groupKey, items]) => {
      const [algorithm, lineScope] = groupKey.split(':');
      const best = items.reduce((bestRun, item) =>
        Number(item.totalCost) < Number(bestRun.totalCost) ? item : bestRun,
      );
      const worst = items.reduce((worstRun, item) =>
        Number(item.totalCost) > Number(worstRun.totalCost) ? item : worstRun,
      );
      const budgetItems = budgetMap.get(groupKey) || [];
      const improvement = budgetItems.reduce(
        (maxImprovement, item) =>
          Math.max(maxImprovement, Number(item.improvementVsMinBudget ?? 0)),
        0,
      );
      const regressions = budgetItems.reduce(
        (total, item) => total + item.pairwise.regressions,
        0,
      );
      const uniqueSolutions = new Set(items.map((item) => stableSignature(item))).size;

      return {
        algorithm,
        lineScope,
        runCount: items.length,
        budgets: [...new Set(items.map((item) => item.requestedBudget))].sort((left, right) => left - right),
        bestCost: best.totalCost,
        bestBudget: best.requestedBudget,
        bestVehicles: best.totalVehicles,
        bestCrew: best.totalCrew,
        worstCost: worst.totalCost,
        averageCost: round2(
          items.reduce((sum, item) => sum + Number(item.totalCost), 0) / items.length,
        ),
        maxImprovementFromBudgetSweep: round2(improvement),
        regressionCount: regressions,
        uniqueSolutions,
      };
    })
    .sort((left, right) => `${left.algorithm}:${left.lineScope}`.localeCompare(`${right.algorithm}:${right.lineScope}`));
}

function buildComparableBudgetTables(results) {
  const completed = results.filter((result) => result.status === 'completed');
  const byScopeBudget = groupBy(
    completed,
    (result) => `${result.lineScope}:${result.requestedBudget}`,
  );

  return [...byScopeBudget.entries()]
    .map(([groupKey, items]) => {
      const [lineScope, budget] = groupKey.split(':');
      const byAlgorithm = groupBy(items, (item) => item.algorithm);
      const rows = [...byAlgorithm.entries()]
        .map(([algorithm, entries]) =>
          entries.reduce((best, item) =>
            Number(item.totalCost) < Number(best.totalCost) ? item : best,
          ),
        )
        .sort((left, right) => Number(left.totalCost) - Number(right.totalCost));

      return {
        lineScope,
        requestedBudget: Number(budget),
        rows,
      };
    })
    .filter((table) => table.rows.length >= 2)
    .sort((left, right) => left.requestedBudget - right.requestedBudget);
}

function buildReport(results, validations, availableLines, profile) {
  const budgetSummaries = buildBudgetSummaries(results, validations);
  const seedSummaries = buildSeedSummaries(results, validations);
  const algorithmSummaries = buildAlgorithmSummaries(results, budgetSummaries);
  const comparableBudgetTables = buildComparableBudgetTables(results);
  const completed = results.filter((result) => result.status === 'completed');
  const bestOverall = completed.reduce(
    (best, item) =>
      !best || Number(item.totalCost) < Number(best.totalCost) ? item : best,
    null,
  );
  const validationSummary = validations.reduce(
    (summary, validation) => {
      summary[validation.level] = (summary[validation.level] || 0) + 1;
      return summary;
    },
    { pass: 0, warning: 0, failure: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    profile,
    description: profileDefinitions[profile].description,
    apiBaseUrl,
    availableLines,
    results,
    validations,
    summary: {
      runCount: results.length,
      completedRuns: completed.length,
      bestOverall,
      validationSummary,
    },
    algorithmSummaries,
    budgetSummaries,
    seedSummaries,
    comparableBudgetTables,
  };
}

function markdownTable(headers, rows) {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyRows = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerRow, separatorRow, ...bodyRows].join('\n');
}

function generateMarkdown(report) {
  const warningRows = report.validations.filter((item) => item.level === 'warning');
  const failureRows = report.validations.filter((item) => item.level === 'failure');
  const linesSummary = report.availableLines
    .map((item) => `${item.lineId} (${item.tripCount} viagens)`)
    .join(', ');

  const sections = [
    '# Relatorio da Bateria de Otimizacao',
    '',
    `- Gerado em: ${report.generatedAt}`,
    `- Perfil: ${report.profile}`,
    `- API base: ${report.apiBaseUrl}`,
    `- Linhas usadas: ${linesSummary || 'nenhuma'}`,
    `- Runs executadas: ${report.summary.runCount}`,
    `- Validacoes aprovadas: ${report.summary.validationSummary.pass}`,
    `- Warnings: ${report.summary.validationSummary.warning}`,
    `- Falhas: ${report.summary.validationSummary.failure}`,
    '',
    '## Melhor resultado global',
    '',
    report.summary.bestOverall
      ? markdownTable(
          ['Caso', 'Algoritmo', 'Escopo', 'Budget', 'Custo', 'Veiculos', 'Tripulacao'],
          [[
            report.summary.bestOverall.caseName,
            report.summary.bestOverall.algorithm,
            report.summary.bestOverall.lineScope,
            formatBudget(report.summary.bestOverall.requestedBudget),
            formatCurrency(report.summary.bestOverall.totalCost),
            String(report.summary.bestOverall.totalVehicles),
            String(report.summary.bestOverall.totalCrew),
          ]],
        )
      : 'Nenhum resultado concluido.',
    '',
    '## Comparativo por algoritmo',
    '',
    markdownTable(
      [
        'Algoritmo',
        'Escopo',
        'Runs',
        'Budgets',
        'Melhor custo',
        'Melhor budget',
        'Veiculos',
        'Tripulacao',
        'Melhora vs menor budget',
        'Regressoes',
      ],
      report.algorithmSummaries.map((item) => [
        item.algorithm,
        item.lineScope,
        String(item.runCount),
        item.budgets.map((budget) => formatBudget(budget)).join(', '),
        formatCurrency(item.bestCost),
        formatBudget(item.bestBudget),
        String(item.bestVehicles),
        String(item.bestCrew),
        formatCurrency(item.maxImprovementFromBudgetSweep),
        String(item.regressionCount),
      ]),
    ),
    '',
    '## Evolucao de custo por budget e seed',
    '',
    markdownTable(
      [
        'Algoritmo',
        'Escopo',
        'Seed',
        'Budgets',
        'Melhor custo',
        'Melhor budget',
        'Delta vs menor budget',
        'Melhorias',
        'Plateaus',
        'Regressoes',
        'Leitura',
      ],
      report.budgetSummaries.map((item) => [
        item.algorithm,
        item.lineScope,
        item.requestedSeed == null ? 'n/a' : String(item.requestedSeed),
        item.budgets.map((budget) => formatBudget(budget)).join(', '),
        formatCurrency(item.bestCost),
        formatBudget(item.bestBudget),
        formatCurrency(item.improvementVsMinBudget),
        String(item.pairwise.improvements),
        String(item.pairwise.plateaus),
        String(item.pairwise.regressions),
        item.interpretation,
      ]),
    ),
    '',
  ];

  if (report.seedSummaries.length) {
    sections.push('## Variacao por seed');
    sections.push('');
    sections.push(
      markdownTable(
        ['Algoritmo', 'Escopo', 'Budget', 'Seeds', 'Solucoes unicas', 'Custos unicos'],
        report.seedSummaries.map((item) => [
          item.algorithm,
          item.lineScope,
          formatBudget(item.requestedBudget),
          item.seeds.join(', '),
          String(item.uniqueSolutionCount),
          String(item.uniqueCostCount),
        ]),
      ),
    );
    sections.push('');
  }

  if (report.comparableBudgetTables.length) {
    sections.push('## Ranking comparavel por budget');
    sections.push('');
    for (const table of report.comparableBudgetTables) {
      sections.push(`### ${table.lineScope} · ${formatBudget(table.requestedBudget)}`);
      sections.push('');
      sections.push(
        markdownTable(
          ['Posicao', 'Algoritmo', 'Custo', 'Veiculos', 'Tripulacao', 'Caso'],
          table.rows.map((row, index) => [
            String(index + 1),
            row.algorithm,
            formatCurrency(row.totalCost),
            String(row.totalVehicles),
            String(row.totalCrew),
            row.caseName,
          ]),
        ),
      );
      sections.push('');
    }
  }

  sections.push('## Tabela completa de runs');
  sections.push('');
  sections.push(
    markdownTable(
      [
        'Caso',
        'Run',
        'Algoritmo',
        'Escopo',
        'Budget',
        'Seed',
        'Custo',
        'Veiculos',
        'Tripulacao',
        'Trips',
        'Duracao',
      ],
      report.results.map((item) => [
        item.caseName,
        String(item.runId),
        item.algorithm,
        item.lineScope,
        formatBudget(item.requestedBudget),
        item.requestedSeed == null ? 'n/a' : String(item.requestedSeed),
        formatCurrency(item.totalCost),
        String(item.totalVehicles),
        String(item.totalCrew),
        String(item.totalTrips),
        `${item.durationMs}ms`,
      ]),
    ),
  );
  sections.push('');

  sections.push('## Achados');
  sections.push('');

  if (failureRows.length) {
    for (const failure of failureRows.slice(0, 25)) {
      sections.push(`- FALHA [${failure.category}] ${failure.subject}: ${failure.message}`);
    }
  } else {
    sections.push('- Nenhuma falha estrutural encontrada na bateria.');
  }

  if (warningRows.length) {
    for (const warning of warningRows.slice(0, 25)) {
      sections.push(`- WARNING [${warning.category}] ${warning.subject}: ${warning.message}`);
    }
  } else {
    sections.push('- Nenhum warning relevante nesta execução.');
  }

  sections.push('');
  return sections.join('\n');
}

function writeArtifacts(report) {
  ensureDir(outputDir);
  const jsonPath = path.join(outputDir, 'optimization-battery-results.json');
  const markdownPath = path.join(outputDir, 'optimization-battery-report.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, generateMarkdown(report));
  return { jsonPath, markdownPath };
}

function printAlgorithmSummary(report) {
  console.log('\nLeitura por algoritmo');
  report.budgetSummaries.forEach((item) => {
    const seedLabel = item.requestedSeed == null ? 'n/a' : item.requestedSeed;
    console.log(
      `- ${item.algorithm}/${item.lineScope}/seed=${seedLabel}: melhor=${formatCurrency(item.bestCost)} @ ${formatBudget(item.bestBudget)} | delta vs menor budget=${formatCurrency(item.improvementVsMinBudget)} | melhorias=${item.pairwise.improvements} | plateaus=${item.pairwise.plateaus} | regressões=${item.pairwise.regressions}`,
    );
  });
}

async function main() {
  const profile = profileName;
  console.log(`API base: ${apiBaseUrl}`);
  console.log(`Perfil: ${profile}`);
  console.log('Autenticando...');
  const token = await login();
  console.log('Login OK. Descobrindo linhas com massa real...');

  const availableLines = await discoverScenarioLines(token);
  if (!availableLines.length) {
    throw new Error('Nao foi possivel encontrar linhas com viagens para testar.');
  }

  console.log(
    `Linhas selecionadas: ${availableLines
      .map((item) => `${item.lineId}(${item.tripCount})`)
      .join(', ')}`,
  );

  const cases = buildCases(availableLines, profile);
  const results = [];

  for (const batteryCase of cases) {
    console.log(`\n[RUN] ${batteryCase.name}`);
    const result = await runBatteryCase(token, batteryCase);
    results.push(result);
    console.log(
      `     status=${result.status} cost=${formatNumber(result.totalCost)} vehicles=${result.totalVehicles} crew=${result.totalCrew} duration=${result.durationMs}ms`,
    );
  }

  console.log('\nResumo da bateria');
  console.log('case                                       | run | status      | veh | crew |         cost |   duration');
  console.log('-------------------------------------------+-----+-------------+-----+------+--------------+-----------');
  results.forEach((item) => console.log(formatCaseSummary(item)));

  const validations = [];
  buildCoreValidations(results, validations);
  buildInputHashValidations(results, validations);
  buildDeterminismValidations(results, validations);
  const report = buildReport(results, validations, availableLines, profile);
  const artifacts = writeArtifacts(report);
  printAlgorithmSummary(report);

  console.log('\nValidações');
  console.log(`- Pass: ${report.summary.validationSummary.pass}`);
  console.log(`- Warning: ${report.summary.validationSummary.warning}`);
  console.log(`- Failure: ${report.summary.validationSummary.failure}`);
  console.log(`- JSON: ${artifacts.jsonPath}`);
  console.log(`- Markdown: ${artifacts.markdownPath}`);

  const warningRows = report.validations.filter((item) => item.level === 'warning');
  const failureRows = report.validations.filter((item) => item.level === 'failure');

  if (warningRows.length) {
    console.log('\nWarnings principais');
    warningRows.slice(0, 12).forEach((warning) => {
      console.log(`- [${warning.category}] ${warning.subject}: ${warning.message}`);
    });
  }

  if (failureRows.length) {
    console.error('\nFalhas');
    failureRows.forEach((failure) => {
      console.error(`- [${failure.category}] ${failure.subject}: ${failure.message}`);
    });
    process.exit(1);
  }

  if (failOnWarning && warningRows.length) {
    console.error('\nFail on warning habilitado: a bateria encontrou warnings.');
    process.exit(1);
  }

  console.log('\nBateria finalizada com sucesso.');
}

main().catch((error) => {
  console.error(`\nErro na bateria: ${error.message}`);
  process.exit(1);
});