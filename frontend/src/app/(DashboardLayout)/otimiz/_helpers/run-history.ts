import type { DashboardStats, KpiData, OptimizationRun } from '../_types';

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asNumber(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(Number(value)));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function percentage(part: number, total: number): number | null {
  if (!total) return null;
  return (part / total) * 100;
}

function timestampValue(value?: string | null): number {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function countWarnings(resultSummary: Record<string, any> | null): number {
  if (!resultSummary) return 0;
  const solverExplanation = asRecord(resultSummary.solverExplanation ?? resultSummary.solver_explanation);
  const issues = asRecord(solverExplanation?.issues);
  const softIssues = asArray(issues?.soft).length;

  if (softIssues > 0) return softIssues;
  return asArray(resultSummary.warnings).length;
}

function readSameRosterRatio(resultSummary: Record<string, any> | null): number | null {
  if (!resultSummary) return null;
  const solverExplanation = asRecord(resultSummary.solverExplanation ?? resultSummary.solver_explanation);
  const tripGroupAudit = asRecord(
    resultSummary.tripGroupAudit ??
      resultSummary.trip_group_audit ??
      solverExplanation?.trip_group_audit,
  );
  return asNumber(tripGroupAudit?.same_roster_ratio);
}

function buildStatusDistribution(points: HistoricalRunPoint[]): DistributionItem[] {
  const labels: Array<[string, string]> = [
    ['completed', 'Concluidas'],
    ['running', 'Executando'],
    ['failed', 'Falhas'],
    ['pending', 'Pendentes'],
    ['cancelled', 'Canceladas'],
  ];

  return labels
    .map(([status, label]) => ({
      label,
      value: points.filter((point) => point.status === status).length,
    }))
    .filter((item) => item.value > 0);
}

function buildDistribution(values: string[]): DistributionItem[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const next = counts.get(value) ?? 0;
    counts.set(value, next + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({ label, value }));
}

function splitWindow<T>(values: T[]): { previous: T[]; current: T[] } {
  if (values.length < 2) return { previous: [], current: values };

  const currentSize = Math.ceil(values.length / 2);
  return {
    previous: values.slice(0, values.length - currentSize),
    current: values.slice(-currentSize),
  };
}

function calculateTrend(
  currentValue: number | null,
  previousValue: number | null,
  direction: 'higher' | 'lower' = 'higher',
): number | undefined {
  if (currentValue == null || previousValue == null || previousValue === 0) return undefined;

  const raw = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const normalized = direction === 'higher' ? raw : -raw;
  return Number(normalized.toFixed(1));
}

export interface DashboardLastOptimization {
  id: number | null;
  date: string | null;
  vehicles: number | null;
  crew: number | null;
  cost: number | null;
  cctViolations: number | null;
}

export interface DashboardStatsSnapshot {
  totalLines: number;
  totalTerminals: number;
  totalVehicleTypes: number;
  totalOptimizationRuns: number;
  completedRuns: number;
  lastOptimization: DashboardLastOptimization | null;
  recentRuns: OptimizationRun[];
}

export interface KpiSnapshot {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  avgVehicles: number;
  avgCrew: number;
  avgCost: number;
  avgDurationMs: number;
  successRate: number;
  totalTrips: number;
  totalLines: number;
  lastOptimization: DashboardLastOptimization | null;
}

export interface HistoricalRunPoint {
  runId: number;
  label: string;
  name: string | null;
  timestamp: string;
  lineId: number | null;
  lineIds: number[] | null;
  scheduleId: number | null;
  profileId: number | null;
  profileName: string | null;
  operationMode?: OptimizationRun['operationMode'];
  totalVehicles: number;
  totalCrew: number;
  totalCost: number;
  durationMs: number;
  cctViolations: number;
  softIssues: number;
  unassignedTrips: number;
  sameRosterRatio: number | null;
  status: string;
  algorithm: string;
}

export interface DistributionItem {
  label: string;
  value: number;
}

export interface AlgorithmBenchmarkRow {
  algorithm: string;
  runCount: number;
  completedRuns: number;
  failedRuns: number;
  successRate: number | null;
  cleanRunRate: number | null;
  avgCost: number | null;
  avgDurationMs: number | null;
  avgVehicles: number | null;
  avgCrew: number | null;
  avgCctViolations: number | null;
  avgSoftIssues: number | null;
  avgUnassignedTrips: number | null;
  avgSameRosterRatio: number | null;
  operationalScore: number | null;
  bestRun: HistoricalRunPoint | null;
}

export interface OperationalBaseline {
  totalRuns: number;
  completedRuns: number;
  successRate: number | null;
  cleanRunRate: number | null;
  avgCost: number | null;
  avgDurationMs: number | null;
  avgVehicles: number | null;
  avgCrew: number | null;
  avgCctViolations: number | null;
  avgSoftIssues: number | null;
  avgUnassignedTrips: number | null;
  avgSameRosterRatio: number | null;
  operationalScore: number | null;
}

export interface AlgorithmAuditRow extends AlgorithmBenchmarkRow {
  operationalScoreGap: number | null;
  successRateGap: number | null;
  cleanRunRateGap: number | null;
  costDeltaPct: number | null;
  durationDeltaPct: number | null;
  cctGap: number | null;
  softIssuesGap: number | null;
  sameRosterGap: number | null;
  baselineTag: 'above' | 'watch' | 'below';
}

export interface HistoricalSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  successRate: number | null;
  cleanRunRate: number | null;
  avgCost: number | null;
  avgDurationMs: number | null;
  avgCctViolations: number | null;
  avgSoftIssues: number | null;
  avgSameRosterRatio: number | null;
  bestCostRun: HistoricalRunPoint | null;
  statusDistribution: DistributionItem[];
  algorithmDistribution: DistributionItem[];
  trends: {
    completedRuns?: number;
    successRate?: number;
    avgCost?: number;
    avgDurationMs?: number;
    cleanRunRate?: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function absoluteDelta(current: number | null, baseline: number | null, digits = 1): number | null {
  if (current == null || baseline == null) return null;
  return Number((current - baseline).toFixed(digits));
}

function relativeDeltaPct(current: number | null, baseline: number | null): number | null {
  if (current == null || baseline == null || baseline === 0) return null;
  return Number((((current - baseline) / Math.abs(baseline)) * 100).toFixed(1));
}

function calculateOperationalScore(input: {
  successRate: number | null;
  cleanRunRate: number | null;
  avgSameRosterRatio: number | null;
  avgCctViolations: number | null;
  avgSoftIssues: number | null;
  avgUnassignedTrips: number | null;
}): number | null {
  const successRate = input.successRate ?? 0;
  const cleanRunRate = input.cleanRunRate ?? 0;
  const sameRosterRatio = (input.avgSameRosterRatio ?? 0) * 100;
  const cctPenalty = (input.avgCctViolations ?? 0) * 8;
  const softPenalty = (input.avgSoftIssues ?? 0) * 2;
  const unassignedPenalty = (input.avgUnassignedTrips ?? 0) * 10;
  const rawScore = successRate * 0.45 + cleanRunRate * 0.3 + sameRosterRatio * 0.15 - cctPenalty - softPenalty - unassignedPenalty;

  return Number(clamp(rawScore, 0, 100).toFixed(1));
}

export function normalizeLastOptimization(input: unknown): DashboardLastOptimization | null {
  const record = asRecord(input);
  if (!record) return null;

  return {
    id: asNumber(record.id),
    date: asString(record.date) ?? null,
    vehicles: asNumber(record.vehicles),
    crew: asNumber(record.crew),
    cost: asNumber(record.cost),
    cctViolations: asNumber(record.cctViolations ?? record.cct_violations),
  };
}

export function normalizeDashboardStats(input: unknown): DashboardStatsSnapshot {
  const record = asRecord(input) as DashboardStats | null;
  const fallbackLastOptimization =
    record?.lastRunAt || record?.lastRunVehicles != null || record?.lastRunCrew != null || record?.lastRunCost != null
      ? {
          id: null,
          date: record?.lastRunAt ?? null,
          vehicles: asNumber(record?.lastRunVehicles),
          crew: asNumber(record?.lastRunCrew),
          cost: asNumber(record?.lastRunCost),
          cctViolations: null,
        }
      : null;

  return {
    totalLines: asNumber(record?.totalLines ?? record?.total_lines) ?? 0,
    totalTerminals: asNumber(record?.totalTerminals ?? record?.total_terminals) ?? 0,
    totalVehicleTypes: asNumber(record?.totalVehicleTypes) ?? 0,
    totalOptimizationRuns: asNumber(record?.totalOptimizationRuns ?? record?.totalRuns) ?? 0,
    completedRuns: asNumber(record?.completedRuns) ?? 0,
    lastOptimization: normalizeLastOptimization(record?.lastOptimization) ?? fallbackLastOptimization,
    recentRuns: normalizeOptimizationRuns(record?.recentRuns),
  };
}

export function normalizeKpiData(input: unknown): KpiSnapshot {
  const record = asRecord(input) as KpiData | null;

  return {
    totalRuns: asNumber(record?.totalRuns) ?? 0,
    completedRuns: asNumber(record?.completedRuns) ?? 0,
    failedRuns: asNumber(record?.failedRuns) ?? 0,
    avgVehicles: asNumber(record?.avgVehicles) ?? 0,
    avgCrew: asNumber(record?.avgCrew) ?? 0,
    avgCost: asNumber(record?.avgCost) ?? 0,
    avgDurationMs: asNumber(record?.avgDurationMs) ?? 0,
    successRate: asNumber(record?.successRate) ?? 0,
    totalTrips: asNumber(record?.totalTrips) ?? 0,
    totalLines: asNumber(record?.totalLines) ?? 0,
    lastOptimization: normalizeLastOptimization(record?.lastOptimization),
  };
}

export function normalizeOptimizationRun(input: unknown): OptimizationRun {
  const record = asRecord(input) ?? {};
  const createdAt = asString(record.createdAt ?? record.created_at) ?? new Date(0).toISOString();
  const updatedAt = asString(record.updatedAt ?? record.updated_at) ?? createdAt;

  return {
    id: asNumber(record.id) ?? 0,
    name: asString(record.name) ?? undefined,
    lineId: asNumber(record.lineId ?? record.line_id),
    lineIds: Array.isArray(record.lineIds ?? record.line_ids) ? (record.lineIds ?? record.line_ids) as number[] : null,
    scheduleId: asNumber(record.scheduleId ?? record.schedule_id),
    profileId: asNumber(record.profileId ?? record.profile_id),
    profileName: asString(record.profileName ?? record.profile_name),
    companyId: asNumber(record.companyId ?? record.company_id) ?? 0,
    algorithm: (asString(record.algorithm) ?? 'hybrid_pipeline') as OptimizationRun['algorithm'],
    status: (asString(record.status) ?? 'completed') as OptimizationRun['status'],
    operationMode: (asString(record.operationMode ?? record.operation_mode) ?? undefined) as OptimizationRun['operationMode'],
    totalVehicles: asNumber(record.totalVehicles ?? record.total_vehicles ?? record.vehicles) ?? undefined,
    totalCrew: asNumber(record.totalCrew ?? record.total_crew ?? record.crew) ?? undefined,
    totalTrips: asNumber(record.totalTrips ?? record.total_trips) ?? undefined,
    totalCost: asNumber(record.totalCost ?? record.total_cost ?? record.cost) ?? undefined,
    cctViolations: asNumber(record.cctViolations ?? record.cct_violations) ?? undefined,
    durationMs: asNumber(record.durationMs ?? record.duration ?? record.elapsed_ms) ?? undefined,
    errorMessage: asString(record.errorMessage ?? record.error_message) ?? undefined,
    params: asRecord(record.params) ?? undefined,
    resultSummary: (record.resultSummary ?? record.result_summary ?? null) as OptimizationRun['resultSummary'],
    startedAt: asString(record.startedAt ?? record.started_at) ?? undefined,
    finishedAt: asString(record.finishedAt ?? record.finished_at) ?? undefined,
    createdAt,
    updatedAt,
  };
}

export function normalizeOptimizationRuns(input: unknown): OptimizationRun[] {
  return asArray(input)
    .map((item) => normalizeOptimizationRun(item))
    .filter((run) => run.id > 0);
}

export function buildHistoryPoints(runs: OptimizationRun[]): HistoricalRunPoint[] {
  return runs
    .slice()
    .sort((left, right) => {
      const leftDate = timestampValue(left.finishedAt ?? left.createdAt);
      const rightDate = timestampValue(right.finishedAt ?? right.createdAt);
      return leftDate - rightDate;
    })
    .map((run) => {
      const resultSummary = asRecord(run.resultSummary);
      const params = asRecord(run.params);
      const settingsSnapshot = asRecord(params?.settingsSnapshot);
      const timestamp = run.finishedAt ?? run.createdAt;

      return {
        runId: run.id,
        label: `#${String(run.id).padStart(4, '0')}`,
        name: run.name ?? null,
        timestamp,
        lineId: run.lineId ?? null,
        lineIds: run.lineIds ?? null,
        scheduleId: run.scheduleId ?? null,
        profileId: run.profileId ?? asNumber(settingsSnapshot?.id),
        profileName: run.profileName ?? asString(settingsSnapshot?.name),
        operationMode: run.operationMode,
        totalVehicles: asNumber(run.totalVehicles) ?? 0,
        totalCrew: asNumber(run.totalCrew) ?? 0,
        totalCost: asNumber(run.totalCost) ?? 0,
        durationMs: asNumber(run.durationMs) ?? 0,
        cctViolations:
          asNumber(run.cctViolations) ??
          asNumber(resultSummary?.cct_violations ?? resultSummary?.cctViolations) ??
          0,
        softIssues: countWarnings(resultSummary),
        unassignedTrips: asArray(resultSummary?.unassigned_trips).length,
        sameRosterRatio: readSameRosterRatio(resultSummary),
        status: run.status,
        algorithm: run.algorithm,
      };
    });
}

export function buildHistoricalSummary(points: HistoricalRunPoint[]): HistoricalSummary {
  const completedRuns = points.filter((point) => point.status === 'completed');
  const failedRuns = points.filter((point) => point.status === 'failed');
  const cleanRuns = completedRuns.filter(
    (point) => point.cctViolations === 0 && point.softIssues === 0 && point.unassignedTrips === 0,
  );
  const bestCostRun = completedRuns
    .filter((point) => point.totalCost > 0)
    .slice()
    .sort((left, right) => left.totalCost - right.totalCost)[0] ?? null;

  const { previous, current } = splitWindow(points);
  const previousCompletedRuns = previous.filter((point) => point.status === 'completed');
  const currentCompletedRuns = current.filter((point) => point.status === 'completed');
  const previousCleanRuns = previousCompletedRuns.filter(
    (point) => point.cctViolations === 0 && point.softIssues === 0 && point.unassignedTrips === 0,
  );
  const currentCleanRuns = currentCompletedRuns.filter(
    (point) => point.cctViolations === 0 && point.softIssues === 0 && point.unassignedTrips === 0,
  );

  const previousSuccessRate = percentage(previousCompletedRuns.length, previous.length);
  const currentSuccessRate = percentage(currentCompletedRuns.length, current.length);
  const previousAverageCost = average(previousCompletedRuns.map((point) => point.totalCost));
  const currentAverageCost = average(currentCompletedRuns.map((point) => point.totalCost));
  const previousAverageDuration = average(previousCompletedRuns.map((point) => point.durationMs));
  const currentAverageDuration = average(currentCompletedRuns.map((point) => point.durationMs));
  const previousCleanRate = percentage(previousCleanRuns.length, previousCompletedRuns.length);
  const currentCleanRate = percentage(currentCleanRuns.length, currentCompletedRuns.length);

  return {
    totalRuns: points.length,
    completedRuns: completedRuns.length,
    failedRuns: failedRuns.length,
    successRate: percentage(completedRuns.length, points.length),
    cleanRunRate: percentage(cleanRuns.length, completedRuns.length),
    avgCost: average(completedRuns.map((point) => point.totalCost)),
    avgDurationMs: average(completedRuns.map((point) => point.durationMs)),
    avgCctViolations: average(completedRuns.map((point) => point.cctViolations)),
    avgSoftIssues: average(completedRuns.map((point) => point.softIssues)),
    avgSameRosterRatio: average(
      completedRuns
        .map((point) => point.sameRosterRatio)
        .filter((value): value is number => value != null),
    ),
    bestCostRun,
    statusDistribution: buildStatusDistribution(points),
    algorithmDistribution: buildDistribution(completedRuns.map((point) => point.algorithm)).slice(0, 5),
    trends: {
      completedRuns: calculateTrend(currentCompletedRuns.length, previousCompletedRuns.length, 'higher'),
      successRate: calculateTrend(currentSuccessRate, previousSuccessRate, 'higher'),
      avgCost: calculateTrend(currentAverageCost, previousAverageCost, 'lower'),
      avgDurationMs: calculateTrend(currentAverageDuration, previousAverageDuration, 'lower'),
      cleanRunRate: calculateTrend(currentCleanRate, previousCleanRate, 'higher'),
    },
  };
}

export function buildAlgorithmBenchmarks(points: HistoricalRunPoint[]): AlgorithmBenchmarkRow[] {
  const buckets = new Map<string, HistoricalRunPoint[]>();

  points.forEach((point) => {
    const current = buckets.get(point.algorithm) ?? [];
    current.push(point);
    buckets.set(point.algorithm, current);
  });

  return Array.from(buckets.entries())
    .map(([algorithm, algorithmRuns]) => {
      const completedRuns = algorithmRuns.filter((point) => point.status === 'completed');
      const failedRuns = algorithmRuns.filter((point) => point.status === 'failed');
      const cleanRuns = completedRuns.filter(
        (point) => point.cctViolations === 0 && point.softIssues === 0 && point.unassignedTrips === 0,
      );
      const successRate = percentage(completedRuns.length, algorithmRuns.length);
      const cleanRunRate = percentage(cleanRuns.length, completedRuns.length);
      const avgCost = average(completedRuns.map((point) => point.totalCost));
      const avgDurationMs = average(completedRuns.map((point) => point.durationMs));
      const avgVehicles = average(completedRuns.map((point) => point.totalVehicles));
      const avgCrew = average(completedRuns.map((point) => point.totalCrew));
      const avgCctViolations = average(completedRuns.map((point) => point.cctViolations));
      const avgSoftIssues = average(completedRuns.map((point) => point.softIssues));
      const avgUnassignedTrips = average(completedRuns.map((point) => point.unassignedTrips));
      const avgSameRosterRatio = average(
        completedRuns
          .map((point) => point.sameRosterRatio)
          .filter((value): value is number => value != null),
      );
      const bestRun = completedRuns
        .filter((point) => point.totalCost > 0)
        .slice()
        .sort((left, right) => left.totalCost - right.totalCost)[0] ?? null;

      return {
        algorithm,
        runCount: algorithmRuns.length,
        completedRuns: completedRuns.length,
        failedRuns: failedRuns.length,
        successRate,
        cleanRunRate,
        avgCost,
        avgDurationMs,
        avgVehicles,
        avgCrew,
        avgCctViolations,
        avgSoftIssues,
        avgUnassignedTrips,
        avgSameRosterRatio,
        operationalScore: calculateOperationalScore({
          successRate,
          cleanRunRate,
          avgSameRosterRatio,
          avgCctViolations,
          avgSoftIssues,
          avgUnassignedTrips,
        }),
        bestRun,
      };
    })
    .sort((left, right) => {
      const leftScore = left.operationalScore ?? -1;
      const rightScore = right.operationalScore ?? -1;
      if (leftScore !== rightScore) return rightScore - leftScore;

      const leftCost = left.avgCost ?? Number.POSITIVE_INFINITY;
      const rightCost = right.avgCost ?? Number.POSITIVE_INFINITY;
      if (leftCost !== rightCost) return leftCost - rightCost;

      return right.runCount - left.runCount;
    });
}

export function buildOperationalBaseline(points: HistoricalRunPoint[]): OperationalBaseline {
  const completedRuns = points.filter((point) => point.status === 'completed');
  const cleanRuns = completedRuns.filter(
    (point) => point.cctViolations === 0 && point.softIssues === 0 && point.unassignedTrips === 0,
  );
  const avgSameRosterRatio = average(
    completedRuns
      .map((point) => point.sameRosterRatio)
      .filter((value): value is number => value != null),
  );

  const successRate = percentage(completedRuns.length, points.length);
  const cleanRunRate = percentage(cleanRuns.length, completedRuns.length);
  const avgCctViolations = average(completedRuns.map((point) => point.cctViolations));
  const avgSoftIssues = average(completedRuns.map((point) => point.softIssues));
  const avgUnassignedTrips = average(completedRuns.map((point) => point.unassignedTrips));

  return {
    totalRuns: points.length,
    completedRuns: completedRuns.length,
    successRate,
    cleanRunRate,
    avgCost: average(completedRuns.map((point) => point.totalCost)),
    avgDurationMs: average(completedRuns.map((point) => point.durationMs)),
    avgVehicles: average(completedRuns.map((point) => point.totalVehicles)),
    avgCrew: average(completedRuns.map((point) => point.totalCrew)),
    avgCctViolations,
    avgSoftIssues,
    avgUnassignedTrips,
    avgSameRosterRatio,
    operationalScore: calculateOperationalScore({
      successRate,
      cleanRunRate,
      avgSameRosterRatio,
      avgCctViolations,
      avgSoftIssues,
      avgUnassignedTrips,
    }),
  };
}

function classifyAgainstBaseline(row: {
  operationalScoreGap: number | null;
  costDeltaPct: number | null;
  cleanRunRateGap: number | null;
  cctGap: number | null;
  softIssuesGap: number | null;
}): 'above' | 'watch' | 'below' {
  const scoreGap = row.operationalScoreGap ?? 0;
  const costDeltaPct = row.costDeltaPct ?? 0;
  const cleanRunRateGap = row.cleanRunRateGap ?? 0;
  const cctGap = row.cctGap ?? 0;
  const softIssuesGap = row.softIssuesGap ?? 0;

  if (scoreGap >= 3 && costDeltaPct <= 5 && cleanRunRateGap >= 0 && cctGap <= 0 && softIssuesGap <= 0) {
    return 'above';
  }

  if (scoreGap <= -3 || costDeltaPct >= 10 || cleanRunRateGap <= -5 || cctGap > 0.3 || softIssuesGap > 0.5) {
    return 'below';
  }

  return 'watch';
}

export function buildAlgorithmAuditRows(points: HistoricalRunPoint[]): {
  baseline: OperationalBaseline;
  rows: AlgorithmAuditRow[];
} {
  const baseline = buildOperationalBaseline(points);
  const rows = buildAlgorithmBenchmarks(points).map<AlgorithmAuditRow>((row) => {
    const operationalScoreGap = absoluteDelta(row.operationalScore, baseline.operationalScore, 1);
    const cleanRunRateGap = absoluteDelta(row.cleanRunRate, baseline.cleanRunRate, 1);
    const costDeltaPct = relativeDeltaPct(row.avgCost, baseline.avgCost);
    const durationDeltaPct = relativeDeltaPct(row.avgDurationMs, baseline.avgDurationMs);
    const cctGap = absoluteDelta(row.avgCctViolations, baseline.avgCctViolations, 2);
    const softIssuesGap = absoluteDelta(row.avgSoftIssues, baseline.avgSoftIssues, 2);

    return {
      ...row,
      operationalScoreGap,
      successRateGap: absoluteDelta(row.successRate, baseline.successRate, 1),
      cleanRunRateGap,
      costDeltaPct,
      durationDeltaPct,
      cctGap,
      softIssuesGap,
      sameRosterGap: absoluteDelta(row.avgSameRosterRatio, baseline.avgSameRosterRatio, 3),
      baselineTag: classifyAgainstBaseline({
        operationalScoreGap,
        costDeltaPct,
        cleanRunRateGap,
        cctGap,
        softIssuesGap,
      }),
    };
  });

  return { baseline, rows };
}