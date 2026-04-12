/**
 * Funções utilitárias de formatação usadas pelas tabs de otimização.
 * Extraído de page.tsx para manter o componente principal limpo.
 */
import type {
  OptimizationRun, OptimizationSettings,
  OptimizationReproducibility, OptimizationPerformance,
  OptimizationComparisonMetric,
  OptimizationBlock, OptimizationDuty, TripDetail,
} from '../../_types';

// ── Helpers genéricos ──
export function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

export function toMinuteValue(value: unknown): number | null {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

// ── Moeda ──
export function fmtCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '--';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Duração ──
export function minToDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(Number(minutes))) return '--';
  const m = Math.floor(Math.abs(Number(minutes)));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min.toString().padStart(2, '0')}` : `${h}h`;
}

export function minToHHMM(minutes?: number | null): string {
  if (minutes == null || isNaN(Number(minutes))) return '--:--';
  const m = Math.abs(Number(minutes));
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

// ── Direção ──
export function directionLabel(direction?: 'outbound' | 'inbound' | string) {
  const normalized = direction?.toLowerCase();
  if (normalized === 'outbound' || normalized === 'ida') return 'Ida';
  if (normalized === 'inbound' || normalized === 'volta') return 'Volta';
  return 'Sem sentido';
}

// ── Chave → Título ──
export function labelizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ── Numéricos / sinalizados ──
export function fmtNumber(value?: number | null, suffix = ''): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
}

export function fmtSignedNumber(value?: number | null, suffix = ''): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const amount = Number(value);
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
}

export function fmtSignedCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const amount = Number(value);
  const absolute = Math.abs(amount).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
  if (amount > 0) return `+${absolute}`;
  if (amount < 0) return `-${absolute}`;
  return absolute;
}

export function fmtSignedPercent(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const amount = Number(value);
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

export function fmtElapsedMsCompact(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const totalMs = Number(value);
  if (Math.abs(totalMs) >= 1000) {
    return `${(totalMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`;
  }
  return `${Math.round(totalMs).toLocaleString('pt-BR')}ms`;
}

export function truncateMiddle(value?: string | null, head = 5, tail = 4): string {
  if (!value) return '--';
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}...${value.slice(-tail)}`;
}

// ── Comparação ──
export function formatComparisonValue(
  key: string,
  value?: number | null,
  category: 'metrics' | 'performance' = 'metrics',
  signed = false,
): string {
  const lowerKey = key.toLowerCase();
  if (
    category === 'performance' || lowerKey.includes('elapsed') ||
    lowerKey.endsWith('_ms') || lowerKey.includes('solver_ms') ||
    lowerKey.includes('validation_ms') || lowerKey.includes('enrichment_ms')
  ) {
    return signed ? fmtSignedNumber(value, 'ms') : fmtNumber(value, 'ms');
  }
  if (lowerKey.includes('cost')) return signed ? fmtSignedCurrency(value) : fmtCurrency(value);
  return signed ? fmtSignedNumber(value) : fmtNumber(value);
}

export type ComparisonPreference = 'lower' | 'higher' | 'neutral';

export function getComparisonPreference(
  key: string,
  category: 'metrics' | 'performance' = 'metrics',
): ComparisonPreference {
  if (category === 'performance') return 'lower';
  switch (key) {
    case 'vehicles': case 'crew': case 'totalCost': case 'cctViolations':
    case 'hardIssues': case 'softIssues': case 'unassignedTrips': case 'uncoveredBlocks':
      return 'lower';
    case 'totalTrips': return 'neutral';
    default: return key.toLowerCase().includes('cost') ? 'lower' : 'neutral';
  }
}

export function getComparisonDeltaStatus(
  metric: OptimizationComparisonMetric,
  preference: ComparisonPreference,
): { tone: 'success' | 'error' | 'neutral'; label: string } {
  if (!metric.delta) return { tone: 'neutral', label: 'Igual' };
  if (preference === 'neutral') return { tone: 'neutral', label: 'Mudou' };
  const improved = preference === 'lower' ? metric.delta < 0 : metric.delta > 0;
  return improved ? { tone: 'success', label: 'Melhora' } : { tone: 'error', label: 'Piora' };
}

// ── Reprodutibilidade ──
export function readReproValue<T = unknown>(
  reproducibility: OptimizationReproducibility | null | undefined,
  snakeKey: keyof OptimizationReproducibility,
  camelKey?: keyof OptimizationReproducibility,
): T | null {
  const camelValue = camelKey ? reproducibility?.[camelKey] : undefined;
  return (camelValue ?? reproducibility?.[snakeKey] ?? null) as T | null;
}

export function getRunAuditSnapshot(run: OptimizationRun): {
  inputHash: string | null;
  paramsHash: string | null;
  timeBudgetS: number | null;
  totalElapsedMs: number | null;
} {
  const params = asRecord(run.params) ?? {};
  const resolvedParams = asRecord(params.resolved) ?? {};
  const versioning = asRecord(params.versioning);
  const resultSummary = asRecord(run.resultSummary) ?? {};
  const meta = asRecord(resultSummary.meta) ?? {};
  const reproducibility = (resultSummary.reproducibility ?? meta.reproducibility ?? null) as OptimizationReproducibility | null;
  const performance = (resultSummary.performance ?? meta.performance ?? null) as OptimizationPerformance | null;
  const timeBudgetValue =
    readReproValue<number>(reproducibility, 'time_budget_s', 'timeBudgetS') ??
    resolvedParams.timeBudgetSeconds ?? params.timeBudgetSeconds ?? null;
  const elapsedValue = performance?.total_elapsed_ms ?? run.durationMs ?? null;

  return {
    inputHash:
      readReproValue<string>(reproducibility, 'input_hash', 'inputHash') ??
      (typeof versioning?.inputHash === 'string' ? versioning.inputHash : null),
    paramsHash: readReproValue<string>(reproducibility, 'params_hash', 'paramsHash') ?? null,
    timeBudgetS: Number.isFinite(Number(timeBudgetValue)) ? Number(timeBudgetValue) : null,
    totalElapsedMs: Number.isFinite(Number(elapsedValue)) ? Number(elapsedValue) : null,
  };
}

// ── Display Windows ──
export function getDutyDisplayWindow(duty: OptimizationDuty): { start: number | null; end: number | null } {
  const meta = asRecord(duty.meta);
  return {
    start: toMinuteValue(meta?.duty_start_minutes) ?? toMinuteValue(duty.start_time),
    end: toMinuteValue(meta?.duty_end_minutes) ?? toMinuteValue(duty.end_time),
  };
}

export function getBlockDisplayWindow(block: OptimizationBlock | Record<string, any>): { start: number | null; end: number | null } {
  const meta = asRecord((block as any).meta);
  return {
    start: toMinuteValue(meta?.operational_start_minutes) ?? toMinuteValue((block as any).start_time),
    end: toMinuteValue(meta?.operational_end_minutes) ?? toMinuteValue((block as any).end_time),
  };
}

export function getTripPublicId(trip: Partial<TripDetail> | Record<string, any>): number | null {
  const value = (trip as any).trip_id ?? (trip as any).id;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

// ── Terminais ──
export function getTerminalDisplayName(
  terminalId: number | string | null | undefined,
  terminalName: string | null | undefined,
  terminalsMap: Record<string, string>,
): string {
  if (terminalId != null) {
    const mapped = terminalsMap[String(terminalId)];
    if (mapped) return mapped;
  }
  if (terminalName) return terminalName;
  if (terminalId != null) return String(terminalId);
  return '--';
}

// ── Trip Intervals ──
export type TripIntervalClassification = 'intervalo_normal' | 'descanso_refeicao' | 'ociosa';
export type TripIntervalViewScope = 'crew' | 'vehicle';

export interface TripIntervalPolicy {
  minBreakMinutes: number;
  mealBreakMinutes: number;
  minLayoverMinutes: number;
  connectionToleranceMinutes: number;
}

export function buildTripIntervalPolicy(
  run: OptimizationRun,
  activeSettings: OptimizationSettings | null,
): TripIntervalPolicy {
  const resolved = getResolvedRunParams(run);
  return {
    minBreakMinutes: toMinuteValue(resolved.cct.min_break_minutes) ?? activeSettings?.cctMinBreakMinutes ?? 30,
    mealBreakMinutes: toMinuteValue(resolved.cct.meal_break_minutes) ?? activeSettings?.cctMealBreakMinutes ?? 60,
    minLayoverMinutes: toMinuteValue(resolved.vsp.min_layover_minutes) ?? toMinuteValue(resolved.cct.min_layover_minutes) ?? activeSettings?.cctMinLayoverMinutes ?? 8,
    connectionToleranceMinutes: toMinuteValue(resolved.cct.connection_tolerance_minutes) ?? activeSettings?.connectionToleranceMinutes ?? 0,
  };
}

export function getResolvedRunParams(run: OptimizationRun): { cct: Record<string, any>; vsp: Record<string, any> } {
  const params = asRecord(run.params);
  const resolved = asRecord(params?.resolved);
  return { cct: asRecord(resolved?.cct) ?? {}, vsp: asRecord(resolved?.vsp) ?? {} };
}

export function getTripIntervalClassificationLabel(classification: TripIntervalClassification): string {
  if (classification === 'descanso_refeicao') return 'Descanso/Refeição';
  if (classification === 'ociosa') return 'Ociosa';
  return 'Intervalo Normal';
}

export function getTripIntervalClassificationColor(classification: TripIntervalClassification): 'default' | 'success' | 'warning' {
  if (classification === 'descanso_refeicao') return 'success';
  if (classification === 'ociosa') return 'warning';
  return 'default';
}

export function classifyTripInterval({
  gapMinutes, isBoundary, isMealBreakWindow, viewScope,
}: {
  gapMinutes: number; isBoundary: boolean; isMealBreakWindow: boolean; viewScope: TripIntervalViewScope;
}): TripIntervalClassification {
  if (gapMinutes <= 0) return 'intervalo_normal';
  if (isBoundary) return 'ociosa';
  if (viewScope === 'crew' && isMealBreakWindow) return 'descanso_refeicao';
  return 'intervalo_normal';
}

export type IdleWindow = {
  start: number;
  end: number;
  duration: number;
  kind: 'apoio' | TripIntervalClassification;
};

export function formatIdleWindowLabel(window: IdleWindow): string {
  const prefix = window.kind === 'apoio' ? 'Apoio' : getTripIntervalClassificationLabel(window.kind);
  return `${prefix} ${minToHHMM(window.start)}-${minToHHMM(window.end)} (${minToDuration(window.duration)})`;
}
