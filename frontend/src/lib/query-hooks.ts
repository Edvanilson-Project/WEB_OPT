import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  runs:        ['optimization-runs'] as const,
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

export function useOptimizationRuns(opts?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: () => optimizationApi.getAll(),
    refetchInterval: opts?.refetchInterval,
  });
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
  return (...keys: readonly (readonly string[])[]) => {
    keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
  };
}
