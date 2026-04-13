import { useEffect, useMemo, useRef } from 'react';
import { keepPreviousData, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  linesApi,
  terminalsApi,
  tripsApi,
  optimizationApi,
  optimizationSettingsApi,
  companiesApi,
  vehicleTypesApi,
  reportsApi,
  passengerConfigsApi,
  tripTimeConfigsApi,
  scheduleGroupsApi,
  schedulesApi,
  timetablesApi,
  usersApi,
} from './api';

type QueryListPayload<T> = T[] | { data?: T[] } | null | undefined;
type OptimizationRunLike = {
  id?: number | string;
  status?: string;
  finishedAt?: string | null;
  createdAt?: string | null;
};
type AdaptiveRefetchInterval = number | false | ((items: unknown[]) => number | false);

const LIVE_RUN_STATUSES = new Set(['running', 'pending']);
const OPTIMIZATION_SUMMARY_STALE_MS = 60_000;
const OPTIMIZATION_HISTORY_STALE_MS = 2 * 60_000;
const OPTIMIZATION_QUERY_GC_MS = 15 * 60_000;

function extractList<T>(value: QueryListPayload<T>): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray(value.data)) return value.data;
  return [];
}

function resolveAdaptiveRefetchInterval(
  interval: AdaptiveRefetchInterval | undefined,
  value: unknown,
): number | false | undefined {
  if (typeof interval === 'function') {
    return interval(extractList(value as QueryListPayload<unknown>));
  }

  return interval;
}

function hasLiveRuns(runs: OptimizationRunLike[]): boolean {
  return runs.some((run) => LIVE_RUN_STATUSES.has(run.status ?? ''));
}

function buildRunsListSignature(runs: OptimizationRunLike[]): string {
  return runs
    .slice(0, 8)
    .map((run) => [run.id ?? 'na', run.status ?? 'unknown', run.finishedAt ?? '', run.createdAt ?? ''].join(':'))
    .join('|');
}

// ── Keys ─────────────────────────────────────────────────────────────────────
export const queryKeys = {
  lines:       ['lines']       as const,
  terminals:   ['terminals']   as const,
  trips:       ['trips']       as const,
  companies:   ['companies']   as const,
  vehicleTypes:['vehicleTypes'] as const,
  users:       ['users']       as const,
  settings:    ['optimization-settings'] as const,
  settingsActive: ['optimization-settings', 'active'] as const,
  runs:        (companyId?: number) => ['optimization-runs', companyId ?? 'all'] as const,
  optimizationDashboard: (companyId?: number) => ['optimization-dashboard', companyId ?? 'all'] as const,
  optimizationKpis: (companyId?: number) => ['optimization-reports', 'kpis', companyId ?? 'all'] as const,
  optimizationHistory: (companyId?: number, days?: number) => ['optimization-reports', 'history', companyId ?? 'all', days ?? 'all'] as const,
  optimizationHistoryGroup: (companyId?: number) => ['optimization-reports', 'history', companyId ?? 'all'] as const,
  optimizationCompare: (run1?: number, run2?: number) => ['optimization-reports', 'compare', run1 ?? 'na', run2 ?? 'na'] as const,
  reports:     (type: string) => ['reports', type] as const,
  passengers:  ['passenger-configs'] as const,
  tripTimes:   ['trip-time-configs'] as const,
  scheduleGroups: ['schedule-groups'] as const,
  schedules:   ['schedules'] as const,
  timetables:  ['timetables'] as const,
} as const;

// ── Query hooks ──────────────────────────────────────────────────────────────
export function useLines() {
  return useQuery({ queryKey: queryKeys.lines, queryFn: () => linesApi.getAll() });
}

export function useTerminals() {
  return useQuery({ queryKey: queryKeys.terminals, queryFn: () => terminalsApi.getAll() });
}

export function useTrips() {
  return useQuery({ queryKey: queryKeys.trips, queryFn: () => tripsApi.getAll() });
}

export function useCompanies() {
  return useQuery({ queryKey: queryKeys.companies, queryFn: () => companiesApi.getAll() });
}

export function useVehicleTypes() {
  return useQuery({ queryKey: queryKeys.vehicleTypes, queryFn: () => vehicleTypesApi.getAll() });
}

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: () => usersApi.getAll() });
}

export function useOptimizationSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => optimizationSettingsApi.getAll() });
}

export function useActiveSettings(companyId?: number) {
  return useQuery({
    queryKey: [...queryKeys.settingsActive, companyId] as const,
    queryFn: () => optimizationSettingsApi.getActive(companyId),
    enabled: companyId != null,
  });
}

export function useOptimizationRuns(opts?: {
  companyId?: number;
  enabled?: boolean;
  refetchInterval?: AdaptiveRefetchInterval;
}) {
  return useQuery({
    queryKey: queryKeys.runs(opts?.companyId),
    queryFn: () => optimizationApi.getAll(opts?.companyId != null ? { companyId: opts.companyId } : undefined),
    enabled: opts?.enabled ?? true,
    refetchInterval: (query) => resolveAdaptiveRefetchInterval(opts?.refetchInterval, query.state.data),
  });
}

export function useOptimizationDashboard(
  companyId?: number,
  opts?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.optimizationDashboard(companyId),
    queryFn: () => optimizationApi.getDashboard(companyId ?? 0),
    enabled: opts?.enabled ?? (companyId != null),
    staleTime: OPTIMIZATION_SUMMARY_STALE_MS,
    gcTime: OPTIMIZATION_QUERY_GC_MS,
    placeholderData: keepPreviousData,
    refetchInterval: opts?.refetchInterval,
  });
}

export function useOptimizationKpis(
  companyId?: number,
  opts?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.optimizationKpis(companyId),
    queryFn: () => reportsApi.getKpis(companyId ?? 0),
    enabled: opts?.enabled ?? (companyId != null),
    staleTime: OPTIMIZATION_SUMMARY_STALE_MS,
    gcTime: OPTIMIZATION_QUERY_GC_MS,
    placeholderData: keepPreviousData,
    refetchInterval: opts?.refetchInterval,
  });
}

export function useOptimizationHistory(
  companyId?: number,
  days?: number,
  opts?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.optimizationHistory(companyId, days),
    queryFn: () => reportsApi.getHistory(companyId ?? 0, days),
    enabled: opts?.enabled ?? (companyId != null),
    staleTime: OPTIMIZATION_HISTORY_STALE_MS,
    gcTime: OPTIMIZATION_QUERY_GC_MS,
    placeholderData: keepPreviousData,
    refetchInterval: opts?.refetchInterval,
  });
}

export function useOptimizationComparison(
  run1?: number,
  run2?: number,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.optimizationCompare(run1, run2),
    queryFn: () => reportsApi.compare(run1 ?? 0, run2 ?? 0),
    enabled: opts?.enabled ?? (run1 != null && run2 != null && run1 !== run2),
    staleTime: OPTIMIZATION_SUMMARY_STALE_MS,
    gcTime: OPTIMIZATION_QUERY_GC_MS,
  });
}

export function useOptimizationLiveSync<T extends OptimizationRunLike = OptimizationRunLike>(
  companyId?: number,
  opts?: {
    enabled?: boolean;
    invalidateRelated?: boolean;
    idleIntervalMs?: number;
    liveIntervalMs?: number;
  },
) {
  const queryClient = useQueryClient();
  const previousSignatureRef = useRef<string | null>(null);
  const idleIntervalMs = opts?.idleIntervalMs ?? 30_000;
  const liveIntervalMs = opts?.liveIntervalMs ?? 5_000;

  const runsQuery = useOptimizationRuns({
    companyId,
    enabled: opts?.enabled ?? (companyId != null),
    refetchInterval: (items) => hasLiveRuns(items as OptimizationRunLike[]) ? liveIntervalMs : idleIntervalMs,
  });

  const runs = useMemo(
    () => extractList(runsQuery.data as QueryListPayload<T>),
    [runsQuery.data],
  );
  const activeRuns = useMemo(
    () => runs.filter((run) => LIVE_RUN_STATUSES.has(run.status ?? '')),
    [runs],
  );
  const activeRun = activeRuns[0] ?? null;
  const runsListSignature = useMemo(
    () => buildRunsListSignature(runs),
    [runs],
  );

  useEffect(() => {
    if (!opts?.invalidateRelated || companyId == null) {
      previousSignatureRef.current = runsListSignature;
      return;
    }

    const previousSignature = previousSignatureRef.current;
    previousSignatureRef.current = runsListSignature;

    if (previousSignature === runsListSignature) return;
    if (previousSignature == null && runsListSignature === '') return;

    void queryClient.invalidateQueries({ queryKey: queryKeys.optimizationDashboard(companyId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.optimizationKpis(companyId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.optimizationHistoryGroup(companyId) });
  }, [companyId, opts?.invalidateRelated, queryClient, runsListSignature]);

  return {
    ...runsQuery,
    activeRun,
    activeRuns,
    hasActiveRun: activeRun != null,
    runs,
    runsListSignature,
    syncIntervalMs: activeRun != null ? liveIntervalMs : idleIntervalMs,
  };
}

export function usePassengerConfigs() {
  return useQuery({ queryKey: queryKeys.passengers, queryFn: () => passengerConfigsApi.getAll() });
}

export function useTripTimeConfigs() {
  return useQuery({ queryKey: queryKeys.tripTimes, queryFn: () => tripTimeConfigsApi.getAll() });
}

export function useScheduleGroups() {
  return useQuery({ queryKey: queryKeys.scheduleGroups, queryFn: () => scheduleGroupsApi.getAll() });
}

export function useSchedules() {
  return useQuery({ queryKey: queryKeys.schedules, queryFn: () => schedulesApi.getAll() });
}

export function useTimetables() {
  return useQuery({ queryKey: queryKeys.timetables, queryFn: () => timetablesApi.getAll() });
}

// ── Mutation helper ──────────────────────────────────────────────────────────
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: readonly QueryKey[]) => {
    keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
  };
}
