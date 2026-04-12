'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Grid, Typography, Button, Stack, Tooltip,
  IconButton, Chip, Divider, LinearProgress, Alert, AlertTitle,
  TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Paper, Collapse, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Badge,
  alpha, useTheme,
} from '@mui/material';
import {
  IconPlayerPlay, IconRefresh, IconChartBar,
  IconRobot, IconCurrencyDollar,
  IconBus, IconUsers, IconAlertTriangle,
  IconChevronDown, IconChevronUp, IconRoute, IconListDetails,
  IconFileCode, IconShieldCheck, IconX, IconCheck,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import { OtimizPageHero, OtimizPanel, OtimizToolbar } from '../_components/OtimizUI';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { optimizationApi, optimizationSettingsApi, linesApi, terminalsApi, getSessionUser } from '@/lib/api';
import type {
  Line, OptimizationRun, OptimizationSettings, OptimizationResultSummary,
  OptimizationBlock, OptimizationDuty, TripDetail, OptimizationAlgorithm,
  OptimizationStructuredIssue, Terminal, OptimizationRunAudit,
  OptimizationRunComparison, OptimizationPerformance, OptimizationReproducibility,
  OptimizationComparisonMetric,
} from '../_types';
import { extractArray } from '../_types';

// ─── Utils ───
function fmtCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '--';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function minToDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(Number(minutes))) return '--';
  const m = Math.floor(Math.abs(Number(minutes)));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min.toString().padStart(2, '0')}` : `${h}h`;
}

function minToHHMM(minutes?: number | null): string {
  if (minutes == null || isNaN(Number(minutes))) return '--:--';
  const m = Math.abs(Number(minutes));
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function directionLabel(direction?: 'outbound' | 'inbound' | string) {
  const normalized = direction?.toLowerCase();
  if (normalized === 'outbound' || normalized === 'ida') return 'Ida';
  if (normalized === 'inbound' || normalized === 'volta') return 'Volta';
  return 'Sem sentido';
}

function labelizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fmtNumber(value?: number | null, suffix = ''): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
}

function readReproValue<T = unknown>(
  reproducibility: OptimizationReproducibility | null | undefined,
  snakeKey: keyof OptimizationReproducibility,
  camelKey?: keyof OptimizationReproducibility,
): T | null {
  const camelValue = camelKey ? reproducibility?.[camelKey] : undefined;
  return (camelValue ?? reproducibility?.[snakeKey] ?? null) as T | null;
}

function toMinuteValue(value: unknown): number | null {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function getDutyDisplayWindow(duty: OptimizationDuty): { start: number | null; end: number | null } {
  const meta = asRecord(duty.meta);
  return {
    start: toMinuteValue(meta?.duty_start_minutes) ?? toMinuteValue(duty.start_time),
    end: toMinuteValue(meta?.duty_end_minutes) ?? toMinuteValue(duty.end_time),
  };
}

function getBlockDisplayWindow(block: OptimizationBlock | Record<string, any>): { start: number | null; end: number | null } {
  const meta = asRecord((block as any).meta);
  return {
    start: toMinuteValue(meta?.operational_start_minutes) ?? toMinuteValue((block as any).start_time),
    end: toMinuteValue(meta?.operational_end_minutes) ?? toMinuteValue((block as any).end_time),
  };
}

function getTripPublicId(trip: Partial<TripDetail> | Record<string, any>): number | null {
  const value = (trip as any).trip_id ?? (trip as any).id;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

interface DutyTripAssignment {
  dutyId?: number | string;
  rosterId?: number | string | null;
  operatorId?: number | string | null;
  operatorName?: string | null;
}

interface TripIntervalAssignmentContext {
  dutyId?: number | string | null;
  operatorId?: number | string | null;
  operatorName?: string | null;
  sameAssignment: boolean;
}

function buildDutyAssignmentsByPublicTripId(duties: OptimizationDuty[]): Record<number, DutyTripAssignment[]> {
  const assignmentMap: Record<number, DutyTripAssignment[]> = {};

  duties.forEach((duty) => {
    const meta = asRecord(duty.meta);
    const assignment: DutyTripAssignment = {
      dutyId: duty.duty_id,
      rosterId: meta?.roster_id ?? null,
      operatorId: meta?.operator_id ?? null,
      operatorName: meta?.operator_name ?? null,
    };

    (duty.trips || []).forEach((trip) => {
      const publicTripId = getTripPublicId(trip);
      if (publicTripId == null) return;

      const existing = assignmentMap[publicTripId] ?? [];
      const alreadyPresent = existing.some((item) => (
        item.dutyId === assignment.dutyId
        && item.rosterId === assignment.rosterId
        && item.operatorId === assignment.operatorId
      ));

      if (!alreadyPresent) {
        assignmentMap[publicTripId] = [...existing, assignment];
      }
    });
  });

  return assignmentMap;
}

function buildDutyMealBreakIntervalKey(
  dutyId: number | string | null | undefined,
  previousTrip: Partial<TripDetail> | Record<string, any>,
  nextTrip: Partial<TripDetail> | Record<string, any>,
): string | null {
  if (dutyId == null) return null;

  const previousTripId = getTripPublicId(previousTrip);
  const nextTripId = getTripPublicId(nextTrip);

  if (previousTripId == null || nextTripId == null) return null;
  return `${String(dutyId)}:${previousTripId}:${nextTripId}`;
}

function buildDutyMealBreakIntervalKeys(
  duties: OptimizationDuty[],
  policy: TripIntervalPolicy,
): Set<string> {
  const keys = new Set<string>();

  if (policy.mealBreakMinutes <= 0) return keys;

  duties.forEach((duty) => {
    const meta = asRecord(duty.meta);
    const mealBreakFound = Boolean(meta?.meal_break_found);
    if (!mealBreakFound) return;

    const connectionToleranceMinutes =
      toMinuteValue(meta?.connection_tolerance_minutes) ??
      policy.connectionToleranceMinutes;

    const sortedTrips = (duty.trips || [])
      .filter((trip): trip is TripDetail => typeof trip === 'object' && trip != null)
      .slice()
      .sort((left, right) => (left.start_time ?? 0) - (right.start_time ?? 0));

    for (let index = 1; index < sortedTrips.length; index += 1) {
      const previousTrip = sortedTrips[index - 1];
      const nextTrip = sortedTrips[index];
      const rawGap = (nextTrip.start_time ?? 0) - (previousTrip.end_time ?? 0);
      if (rawGap <= 0) continue;

      const sameTerminal =
        previousTrip.destination_id != null &&
        nextTrip.origin_id != null &&
        String(previousTrip.destination_id) === String(nextTrip.origin_id);

      if (!sameTerminal) continue;

      const effectiveGap = rawGap + connectionToleranceMinutes;
      if (effectiveGap < policy.mealBreakMinutes) continue;

      const key = buildDutyMealBreakIntervalKey(
        duty.duty_id,
        previousTrip,
        nextTrip,
      );

      if (key) {
        keys.add(key);
        break;
      }
    }
  });

  return keys;
}

function getTripAssignments(
  trip: TripDetail | undefined,
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>,
): DutyTripAssignment[] {
  if (!trip || !dutyAssignmentsByPublicTripId) return [];

  const publicTripId = getTripPublicId(trip);
  if (publicTripId == null) return [];
  return dutyAssignmentsByPublicTripId[publicTripId] ?? [];
}

function resolveTripIntervalAssignmentContext({
  previousTrip,
  nextTrip,
  defaultAssignment,
  dutyAssignmentsByPublicTripId,
}: {
  previousTrip?: TripDetail;
  nextTrip?: TripDetail;
  defaultAssignment?: DutyTripAssignment | null;
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>;
}): TripIntervalAssignmentContext {
  if (defaultAssignment?.dutyId != null || defaultAssignment?.operatorId != null) {
    return {
      dutyId: defaultAssignment.dutyId ?? null,
      operatorId: defaultAssignment.operatorId ?? null,
      operatorName: defaultAssignment.operatorName ?? null,
      sameAssignment: true,
    };
  }

  if (
    previousTrip?.duty_id != null &&
    nextTrip?.duty_id != null &&
    String(previousTrip.duty_id) === String(nextTrip.duty_id)
  ) {
    return {
      dutyId: previousTrip.duty_id,
      operatorId:
        previousTrip.operator_id != null &&
        nextTrip?.operator_id != null &&
        String(previousTrip.operator_id) === String(nextTrip.operator_id)
          ? previousTrip.operator_id
          : null,
      operatorName:
        previousTrip.operator_name &&
        nextTrip?.operator_name &&
        previousTrip.operator_name === nextTrip.operator_name
          ? previousTrip.operator_name
          : previousTrip.operator_name ?? nextTrip?.operator_name ?? null,
      sameAssignment: true,
    };
  }

  const previousAssignments = getTripAssignments(
    previousTrip,
    dutyAssignmentsByPublicTripId,
  );
  const nextAssignments = getTripAssignments(
    nextTrip,
    dutyAssignmentsByPublicTripId,
  );

  const sharedDuty = previousAssignments.find((previousAssignment) =>
    nextAssignments.some(
      (nextAssignment) =>
        previousAssignment.dutyId != null &&
        nextAssignment.dutyId != null &&
        String(previousAssignment.dutyId) === String(nextAssignment.dutyId),
    ),
  );

  if (sharedDuty) {
    return {
      dutyId: sharedDuty.dutyId ?? null,
      operatorId: sharedDuty.operatorId ?? null,
      operatorName: sharedDuty.operatorName ?? null,
      sameAssignment: true,
    };
  }

  const sharedOperator = previousAssignments.find((previousAssignment) =>
    nextAssignments.some(
      (nextAssignment) =>
        previousAssignment.operatorId != null &&
        nextAssignment.operatorId != null &&
        String(previousAssignment.operatorId) === String(nextAssignment.operatorId),
    ),
  );

  if (sharedOperator) {
    return {
      dutyId: sharedOperator.dutyId ?? null,
      operatorId: sharedOperator.operatorId ?? null,
      operatorName: sharedOperator.operatorName ?? null,
      sameAssignment: true,
    };
  }

  return {
    dutyId: null,
    operatorId: null,
    operatorName: null,
    sameAssignment: false,
  };
}

interface ResolvedRunParams {
  cct: Record<string, any>;
  vsp: Record<string, any>;
}

type TripIntervalClassification = 'intervalo_normal' | 'descanso_refeicao' | 'ociosa';
type TripIntervalViewScope = 'crew' | 'vehicle';

interface TripIntervalPolicy {
  minBreakMinutes: number;
  mealBreakMinutes: number;
  minLayoverMinutes: number;
  connectionToleranceMinutes: number;
}

interface TripIntervalDisplayRow {
  classification: TripIntervalClassification;
  start: number;
  end: number;
  originId?: number | string | null;
  destinationId?: number | string | null;
  originName?: string;
  destinationName?: string;
  duration: number;
  recordLabel: string;
  recordHint: string;
}

function getResolvedRunParams(run: OptimizationRun): ResolvedRunParams {
  const params = asRecord(run.params);
  const resolved = asRecord(params?.resolved);
  return {
    cct: asRecord(resolved?.cct) ?? {},
    vsp: asRecord(resolved?.vsp) ?? {},
  };
}

function buildTripIntervalPolicy(
  run: OptimizationRun,
  activeSettings: OptimizationSettings | null,
): TripIntervalPolicy {
  const resolved = getResolvedRunParams(run);
  return {
    minBreakMinutes:
      toMinuteValue(resolved.cct.min_break_minutes) ??
      activeSettings?.cctMinBreakMinutes ??
      30,
    mealBreakMinutes:
      toMinuteValue(resolved.cct.meal_break_minutes) ??
      activeSettings?.cctMealBreakMinutes ??
      60,
    minLayoverMinutes:
      toMinuteValue(resolved.vsp.min_layover_minutes) ??
      toMinuteValue(resolved.cct.min_layover_minutes) ??
      activeSettings?.cctMinLayoverMinutes ??
      8,
    connectionToleranceMinutes:
      toMinuteValue(resolved.cct.connection_tolerance_minutes) ??
      activeSettings?.connectionToleranceMinutes ??
      0,
  };
}

function getTerminalDisplayName(
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

function getTripIntervalClassificationLabel(
  classification: TripIntervalClassification,
): string {
  if (classification === 'descanso_refeicao') return 'Descanso/Refeição';
  if (classification === 'ociosa') return 'Ociosa';
  return 'Intervalo Normal';
}

function getTripIntervalClassificationColor(
  classification: TripIntervalClassification,
): 'default' | 'success' | 'warning' {
  if (classification === 'descanso_refeicao') return 'success';
  if (classification === 'ociosa') return 'warning';
  return 'default';
}

function classifyTripInterval({
  gapMinutes,
  isBoundary,
  isMealBreakWindow,
  viewScope,
}: {
  gapMinutes: number;
  isBoundary: boolean;
  isMealBreakWindow: boolean;
  viewScope: TripIntervalViewScope;
}): TripIntervalClassification {
  if (gapMinutes <= 0) return 'intervalo_normal';
  if (isBoundary) return 'ociosa';
  if (viewScope === 'crew' && isMealBreakWindow) return 'descanso_refeicao';
  return 'intervalo_normal';
}

function buildTripIntervalDisplayRow({
  start,
  end,
  previousTrip,
  nextTrip,
  boundaryKind,
  policy,
  viewScope,
  defaultAssignment,
  dutyAssignmentsByPublicTripId,
  mealBreakIntervalKeys,
}: {
  start: number;
  end: number;
  previousTrip?: TripDetail;
  nextTrip?: TripDetail;
  boundaryKind?: 'initial' | 'final';
  policy: TripIntervalPolicy;
  viewScope: TripIntervalViewScope;
  defaultAssignment?: DutyTripAssignment | null;
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>;
  mealBreakIntervalKeys?: Set<string>;
}): TripIntervalDisplayRow | null {
  const duration = Math.max(0, end - start);
  if (duration <= 0) return null;

  const originId = previousTrip?.destination_id ?? nextTrip?.origin_id ?? null;
  const destinationId = nextTrip?.origin_id ?? previousTrip?.destination_id ?? null;
  const originName = previousTrip?.destination_name ?? nextTrip?.origin_name;
  const destinationName = nextTrip?.origin_name ?? previousTrip?.destination_name;
  const sameTerminal =
    originId != null &&
    destinationId != null &&
    String(originId) === String(destinationId);
  const assignmentContext = resolveTripIntervalAssignmentContext({
    previousTrip,
    nextTrip,
    defaultAssignment,
    dutyAssignmentsByPublicTripId,
  });
  const mealBreakIntervalKey =
    previousTrip && nextTrip && assignmentContext.dutyId != null
      ? buildDutyMealBreakIntervalKey(
          assignmentContext.dutyId,
          previousTrip,
          nextTrip,
        )
      : null;
  const isMealBreakWindow =
    mealBreakIntervalKey != null &&
    (mealBreakIntervalKeys?.has(mealBreakIntervalKey) ?? false);
  const classification = classifyTripInterval({
    gapMinutes: duration,
    isBoundary: boundaryKind != null,
    isMealBreakWindow:
      viewScope === 'crew' &&
      previousTrip != null &&
      nextTrip != null &&
      assignmentContext.sameAssignment &&
      sameTerminal &&
      isMealBreakWindow,
    viewScope,
  });
  const previousTripId = previousTrip ? getTripPublicId(previousTrip) : null;
  const nextTripId = nextTrip ? getTripPublicId(nextTrip) : null;

  let recordLabel = 'Janela intermediária';
  let recordHint = 'Intervalo derivado da sequência real de viagens.';

  if (boundaryKind === 'initial') {
    recordLabel = 'Janela inicial';
    recordHint =
      viewScope === 'crew'
        ? 'Janela ociosa antes da primeira viagem da jornada.'
        : 'Janela ociosa do veículo antes da primeira viagem do bloco.';
  } else if (boundaryKind === 'final') {
    recordLabel = 'Janela final';
    recordHint =
      viewScope === 'crew'
        ? 'Janela ociosa após a última viagem da jornada.'
        : 'Janela ociosa do veículo após a última viagem do bloco.';
  } else if (previousTripId != null && nextTripId != null) {
    recordLabel = `Entre #${previousTripId} e #${nextTripId}`;
    if (viewScope === 'vehicle') {
      if (!assignmentContext.sameAssignment) {
        recordHint = 'Troca de tripulante entre viagens; para o veículo isso segue como intervalo operacional.';
      } else if (!sameTerminal) {
        recordHint = 'Troca de terminal no bloco; intervalo operacional entre viagens do veículo.';
      } else if (duration <= policy.connectionToleranceMinutes) {
        recordHint = `Conexão curta do veículo dentro da tolerância (${policy.connectionToleranceMinutes} min).`;
      } else if (duration < policy.minLayoverMinutes) {
        recordHint = `Intervalo do veículo abaixo do layover alvo (${policy.minLayoverMinutes} min).`;
      } else {
        recordHint = 'Intervalo operacional normal entre viagens do veículo.';
      }
    } else if (!assignmentContext.sameAssignment) {
      recordHint = 'Troca de plantão/tripulante entre viagens; não caracteriza pausa regulatória da mesma jornada.';
    } else if (!sameTerminal) {
      recordHint = 'Troca de terminal entre viagens; não é pausa regulatória.';
    } else if (classification === 'descanso_refeicao') {
      const operatorSuffix = assignmentContext.operatorName
        ? ` para ${assignmentContext.operatorName}`
        : '';
      recordHint = `Pausa regulatória reconhecida${operatorSuffix} nesta jornada.`;
    } else if (
      policy.mealBreakMinutes > 0 &&
      duration + policy.connectionToleranceMinutes >= policy.mealBreakMinutes
    ) {
      recordHint = 'Janela longa no mesmo terminal, mas a jornada já utilizou outra pausa como descanso/refeição real.';
    } else if (duration <= policy.connectionToleranceMinutes) {
      recordHint = `Mesmo terminal; conexão curta dentro da tolerância (${policy.connectionToleranceMinutes} min).`;
    } else if (duration < policy.minLayoverMinutes) {
      recordHint = `Mesmo terminal; conexão abaixo do layover alvo (${policy.minLayoverMinutes} min).`;
    } else {
      recordHint = 'Mesmo terminal; intervalo operacional normal entre viagens.';
    }
  }

  return {
    classification,
    start,
    end,
    originId,
    destinationId,
    originName,
    destinationName,
    duration,
    recordLabel,
    recordHint,
  };
}

function truncateMiddle(value?: string | null, head = 5, tail = 4): string {
  if (!value) return '--';
  return value.length <= head + tail + 1
    ? value
    : `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function fmtElapsedMsCompact(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const totalMs = Number(value);
  if (Math.abs(totalMs) >= 1000) {
    return `${(totalMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`;
  }
  return `${Math.round(totalMs).toLocaleString('pt-BR')}ms`;
}

function fmtSignedNumber(value?: number | null, suffix = ''): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const amount = Number(value);
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
}

function fmtSignedCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const amount = Number(value);
  const absolute = Math.abs(amount).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (amount > 0) return `+${absolute}`;
  if (amount < 0) return `-${absolute}`;
  return absolute;
}

function fmtSignedPercent(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  const amount = Number(value);
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function formatComparisonValue(
  key: string,
  value?: number | null,
  category: 'metrics' | 'performance' = 'metrics',
  signed = false,
): string {
  const lowerKey = key.toLowerCase();
  if (
    category === 'performance' ||
    lowerKey.includes('elapsed') ||
    lowerKey.endsWith('_ms') ||
    lowerKey.includes('solver_ms') ||
    lowerKey.includes('validation_ms') ||
    lowerKey.includes('enrichment_ms')
  ) {
    return signed ? fmtSignedNumber(value, 'ms') : fmtNumber(value, 'ms');
  }

  if (lowerKey.includes('cost')) {
    return signed ? fmtSignedCurrency(value) : fmtCurrency(value);
  }

  return signed ? fmtSignedNumber(value) : fmtNumber(value);
}

type ComparisonPreference = 'lower' | 'higher' | 'neutral';

function getComparisonPreference(
  key: string,
  category: 'metrics' | 'performance' = 'metrics',
): ComparisonPreference {
  if (category === 'performance') return 'lower';

  switch (key) {
    case 'vehicles':
    case 'crew':
    case 'totalCost':
    case 'cctViolations':
    case 'hardIssues':
    case 'softIssues':
    case 'unassignedTrips':
    case 'uncoveredBlocks':
      return 'lower';
    case 'totalTrips':
      return 'neutral';
    default:
      return key.toLowerCase().includes('cost') ? 'lower' : 'neutral';
  }
}

function getComparisonDeltaStatus(
  metric: OptimizationComparisonMetric,
  preference: ComparisonPreference,
): { tone: 'success' | 'error' | 'neutral'; label: string } {
  if (!metric.delta) {
    return { tone: 'neutral', label: 'Igual' };
  }

  if (preference === 'neutral') {
    return { tone: 'neutral', label: 'Mudou' };
  }

  const improved = preference === 'lower' ? metric.delta < 0 : metric.delta > 0;
  return improved
    ? { tone: 'success', label: 'Melhora' }
    : { tone: 'error', label: 'Piora' };
}

function getRunAuditSnapshot(run: OptimizationRun): {
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
  const reproducibility =
    (resultSummary.reproducibility ??
      meta.reproducibility ??
      null) as OptimizationReproducibility | null;
  const performance =
    (resultSummary.performance ?? meta.performance ?? null) as OptimizationPerformance | null;
  const timeBudgetValue =
    readReproValue<number>(reproducibility, 'time_budget_s', 'timeBudgetS') ??
    resolvedParams.timeBudgetSeconds ??
    params.timeBudgetSeconds ??
    null;
  const elapsedValue = performance?.total_elapsed_ms ?? run.durationMs ?? null;

  return {
    inputHash:
      readReproValue<string>(reproducibility, 'input_hash', 'inputHash') ??
      (typeof versioning?.inputHash === 'string' ? versioning.inputHash : null),
    paramsHash:
      readReproValue<string>(reproducibility, 'params_hash', 'paramsHash') ?? null,
    timeBudgetS: Number.isFinite(Number(timeBudgetValue)) ? Number(timeBudgetValue) : null,
    totalElapsedMs: Number.isFinite(Number(elapsedValue)) ? Number(elapsedValue) : null,
  };
}

type IdleWindow = {
  start: number;
  end: number;
  duration: number;
  kind: 'apoio' | TripIntervalClassification;
};

function formatIdleWindowLabel(window: IdleWindow): string {
  const prefix =
    window.kind === 'apoio'
      ? 'Apoio'
      : getTripIntervalClassificationLabel(window.kind);
  return `${prefix} ${minToHHMM(window.start)}-${minToHHMM(window.end)} (${minToDuration(window.duration)})`;
}

function ComparisonDeltaCell({
  metric,
  metricKey,
  category = 'metrics',
}: {
  metric: OptimizationComparisonMetric;
  metricKey: string;
  category?: 'metrics' | 'performance';
}) {
  const theme = useTheme();
  const deltaStatus = getComparisonDeltaStatus(
    metric,
    getComparisonPreference(metricKey, category),
  );
  const toneColor =
    deltaStatus.tone === 'success'
      ? theme.palette.success.main
      : deltaStatus.tone === 'error'
        ? theme.palette.error.main
        : theme.palette.text.secondary;

  return (
    <Stack alignItems="flex-end" spacing={0.4}>
      <Typography variant="body2" fontWeight={800} color={toneColor}>
        {formatComparisonValue(metricKey, metric.delta, category, true)}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center">
        {!!metric.delta && (
          <Typography variant="caption" color="text.secondary">
            {fmtSignedPercent(metric.pctDelta)}
          </Typography>
        )}
        <Chip
          size="small"
          variant={deltaStatus.tone === 'neutral' ? 'outlined' : 'filled'}
          color={deltaStatus.tone === 'neutral' ? 'default' : deltaStatus.tone}
          label={deltaStatus.label}
          sx={{
            height: 18,
            '& .MuiChip-label': { px: 0.75, fontSize: 9, fontWeight: 800 },
          }}
        />
      </Stack>
    </Stack>
  );
}

function RunHistorySummary({ run }: { run: OptimizationRun }) {
  const { totalElapsedMs } = getRunAuditSnapshot(run);

  if (totalElapsedMs == null) return null;

  return (
    <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
      Solver: {fmtElapsedMsCompact(totalElapsedMs)}
    </Typography>
  );
}

// ─── Component: Timeline Graphic ───
function TripTimeline({ trips, start, end, totalDuration }: { trips: TripDetail[], start: number, end: number, totalDuration: number }) {
  if (!totalDuration || totalDuration <= 0) return null;
  
  return (
    <Box sx={{ position: 'relative', height: 26, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      {trips.map((t, i) => {
        const left = ((t.start_time - start) / totalDuration) * 100;
        const width = ((t.end_time - t.start_time) / totalDuration) * 100;
        const isPull = t.is_pull_out || t.is_pull_back;
        
        return (
          <Tooltip key={i} title={`${minToHHMM(t.start_time)} - ${minToHHMM(t.end_time)} | #${t.id}`}>
            <Box
              sx={{
                position: 'absolute',
                top: 2,
                bottom: 2,
                left: `${left}%`,
                width: `${width}%`,
                bgcolor: isPull ? 'warning.main' : 'primary.main',
                borderRadius: 0.5,
                opacity: 0.85,
                '&:hover': { opacity: 1, zIndex: 10, outline: '1px solid white' },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

// ─── Component: Detailed Trip Table ───
function TripDetailTable({
  trips,
  dutyId,
  linesMap = {},
  terminalsMap = {},
  windowStart,
  windowEnd,
  intervalPolicy,
  viewScope,
  defaultAssignment,
  dutyAssignmentsByPublicTripId,
  mealBreakIntervalKeys,
  extraColumnLabel,
  renderExtraColumn,
}: {
  trips: TripDetail[];
  dutyId?: string | number;
  linesMap?: Record<string, string>;
  terminalsMap?: Record<string, string>;
  windowStart?: number | null;
  windowEnd?: number | null;
  intervalPolicy: TripIntervalPolicy;
  viewScope: TripIntervalViewScope;
  defaultAssignment?: DutyTripAssignment | null;
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>;
  mealBreakIntervalKeys?: Set<string>;
  extraColumnLabel?: string;
  renderExtraColumn?: (trip: TripDetail) => React.ReactNode;
}) {
  const sorted = trips.slice().sort((a,b) => (a.start_time ?? 0) - (b.start_time ?? 0));
  const firstTrip = sorted[0];
  const lastTrip = sorted[sorted.length - 1];
  const initialGap =
    windowStart != null && firstTrip?.start_time != null ? Math.max(0, firstTrip.start_time - windowStart) : 0;
  const finalGap =
    windowEnd != null && lastTrip?.end_time != null ? Math.max(0, windowEnd - lastTrip.end_time) : 0;

  const rows: Array<
    | { key: string; kind: 'interval'; interval: TripIntervalDisplayRow }
    | { key: string; kind: 'trip'; trip: TripDetail }
  > = [];

  if (initialGap > 0 && firstTrip && windowStart != null) {
    const initialInterval = buildTripIntervalDisplayRow({
      start: windowStart,
      end: firstTrip.start_time,
      nextTrip: firstTrip,
      boundaryKind: 'initial',
      policy: intervalPolicy,
      viewScope,
      defaultAssignment,
      dutyAssignmentsByPublicTripId,
      mealBreakIntervalKeys,
    });
    if (initialInterval) {
      rows.push({
        key: `interval-initial-${dutyId ?? 'window'}-${getTripPublicId(firstTrip) ?? firstTrip.id}`,
        kind: 'interval',
        interval: initialInterval,
      });
    }
  }

  sorted.forEach((trip, index) => {
    if (index > 0) {
      const previousTrip = sorted[index - 1];
      const internalInterval = buildTripIntervalDisplayRow({
        start: previousTrip.end_time,
        end: trip.start_time,
        previousTrip,
        nextTrip: trip,
        policy: intervalPolicy,
        viewScope,
        defaultAssignment,
        dutyAssignmentsByPublicTripId,
        mealBreakIntervalKeys,
      });
      if (internalInterval) {
        rows.push({
          key: `interval-${previousTrip.id}-${trip.id}-${index}`,
          kind: 'interval',
          interval: internalInterval,
        });
      }
    }

    rows.push({
      key: `trip-${trip.id}-${index}`,
      kind: 'trip',
      trip,
    });
  });

  if (finalGap > 0 && lastTrip && windowEnd != null) {
    const finalInterval = buildTripIntervalDisplayRow({
      start: lastTrip.end_time,
      end: windowEnd,
      previousTrip: lastTrip,
      boundaryKind: 'final',
      policy: intervalPolicy,
      viewScope,
      defaultAssignment,
      dutyAssignmentsByPublicTripId,
      mealBreakIntervalKeys,
    });
    if (finalInterval) {
      rows.push({
        key: `interval-final-${dutyId ?? 'window'}-${getTripPublicId(lastTrip) ?? lastTrip.id}`,
        kind: 'interval',
        interval: finalInterval,
      });
    }
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 1, maxHeight: 300 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Tipo</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Duração</TableCell>
            {renderExtraColumn && <TableCell sx={{ py: 1, fontWeight: 700 }}>{extraColumnLabel || 'Alocação'}</TableCell>}
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Registro</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            if (row.kind === 'interval') {
              const { interval } = row;
              return (
                <TableRow key={row.key} sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ py: 0.75 }}>
                    <Chip
                      size="small"
                      color={getTripIntervalClassificationColor(interval.classification)}
                      variant="outlined"
                      label={getTripIntervalClassificationLabel(interval.classification)}
                      sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 10, fontWeight: 700 } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(interval.start)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(interval.end)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" display="block">
                      {getTerminalDisplayName(interval.originId, interval.originName, terminalsMap)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" display="block">
                      {getTerminalDisplayName(interval.destinationId, interval.destinationName, terminalsMap)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToDuration(interval.duration)}</TableCell>
                  {renderExtraColumn && (
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography variant="caption" color="text.secondary">--</Typography>
                    </TableCell>
                  )}
                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" fontWeight={700} display="block">{interval.recordLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">{interval.recordHint}</Typography>
                  </TableCell>
                </TableRow>
              );
            }

            const t = row.trip;
            const publicTripId = getTripPublicId(t) ?? t.id;
            const isSegmented = (t.segment_count ?? 1) > 1;

            return (
              <TableRow key={row.key} sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell sx={{ py: 0.75 }}>
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label="Viagem"
                    sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 10, fontWeight: 700 } }}
                  />
                </TableCell>
                <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
                <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
                <TableCell sx={{ py: 0.75 }}>
                  <Typography variant="caption" display="block">{getTerminalDisplayName(t.origin_id, t.origin_name, terminalsMap)}</Typography>
                  {(t as any).line_id && <Chip size="small" label={linesMap[(t as any).line_id] || (t as any).line_id} sx={{ height: 16, fontSize: 9 }} />}
                  {(t as any).direction && <Typography variant="caption" color="text.secondary" ml={0.5}>{directionLabel((t as any).direction)}</Typography>}
                </TableCell>
                <TableCell sx={{ py: 0.75 }}>
                  <Typography variant="caption" display="block">{getTerminalDisplayName(t.destination_id, t.destination_name, terminalsMap)}</Typography>
                </TableCell>
                <TableCell sx={{ py: 0.75 }}>{minToDuration(t.duration)}</TableCell>
                {renderExtraColumn && <TableCell sx={{ py: 0.75 }}>{renderExtraColumn(t)}</TableCell>}
                <TableCell sx={{ py: 0.75 }}>
                  <Typography variant="caption" fontWeight={700} display="block">#{publicTripId}</Typography>
                  {isSegmented && (
                    <Typography variant="caption" color="text.secondary">
                      Segmento {(t.segment_index ?? 0) + 1}/{t.segment_count}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Sub: KPI Hero Cards ───
function KpiStrip({ res, run }: { res: OptimizationResultSummary; run: OptimizationRun }) {
  const items = [
    { label: 'Custo Total', value: fmtCurrency(run.totalCost ?? res.total_cost ?? res.totalCost), color: 'primary.main', icon: <IconCurrencyDollar size={20} /> },
    { label: 'Veículos (VSP)', value: run.totalVehicles ?? res.vehicles ?? res.num_vehicles ?? '--', color: 'info.main', icon: <IconBus size={20} /> },
    { label: 'Tripulantes (CSP)', value: run.totalCrew ?? res.crew ?? res.num_crew ?? '--', color: 'success.main', icon: <IconUsers size={20} /> },
    { label: 'Violações CCT', value: run.cctViolations ?? res.cct_violations ?? res.cctViolations ?? 0, color: (run.cctViolations ?? res.cct_violations ?? res.cctViolations ?? 0) > 0 ? 'error.main' : 'success.main', icon: <IconShieldCheck size={20} /> },
  ];
  return (
    <Grid container spacing={2} mb={3}>
      {items.map((it) => (
        <Grid item xs={6} sm={3} key={it.label}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', borderLeft: '4px solid', borderLeftColor: it.color }}>
            <Stack direction="row" justifyContent="center" alignItems="center" gap={0.5} mb={0.5}>
              <Box sx={{ color: it.color }}>{it.icon}</Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{it.label}</Typography>
            </Stack>
            <Typography variant="h5" fontWeight={800}>{it.value}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

// ─── Tab 0: Visão Geral (Duties / Crew) ───
function TabOverview({
  res,
  lines,
  terminals,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  res: OptimizationResultSummary;
  lines: Line[];
  terminals: Terminal[];
  intervalPolicy: TripIntervalPolicy;
  mealBreakIntervalKeys: Set<string>;
}) {
  const duties = res.duties || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
  if (!duties.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem jornadas geradas nesta execução.</Typography>;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>{duties.length} Escalas de Trabalho Geradas</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Horário</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Duração</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Viagens</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Custo Total</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Alertas</TableCell>
              <TableCell sx={{ width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {duties.map((duty, idx) => (
              <DutyTableRow
                key={duty.duty_id ?? idx}
                duty={duty}
                linesMap={linesMap}
                terminalsMap={terminalsMap}
                intervalPolicy={intervalPolicy}
                mealBreakIntervalKeys={mealBreakIntervalKeys}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function DutyTableRow({
  duty,
  linesMap,
  terminalsMap,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  duty: OptimizationDuty,
  linesMap: Record<string,string>,
  terminalsMap: Record<string,string>,
  intervalPolicy: TripIntervalPolicy,
  mealBreakIntervalKeys: Set<string>,
}) {
  const [open, setOpen] = useState(false);
  const maxShift = 900;
  const hasViolation = duty.spread_time > maxShift || (duty.cct_penalties_cost ?? 0) > 0 || (duty.rest_violations ?? 0) > 0;
  const hasOvertime = (duty.overtime_cost ?? 0) > 0 || (duty.overtime_minutes ?? 0) > 0;
  const dutyMeta = asRecord(duty.meta);
  const dutyWindow = getDutyDisplayWindow(duty);
  const dutyDuration =
    dutyWindow.start != null && dutyWindow.end != null && dutyWindow.end >= dutyWindow.start
      ? dutyWindow.end - dutyWindow.start
      : duty.spread_time;

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen(!open)}
        sx={{
          cursor: 'pointer',
          '& > *': { borderBottom: 'unset !important' },
          bgcolor: hasViolation ? 'error.lighter' : 'inherit',
        }}
      >
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: hasViolation ? 'error.main' : 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <IconUsers size={16} />
            </Box>
            <Typography variant="body2" fontWeight={700}>Plantão #{duty.duty_id}</Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600}>{minToHHMM(dutyWindow.start)} → {minToHHMM(dutyWindow.end)}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{minToDuration(dutyDuration)}</Typography>
        </TableCell>
        <TableCell>
          <Chip size="small" label={`${duty.trips?.length || 0} viagens`} sx={{ height: 20 }} />
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={700} color={hasViolation ? 'error.main' : 'primary.main'}>
            {fmtCurrency(duty.total_cost || duty.work_cost)}
          </Typography>
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5}>
            {hasViolation && <Chip size="small" color="error" label="Violação" sx={{ height: 18, fontSize: 10 }} />}
            {hasOvertime && <Chip size="small" color="warning" label="HE" sx={{ height: 18, fontSize: 10 }} />}
            {!hasViolation && !hasOvertime && <IconCheck size={16} color="green" />}
          </Stack>
        </TableCell>
        <TableCell align="right">
          <IconButton size="small">{open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}</IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell sx={{ p: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle2" fontWeight={800} mb={1.5}>Itinerário Detalhado</Typography>
                  {duty.trips && duty.trips.length > 0 && (
                    <TripDetailTable
                      trips={duty.trips as TripDetail[]}
                      dutyId={duty.duty_id}
                      linesMap={linesMap}
                      terminalsMap={terminalsMap}
                      windowStart={dutyWindow.start}
                      windowEnd={dutyWindow.end}
                      intervalPolicy={intervalPolicy}
                      viewScope="crew"
                      defaultAssignment={{
                        dutyId: duty.duty_id,
                        rosterId: dutyMeta?.roster_id ?? null,
                        operatorId: dutyMeta?.operator_id ?? null,
                        operatorName: dutyMeta?.operator_name ?? null,
                      }}
                      mealBreakIntervalKeys={mealBreakIntervalKeys}
                      extraColumnLabel="Ônibus"
                      renderExtraColumn={(trip) => {
                        const blockId = trip.block_id;
                        return blockId != null
                          ? <Chip size="small" label={`Ônibus #${blockId}`} sx={{ height: 20 }} />
                          : <Typography variant="caption" color="text.secondary">--</Typography>;
                      }}
                    />
                  )}
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" fontWeight={800} mb={1.5}>Composição Financeira</Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                      {[
                        { l: 'Custo Trabalho', v: fmtCurrency(duty.work_cost || 0) },
                        { l: 'Horas Extras', v: fmtCurrency(duty.overtime_cost || 0) },
                        { l: 'Adic. Noturno', v: fmtCurrency(duty.nocturnal_extra_cost || 0) },
                        { l: 'Tempo Ocioso', v: fmtCurrency(duty.waiting_cost || 0) },
                        { l: 'Min. Garantido', v: fmtCurrency(duty.guaranteed_cost || 0) },
                      ].map((c) => (
                        <Box key={c.l} display="flex" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">{c.l}</Typography>
                          <Typography variant="body2" fontWeight={600}>{c.v}</Typography>
                        </Box>
                      ))}
                      <Divider />
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight={800}>Custo Total</Typography>
                        <Typography variant="h6" fontWeight={900} color="primary.main">{fmtCurrency(duty.total_cost || duty.work_cost)}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                  {((duty.warnings?.length || 0) > 0 || (duty.rest_violations || 0) > 0) && (
                    <Box mt={2} p={1.5} sx={{ bgcolor: 'error.lighter', borderRadius: 2, border: '1px solid', borderColor: 'error.light' }}>
                      <Stack direction="row" spacing={1} mb={1}>
                        <IconAlertTriangle size={16} color="red" />
                        <Typography variant="caption" fontWeight={700} color="error.dark">Pendências Regulamentares</Typography>
                      </Stack>
                      {duty.warnings?.map((w: string, i: number) => (
                        <Typography key={i} variant="caption" display="block" color="error.main" sx={{ pl: 3 }}>• {w}</Typography>
                      ))}
                    </Box>
                  )}
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Tab 1: Visão por Veículo (Blocks / VSP) ───
function TabVehicles({
  res,
  lines,
  terminals,
  dutyAssignmentsByPublicTripId,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  res: OptimizationResultSummary;
  lines: Line[];
  terminals: Terminal[];
  dutyAssignmentsByPublicTripId: Record<number, DutyTripAssignment[]>;
  intervalPolicy: TripIntervalPolicy;
  mealBreakIntervalKeys: Set<string>;
}) {
  const blocks = res.blocks || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
  if (!blocks.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem dados de alocação veicular disponíveis.</Typography>;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>{blocks.length} Blocos de Veículo</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Veículo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Saída / Retorno</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Viagens</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Duração</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Distância</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Custo</TableCell>
              <TableCell sx={{ width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {blocks.map((block, idx) => (
              <VehicleTableRow
                key={block.block_id ?? idx}
                block={block}
                linesMap={linesMap}
                terminalsMap={terminalsMap}
                dutyAssignmentsByPublicTripId={dutyAssignmentsByPublicTripId}
                intervalPolicy={intervalPolicy}
                mealBreakIntervalKeys={mealBreakIntervalKeys}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function VehicleTableRow({
  block,
  linesMap,
  terminalsMap,
  dutyAssignmentsByPublicTripId,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  block: any,
  linesMap: Record<string,string>,
  terminalsMap: Record<string,string>,
  dutyAssignmentsByPublicTripId: Record<number, DutyTripAssignment[]>,
  intervalPolicy: TripIntervalPolicy,
  mealBreakIntervalKeys: Set<string>,
}) {
  const [open, setOpen] = useState(false);
  const blockWindow = getBlockDisplayWindow(block);
  const totalDur =
    blockWindow.start != null && blockWindow.end != null
      ? Math.max(0, blockWindow.end - blockWindow.start)
      : block.end_time - block.start_time;

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen(!open)}
        sx={{ cursor: 'pointer', '& > *': { borderBottom: 'unset !important' } }}
      >
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: 'info.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <IconBus size={18} />
            </Box>
            <Typography variant="body2" fontWeight={700}>Veículo #{block.block_id}</Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600}>{minToHHMM(blockWindow.start)} → {minToHHMM(blockWindow.end)}</Typography>
        </TableCell>
        <TableCell>
          <Chip size="small" label={`${block.num_trips || block.trips?.length || 0} trips`} sx={{ height: 20 }} />
        </TableCell>
        <TableCell>
          <Typography variant="body2">{minToDuration(totalDur)}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{(block.meta?.total_distance_km || 0).toFixed(1)} km</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={700} color="info.main">{fmtCurrency(block.total_cost || block.cost)}</Typography>
        </TableCell>
        <TableCell align="right">
          <IconButton size="small">{open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}</IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell sx={{ p: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={800} mb={2}>Sequência de Viagens do Bloco</Typography>
              {block.trips && Array.isArray(block.trips) && block.trips.length > 0 && (
                  <TripDetailTable
                   trips={block.trips as TripDetail[]}
                   linesMap={linesMap}
                   terminalsMap={terminalsMap}
                   windowStart={blockWindow.start}
                   windowEnd={blockWindow.end}
                   intervalPolicy={intervalPolicy}
                   viewScope="vehicle"
                   dutyAssignmentsByPublicTripId={dutyAssignmentsByPublicTripId}
                   mealBreakIntervalKeys={mealBreakIntervalKeys}
                   extraColumnLabel="Tripulante"
                   renderExtraColumn={(trip) => {
                     const assignments = dutyAssignmentsByPublicTripId[getTripPublicId(trip) ?? -1] ?? [];
                     if (!assignments.length) {
                       return <Typography variant="caption" color="text.secondary">--</Typography>;
                     }

                     return (
                       <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                         {assignments.map((assignment, index) => {
                           const primaryLabel = assignment.operatorId != null
                             ? `Trip. #${assignment.operatorId}`
                             : assignment.dutyId != null
                               ? `Plantão #${assignment.dutyId}`
                               : 'Sem escala';
                           const rosterLabel = assignment.rosterId != null ? `Escala #${assignment.rosterId}` : null;
                           return (
                             <React.Fragment key={`${assignment.dutyId ?? 'd'}-${assignment.rosterId ?? 'r'}-${index}`}>
                               <Chip size="small" color="success" variant="outlined" label={primaryLabel} sx={{ height: 20 }} />
                               {rosterLabel && <Chip size="small" variant="outlined" label={rosterLabel} sx={{ height: 20 }} />}
                               {assignment.operatorName && (
                                 <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                   {assignment.operatorName}
                                 </Typography>
                               )}
                             </React.Fragment>
                           );
                         })}
                       </Stack>
                     );
                   }}
                  />
              )}
              
              <Grid container spacing={2} sx={{ mt: 2 }}>
                {[
                  { l: 'Custo Ativação', v: fmtCurrency(block.activation_cost) },
                  { l: 'Deadhead', v: fmtCurrency(block.connection_cost || block.deadhead_cost) },
                  { l: 'Tempo Ocioso', v: fmtCurrency(block.idle_cost) },
                  { l: 'Quilometragem', v: fmtCurrency(block.distance_cost) },
                ].map((item) => (
                  <Grid item xs={6} md={3} key={item.l}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" display="block">{item.l}</Typography>
                      <Typography variant="body2" fontWeight={700}>{item.v || 'R$ 0,00'}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Tab 2: Alertas e Sanções ───
function TabAlerts({ res, lines, terminals }: { res: OptimizationResultSummary; lines: Line[]; terminals: Terminal[] }) {
  const warningsRaw = res.warnings || [];
  const warnings = Array.isArray(warningsRaw) ? (warningsRaw as (string | OptimizationStructuredIssue)[]).map(w => typeof w === 'string' ? w : w.message) : [];
  const unassigned = res.unassigned_trips || [];
  const violations = res.cct_violations ?? res.cctViolations ?? 0;
  const duties = res.duties || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
  const dutyWarnings = duties.flatMap((d) => (d.warnings || []).map((w: string) => ({ duty: d.duty_id, msg: w })));

  if (warnings.length === 0 && unassigned.length === 0 && violations === 0 && dutyWarnings.length === 0) {
    return (
      <Box textAlign="center" py={8}>
        <IconShieldCheck size={64} color="#4CAF50" />
        <Typography variant="h6" fontWeight={700} mt={2} color="success.main">Nenhum Alerta</Typography>
        <Typography color="text.secondary">A otimização concluiu sem violações, erros ou viagens órfãs.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {violations > 0 && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          <AlertTitle>Violações de CCT/CLT</AlertTitle>
          {violations} violações de regras trabalhistas detectadas. Revise as escalas na aba de Visão Geral.
        </Alert>
      )}

      {unassigned.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <AlertTitle>Viagens Órfãs ({unassigned.length})</AlertTitle>
          O solver não conseguiu alocar {unassigned.length} viagen{unassigned.length > 1 ? 's' : ''} dentro dos limites impostos.
          <Box mt={1}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {unassigned.slice(0, 20).map((t, i) => (
                <Chip key={i} size="small" label={`Trip #${typeof t === 'object' ? (t as TripDetail).id : t}`} color="warning" variant="outlined" />
              ))}
              {unassigned.length > 20 && <Chip size="small" label={`+${unassigned.length - 20} mais`} />}
            </Stack>
          </Box>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Box mb={2}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Avisos Gerais do Motor ({warnings.length})</Typography>
          {warnings.map((w, i) => (
            <Alert key={i} severity="info" sx={{ mb: 1, borderRadius: 2 }} icon={<IconAlertTriangle size={18} />}>
              {w}
            </Alert>
          ))}
        </Box>
      )}

      {dutyWarnings.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Alertas por Jornada ({dutyWarnings.length})</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Plantão</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Detalhe</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dutyWarnings.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell><Chip size="small" label={`#${d.duty}`} /></TableCell>
                    <TableCell><Typography variant="body2">{d.msg}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

// ─── Tab 3: Inventário de Viagens ───
function TabTrips({ res, lines, terminals }: { res: OptimizationResultSummary, lines: Line[], terminals: Terminal[] }) {
  const blocks = res.blocks || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
  const unassigned = res.unassigned_trips || [];
  
  const duties = res.duties || [];
  
  // Maps trip ID to duty ID and block ID
  const tripToDuty: Record<number, number | string> = {};
  duties.forEach(d => {
    (d.trips || []).forEach(t => {
      const tripId = typeof t === 'object' ? t.id : t;
      tripToDuty[tripId as number] = d.duty_id;
    });
  });

  const tripToBlock: Record<number, number | string> = {};
  blocks.forEach(b => {
    (b.trips || []).forEach(t => {
      const tripId = typeof t === 'object' ? t.id : t;
      tripToBlock[tripId as number] = b.block_id;
    });
  });

  const allTripObjects = new Map<number, any>();
  
  // Collect from blocks
  blocks.forEach(b => {
    (b.trips || []).forEach(t => {
      if (typeof t !== 'number') allTripObjects.set(t.id, t);
    });
  });
  // Collect from duties
  duties.forEach(d => {
    (d.trips || []).forEach(t => {
      if (typeof t !== 'number') allTripObjects.set(t.id, t);
    });
  });

  const assignedTrips = Array.from(allTripObjects.values()).map(t => ({
    ...t,
    status: 'assigned',
    duty_id: tripToDuty[t.id] ?? t.duty_id,
    block_id: tripToBlock[t.id] ?? t.block_id,
  }));

  const total = assignedTrips.length + unassigned.length;
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const allTrips = [
    ...assignedTrips,
    ...unassigned.map((t) => {
      const isObj = typeof t === 'object' && t !== null;
      if (isObj) return { ...t, status: 'orphan' as const };
      return {
        id: t as number,
        start_time: 0,
        end_time: 0,
        origin_id: 0,
        destination_id: 0,
        duration: 0,
        status: 'orphan' as const,
      };
    }),
  ];
  const sliced = allTrips.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(allTrips.length / pageSize);

  if (allTrips.length === 0) return <Typography color="text.secondary" py={4} textAlign="center">Nenhuma viagem registrada nesta execução.</Typography>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>{total} Viagens Processadas</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" color="success" variant="outlined" label={`${assignedTrips.length} Designadas`} />
          {unassigned.length > 0 && <Chip size="small" color="error" variant="outlined" label={`${unassigned.length} Órfãs`} />}
        </Stack>
      </Stack>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 500 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Veículo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Início</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Fim</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Linha</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Sentido</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Origem</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Destino</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sliced.map((t: any, i) => (
              <TableRow key={i} sx={{ bgcolor: t.status === 'orphan' ? 'error.lighter' : 'inherit' }}>
                <TableCell><Typography variant="body2" fontWeight={600}>#{t.trip_id || t.id}</Typography></TableCell>
                <TableCell align="center">
                  <Chip size="small" color={t.status === 'assigned' ? 'success' : 'error'} label={t.status === 'assigned' ? 'OK' : 'Órfã'} sx={{ height: 20, fontSize: 11 }} />
                </TableCell>
                <TableCell>{t.block_id != null ? `Bloco #${t.block_id}` : '--'}</TableCell>
                <TableCell>{t.start_time != null ? minToHHMM(t.start_time) : '--'}</TableCell>
                <TableCell>{t.end_time != null ? minToHHMM(t.end_time) : '--'}</TableCell>
                <TableCell>{linesMap[t.line_id] || t.line_id || '--'}</TableCell>
                <TableCell>{t.direction === 'outbound' ? 'Ida' : t.direction === 'inbound' ? 'Volta' : (t.direction as string) || '--'}</TableCell>
                <TableCell>{terminalsMap[t.origin_id] || t.origin_name || t.origin_id || '--'}</TableCell>
                <TableCell>{terminalsMap[t.destination_id] || t.destination_name || t.destination_id || '--'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="center" spacing={1} mt={2}>
          <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <Typography variant="caption" sx={{ lineHeight: '30px' }}>Pág. {page + 1} de {totalPages}</Typography>
          <Button size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </Stack>
      )}
    </Box>
  );
}

// ─── Tab 4: Gráfico de Gantt ───
function TabGantt({
  res,
  lines,
  terminals,
  intervalPolicy,
}: {
  res: OptimizationResultSummary;
  lines: Line[];
  terminals: Terminal[];
  intervalPolicy: TripIntervalPolicy;
}) {
  const theme = useTheme();
  const [zoom, setZoom] = useState(1);
  const { blocks = [], duties = [] } = res;
  const ganttColors = useMemo(
    () => ({
      ida: theme.palette.info.main,
      volta: theme.palette.primary.main,
      deadhead: alpha(theme.palette.warning.main, 0.18),
      deadheadBorder: alpha(theme.palette.warning.dark, 0.45),
    }),
    [theme],
  );
  
  // ─── Data Enrichment ───
  // Some fields like line_id/direction might be missing in blocks but present in duties.
  // We build a global map to enrich the Gantt data.
  const tripMetadataMap = useMemo(() => {
    const map = new Map<number, TripDetail>();
    
    // Scan blocks for trip objects
    blocks.forEach(b => {
      (b.trips || []).forEach(t => {
         if (typeof t === 'object') map.set(t.id, t);
      });
    });
    
    // Scan duties for trip objects (often more complete)
    duties.forEach(d => {
      (d.trips || []).forEach(t => {
         if (typeof t === 'object') {
           const existing = map.get(t.id);
           map.set(t.id, { ...existing, ...t });
         }
      });
    });

    return map;
  }, [blocks, duties]);

  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);

  const { processedBlocks, minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    const filtered = blocks.map((b) => {
      let blockMin = Infinity;
      let blockMax = -Infinity;
      const blockWindow = getBlockDisplayWindow(b);
      const validTrips = (b.trips || []).map(t => {
        const id = typeof t === 'number' ? t : t.id;
        const meta = tripMetadataMap.get(id);
        return { ...(typeof t === 'object' ? t : {}), ...meta, id } as TripDetail;
      }).filter(t => t.start_time !== undefined);

      validTrips.forEach((t) => {
        if (t.start_time !== undefined && t.start_time < min) min = t.start_time;
        if (t.end_time !== undefined && t.end_time > max) max = t.end_time;
        if (t.start_time !== undefined && t.start_time < blockMin) blockMin = t.start_time;
        if (t.end_time !== undefined && t.end_time > blockMax) blockMax = t.end_time;
      });

      const sortedTrips = validTrips.sort((left, right) => (left.start_time ?? 0) - (right.start_time ?? 0));
  const displayStart = blockWindow.start ?? (blockMin !== Infinity ? blockMin : 0);
  const displayEnd = blockWindow.end ?? (blockMax !== -Infinity ? blockMax : 0);

  if (displayStart < min) min = displayStart;
  if (displayEnd > max) max = displayEnd;

      // Group into cycles
      const groups: { type: 'cycle' | 'single' | 'deadhead', trips: TripDetail[] }[] = [];
      let i = 0;
      while (i < sortedTrips.length) {
        const current = sortedTrips[i];
        const next = sortedTrips[i + 1];

        const isDeadhead = !current.line_id;
        
        if (isDeadhead) {
          if (groups.length > 0 && groups[groups.length - 1].type === 'deadhead') {
            groups[groups.length - 1].trips.push(current);
          } else {
            groups.push({ type: 'deadhead', trips: [current] });
          }
          i++;
          continue;
        }

        const direction = current.direction?.toLowerCase();
        const nextDirection = next?.direction?.toLowerCase();
        const isCurrentOut = direction === 'outbound' || direction === 'ida';
        const isNextIn = nextDirection === 'inbound' || nextDirection === 'volta';

        if (next && next.line_id === current.line_id && isCurrentOut && isNextIn && (next.start_time - current.end_time) < 30) {
          groups.push({ type: 'cycle', trips: [current, next] });
          i += 2;
        } else {
          groups.push({ type: 'single', trips: [current] });
          i++;
        }
      }

      const supportWindows: IdleWindow[] = groups
        .filter((group) => group.type === 'deadhead')
        .map((group) => {
          const start = group.trips[0].start_time ?? 0;
          const end = group.trips[group.trips.length - 1].end_time ?? start;
          return {
            start,
            end,
            duration: Math.max(0, end - start),
            kind: 'apoio',
          };
        });

      const gapWindows: IdleWindow[] = [];
      sortedTrips.slice(1).forEach((trip, index) => {
        const previousTrip = sortedTrips[index];
        const start = previousTrip.end_time ?? null;
        const end = trip.start_time ?? null;
        if (start == null || end == null || end <= start) return;

        gapWindows.push({
          start,
          end,
          duration: end - start,
          kind: classifyTripInterval({
            gapMinutes: end - start,
            isBoundary: false,
            isMealBreakWindow: false,
            viewScope: 'vehicle',
          }),
        });
      });

      const boundaryWindows: IdleWindow[] = [];
      const firstTrip = sortedTrips[0];
      const lastTrip = sortedTrips[sortedTrips.length - 1];
      if (firstTrip?.start_time != null && displayStart < firstTrip.start_time) {
        boundaryWindows.push({
          start: displayStart,
          end: firstTrip.start_time,
          duration: firstTrip.start_time - displayStart,
          kind: classifyTripInterval({
            gapMinutes: firstTrip.start_time - displayStart,
            isBoundary: true,
            isMealBreakWindow: false,
            viewScope: 'vehicle',
          }),
        });
      }
      if (lastTrip?.end_time != null && displayEnd > lastTrip.end_time) {
        boundaryWindows.push({
          start: lastTrip.end_time,
          end: displayEnd,
          duration: displayEnd - lastTrip.end_time,
          kind: classifyTripInterval({
            gapMinutes: displayEnd - lastTrip.end_time,
            isBoundary: true,
            isMealBreakWindow: false,
            viewScope: 'vehicle',
          }),
        });
      }

      const idleWindows: IdleWindow[] = [...boundaryWindows, ...supportWindows, ...gapWindows].sort(
        (left, right) => left.start - right.start,
      );

      const idleSummary = idleWindows.length
        ? `${idleWindows.slice(0, 2).map((window) => formatIdleWindowLabel(window)).join(' · ')}${idleWindows.length > 2 ? ` +${idleWindows.length - 2}` : ''}`
        : null;

      return {
        ...b,
        groups,
        min: displayStart,
        max: displayEnd,
        idleWindows,
        idleSummary,
        tripCount: validTrips.length,
        lineLabels: Array.from(new Set(validTrips.map((trip) => trip.line_id ? String(linesMap[trip.line_id] || trip.line_id) : '').filter(Boolean))).slice(0, 3),
      };
    }).filter(b => (b.trips?.length || 0) > 0);

    return { processedBlocks: filtered, minTime: min, maxTime: max };
  }, [
    blocks,
    intervalPolicy,
    linesMap,
    tripMetadataMap,
  ]);

  if (processedBlocks.length === 0 || minTime === Infinity) {
    return <Typography color="text.secondary" py={4} textAlign="center">Sem dados suficientes para gerar o gráfico.</Typography>;
  }

  const padding = 30;
  const startScale = Math.max(0, minTime - padding);
  const endScale = maxTime + padding;
  const totalRange = endScale - startScale;
  const getPercent = (time: number) => Math.max(0, Math.min(100, ((time - startScale) / totalRange) * 100));

  const ticks = [];
  const tickStep = zoom > 1.5 ? 60 : 120;
  const startHour = Math.floor(startScale / 60);
  const endHour = Math.ceil(endScale / 60);
  for (let h = startHour; h <= endHour; h++) {
    const t = h * 60;
    if (t >= startScale && t <= endScale) {
       if (zoom > 1.5 || h % 2 === 0) ticks.push(t);
    }
  }

  // Visual constants for precise alignment
  const SIDE_LABEL_WIDTH = 180;
  const BLOCK_HEIGHT = 30;
  const timelineWidth = 1920 * zoom;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={1.5}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800} sx={{ letterSpacing: -0.5 }}>Gantt de Blocos e Viagens</Typography>
        </Box>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: alpha(theme.palette.divider, 0.05), p: 0.5, borderRadius: 2 }}>
            <Button size="small" variant={zoom === 1 ? 'contained' : 'text'} onClick={() => setZoom(1)} sx={{ minWidth: 60, height: 24, fontSize: 10, borderRadius: 1.5 }}>Compacto</Button>
            <Button size="small" variant={zoom === 1.5 ? 'contained' : 'text'} onClick={() => setZoom(1.5)} sx={{ minWidth: 60, height: 24, fontSize: 10, borderRadius: 1.5 }}>Normal</Button>
            <Button size="small" variant={zoom === 3 ? 'contained' : 'text'} onClick={() => setZoom(3)} sx={{ minWidth: 60, height: 24, fontSize: 10, borderRadius: 1.5 }}>Largo</Button>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: ganttColors.ida, borderRadius: '50%' }} />
              <Typography variant="caption" fontWeight={600}>Ida</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: ganttColors.volta, borderRadius: '50%' }} />
              <Typography variant="caption" fontWeight={600}>Volta</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: ganttColors.deadhead, borderRadius: '50%', border: '1px solid', borderColor: ganttColors.deadheadBorder }} />
              <Typography variant="caption" fontWeight={600}>Apoio/Ocioso</Typography>
            </Stack>
          </Stack>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Box sx={{ 
          overflowX: 'auto', 
          position: 'relative',
          padding: 2,
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 4 }
        }}>
          <Box sx={{ minWidth: SIDE_LABEL_WIDTH + timelineWidth, position: 'relative', pt: 5, pb: 2 }}>
            {/* Eixo de Tempo (Header) */}
            <Box sx={{ position: 'absolute', top: 0, left: SIDE_LABEL_WIDTH, right: 0, height: 32, borderBottom: '1px solid', borderColor: 'divider', zIndex: 10 }}>
              {ticks.map(t => (
                <Box key={t} sx={{ position: 'absolute', left: `${getPercent(t)}%`, transform: 'translateX(-50%)' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: 10 }}>
                    {minToHHMM(t)}
                  </Typography>
                  <Box sx={{ position: 'absolute', left: '50%', top: 24, height: (processedBlocks.length * (BLOCK_HEIGHT + 16)) + 40, width: '1px', bgcolor: alpha(theme.palette.divider, 0.4), zIndex: 0 }} />
                </Box>
              ))}
            </Box>

            <Stack spacing={1} sx={{ position: 'relative', zIndex: 1, mt: 4 }}>
              {processedBlocks.map((b, idx) => (
                <Stack direction="row" key={idx} alignItems="stretch" spacing={0}>
                  {/* Label do Bloco (Y-Axis) */}
                  <Box sx={{ width: SIDE_LABEL_WIDTH, flexShrink: 0, py: 1, pr: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Box sx={{ px: 2, py: 0.75, borderRadius: 0.75, bgcolor: alpha(theme.palette.action.hover, 0.5), border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" fontWeight={900} color="primary.main" sx={{ fontSize: 11 }}>BLOCO #{b.block_id}</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: 10, mt: 0.5, display: 'block' }}>{minToHHMM(b.min)} - {minToHHMM(b.max)}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{b.tripCount} percursos</Typography>
                      {b.idleSummary && (
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography variant="caption" display="block" fontWeight={800} sx={{ mb: 0.5 }}>
                                Janelas de ociosidade
                              </Typography>
                              <Stack spacing={0.25}>
                                {b.idleWindows.map((window: IdleWindow, index: number) => (
                                  <Typography key={`${b.block_id}-idle-${index}`} variant="caption">
                                    {formatIdleWindowLabel(window)}
                                  </Typography>
                                ))}
                              </Stack>
                            </Box>
                          }
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: 9,
                              mt: 0.35,
                              display: 'block',
                              color: 'warning.dark',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'help',
                            }}
                          >
                            {b.idleSummary}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {/* Área do Gráfico */}
                  <Box sx={{ flexGrow: 1, position: 'relative', height: BLOCK_HEIGHT, bgcolor: alpha(theme.palette.action.hover, 0.3), borderRadius: 0.75, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.5) }}>
                    {b.groups.map((group, gIdx) => {
                      const containerStart = getPercent(group.trips[0].start_time ?? 0);
                      const containerEnd = getPercent(group.trips[group.trips.length - 1].end_time ?? 0);
                      const containerWidth = containerEnd - containerStart;

                      return (
                        <Box key={gIdx} sx={{ 
                          position: 'absolute', 
                          left: `${containerStart}%`, 
                          width: `${containerWidth}%`, 
                          height: '100%',
                          ...(group.type === 'cycle' && {
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            borderRadius: 1,
                            border: '1px dashed',
                            borderColor: alpha(theme.palette.primary.main, 0.1),
                          })
                        }}>
                          {group.trips.map((t, i) => {
                            const groupStart = group.trips[0].start_time ?? 0;
                            const groupEnd = group.trips[group.trips.length - 1].end_time ?? 0;
                            const range = Math.max(groupEnd - groupStart, 1);
                            const startP = (((t.start_time ?? 0) - groupStart) / range) * 100;
                            const widthP = (((t.end_time ?? 0) - (t.start_time ?? 0)) / range) * 100;
                            
                            // Absolute calc for accurate positioning
                            const absStartP = getPercent(t.start_time ?? 0);
                            const absWidthP = getPercent(t.end_time ?? 0) - absStartP;

                            const isDeadhead = !t.line_id;
                            const dir = t.direction?.toLowerCase();
                            const isVolta = dir === 'inbound' || dir === 'volta';
                            const barColor = isDeadhead ? ganttColors.deadhead : isVolta ? ganttColors.volta : ganttColors.ida;
                            const barTextColor = isDeadhead ? 'text.secondary' : 'common.white';
                            const originName = terminalsMap[t.origin_id] || t.origin_name || t.origin_id;
                            const destinationName = terminalsMap[t.destination_id] || t.destination_name || t.destination_id;

                            return (
                              <Tooltip
                                key={i}
                                arrow
                                title={
                                  <Box sx={{ p: 0.5 }}>
                                    <Typography variant="caption" display="block" fontWeight={900} sx={{ color: 'primary.light', borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.5, mb: 0.5 }}>
                                      {isDeadhead ? 'VIAGEM DE APOIO' : `LINHA ${linesMap[t.line_id!] || t.line_id}`}
                                    </Typography>
                                    <Stack spacing={0.25}>
                                      <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Horário:</span> <b>{minToHHMM(t.start_time)} → {minToHHMM(t.end_time)}</b>
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Duração:</span> <b>{minToDuration(t.duration)}</b>
                                      </Typography>
                                      <Typography variant="caption" sx={{ mt: 0.5, opacity: 0.8 }}>
                                        {originName} ➔ {destinationName}
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontSize: 9, opacity: 0.6, pt: 0.5 }}>ID: #{t.id}</Typography>
                                    </Stack>
                                  </Box>
                                }
                              >
                                <Box sx={{
                                  position: 'absolute',
                                  left: `${startP}%`,
                                  width: `${widthP}%`,
                                  top: isDeadhead ? 13 : 6,
                                  bottom: isDeadhead ? 13 : 6,
                                  bgcolor: barColor,
                                  borderRadius: isDeadhead ? 999 : 0.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  boxShadow: isDeadhead ? 'none' : '0 1px 3px rgba(0,0,0,0.15)',
                                  border: isDeadhead ? '1px solid' : 'none',
                                  borderColor: isDeadhead ? ganttColors.deadheadBorder : 'divider',
                                  transition: 'all 0.2s',
                                  height: isDeadhead ? 4 : undefined,
                                  '&:hover': { 
                                    opacity: 0.9, 
                                    transform: isDeadhead ? 'none' : 'scaleY(1.06)',
                                    zIndex: 10,
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                                  },
                                }}>
                                  {!isDeadhead && absWidthP > (zoom * 5) && (
                                    <Typography variant="caption" sx={{ color: barTextColor, fontSize: 10, px: 0.5, whiteSpace: 'nowrap', fontWeight: 900 }}>
                                      {linesMap[t.line_id!] || t.line_id}
                                    </Typography>
                                  )}
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
// ─── Tab 5: Auditoria e Comparação ───
function TabAudit({ run, allRuns }: { run: OptimizationRun; allRuns: OptimizationRun[] }) {
  const [audit, setAudit] = useState<OptimizationRunAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string>('');
  const [comparison, setComparison] = useState<OptimizationRunComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const comparableRuns = useMemo(
    () =>
      allRuns
        .filter((candidate) => candidate.id !== run.id && candidate.status === 'completed')
        .slice(0, 20),
    [allRuns, run.id],
  );

  useEffect(() => {
    let active = true;
    setAuditLoading(true);
    setAuditError(null);

    optimizationApi
      .getAudit(run.id)
      .then((data) => {
        if (active) setAudit(data as OptimizationRunAudit);
      })
      .catch(() => {
        if (active) {
          setAudit(null);
          setAuditError('Nao foi possivel carregar a auditoria detalhada desta execucao.');
        }
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });

    return () => {
      active = false;
    };
  }, [run.id]);

  useEffect(() => {
    if (!comparableRuns.length || run.status !== 'completed') {
      setCompareTargetId('');
      return;
    }

    setCompareTargetId((current) =>
      current && comparableRuns.some((candidate) => String(candidate.id) === current)
        ? current
        : String(comparableRuns[0].id),
    );
  }, [comparableRuns, run.status]);

  useEffect(() => {
    if (!compareTargetId || run.status !== 'completed') {
      setComparison(null);
      setCompareError(null);
      return;
    }

    let active = true;
    setCompareLoading(true);
    setCompareError(null);

    optimizationApi
      .compare(run.id, Number(compareTargetId))
      .then((data) => {
        if (active) setComparison(data as OptimizationRunComparison);
      })
      .catch(() => {
        if (active) {
          setComparison(null);
          setCompareError('Nao foi possivel comparar as execucoes selecionadas.');
        }
      })
      .finally(() => {
        if (active) setCompareLoading(false);
      });

    return () => {
      active = false;
    };
  }, [compareTargetId, run.id, run.status]);

  const auditResult = audit?.result ?? (run.resultSummary as OptimizationResultSummary | null) ?? null;
  const performance = (auditResult?.performance ?? null) as OptimizationPerformance | null;
  const reproducibility = (auditResult?.reproducibility ?? null) as OptimizationReproducibility | null;
  const phaseTimings = Object.entries(performance?.phase_timings_ms ?? {}).sort((left, right) => left[0].localeCompare(right[0]));
  const versioning = (audit?.versioning ?? null) as Record<string, unknown> | null;
  const metricsEntries = Object.entries(comparison?.metrics ?? {});
  const performanceEntries = Object.entries(comparison?.performance?.phaseTimings ?? {});
  const raw = JSON.stringify({ audit: audit ?? null, comparison: comparison ?? null }, null, 2);

  return (
    <Box>
      {auditLoading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}
      {auditError && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{auditError}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={800} mb={1.5}>Replay e Versionamento</Typography>
            <Stack spacing={1.25}>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Hash do input do replay</Typography>
                <Typography variant="body2" fontWeight={700}>{readReproValue<string>(reproducibility, 'input_hash', 'inputHash') ?? '--'}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Hash dos parametros do replay</Typography>
                <Typography variant="body2" fontWeight={700}>{readReproValue<string>(reproducibility, 'params_hash', 'paramsHash') ?? '--'}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Budget auditado</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(readReproValue<number>(reproducibility, 'time_budget_s', 'timeBudgetS'), 's')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Random seed</Typography>
                <Typography variant="body2" fontWeight={700}>{readReproValue<number>(reproducibility, 'random_seed', 'randomSeed') ?? '--'}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Replay deterministico</Typography>
                <Chip
                  size="small"
                  color={readReproValue<boolean>(reproducibility, 'deterministic_replay_possible', 'deterministicReplayPossible') ? 'success' : 'warning'}
                  label={readReproValue<boolean>(reproducibility, 'deterministic_replay_possible', 'deterministicReplayPossible') ? 'Sim' : 'Nao'}
                />
              </Box>
              <Divider />
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">settingsVersion</Typography>
                <Typography variant="body2" fontWeight={700}>{String(versioning?.settingsVersion ?? '--')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">ruleHash do snapshot</Typography>
                <Typography variant="body2" fontWeight={700}>{String(versioning?.ruleHash ?? '--')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">inputHash do snapshot</Typography>
                <Typography variant="body2" fontWeight={700}>{String(versioning?.inputHash ?? '--')}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={800} mb={1.5}>Performance do Solver</Typography>
            <Stack spacing={1.25} mb={2}>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Tempo total</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(performance?.total_elapsed_ms ?? run.durationMs, 'ms')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Trips auditadas</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(performance?.trip_count)}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Tipos de veiculo</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(performance?.vehicle_type_count)}</Typography>
              </Box>
            </Stack>

            {phaseTimings.length ? (
              <TableContainer component={Box}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Fase</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Tempo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {phaseTimings.map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell>{labelizeKey(key)}</TableCell>
                        <TableCell align="right">{fmtNumber(value, 'ms')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">Sem timings detalhados nesta execucao.</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={2}>
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Auditoria Comparativa</Typography>
                <Typography variant="caption" color="text.secondary">Compare custo, performance e fingerprints de replay entre duas execucoes.</Typography>
              </Box>
              <TextField
                select
                size="small"
                label="Comparar com"
                value={compareTargetId}
                onChange={(event) => setCompareTargetId(event.target.value)}
                sx={{ minWidth: 220 }}
                disabled={!comparableRuns.length || run.status !== 'completed'}
              >
                {!comparableRuns.length && <MenuItem value="">Nenhuma execucao comparavel</MenuItem>}
                {comparableRuns.map((candidate) => (
                  <MenuItem key={candidate.id} value={String(candidate.id)}>
                    #{candidate.id} · {new Date(candidate.createdAt || '').toLocaleString('pt-BR')}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {compareLoading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}
            {compareError && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{compareError}</Alert>}

            {comparison ? (
              <Stack spacing={2}>
                <Alert severity={comparison.summary?.betterRunId === run.id ? 'success' : 'info'} sx={{ borderRadius: 2 }}>
                  {comparison.summary?.headline ?? 'Comparacao carregada.'}
                </Alert>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={7}>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Indicador</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Base</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Comparada</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Delta</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {metricsEntries.map(([key, metric]) => (
                            <TableRow key={key}>
                              <TableCell>{labelizeKey(key)}</TableCell>
                              <TableCell align="right">{formatComparisonValue(key, metric.base)}</TableCell>
                              <TableCell align="right">{formatComparisonValue(key, metric.other)}</TableCell>
                              <TableCell align="right"><ComparisonDeltaCell metric={metric} metricKey={key} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  <Grid item xs={12} md={5}>
                    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Replay entre execucoes</Typography>
                      <Stack spacing={1.25}>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Mesmo input hash</Typography>
                          <Chip size="small" color={comparison.reproducibility?.sameInputHash ? 'success' : 'warning'} label={comparison.reproducibility?.sameInputHash ? 'Sim' : 'Nao'} />
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Mesmo params hash</Typography>
                          <Chip size="small" color={comparison.reproducibility?.sameParamsHash ? 'success' : 'warning'} label={comparison.reproducibility?.sameParamsHash ? 'Sim' : 'Nao'} />
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Mesmo budget</Typography>
                          <Chip size="small" color={comparison.reproducibility?.sameTimeBudget ? 'success' : 'warning'} label={comparison.reproducibility?.sameTimeBudget ? 'Sim' : 'Nao'} />
                        </Box>
                        <Divider />
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Input hash base</Typography>
                          <Typography variant="body2" fontWeight={700}>{comparison.reproducibility?.base?.inputHash ?? '--'}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Input hash comparada</Typography>
                          <Typography variant="body2" fontWeight={700}>{comparison.reproducibility?.other?.inputHash ?? '--'}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Budget base</Typography>
                          <Typography variant="body2" fontWeight={700}>{fmtNumber(comparison.reproducibility?.base?.timeBudgetS, 's')}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Budget comparada</Typography>
                          <Typography variant="body2" fontWeight={700}>{fmtNumber(comparison.reproducibility?.other?.timeBudgetS, 's')}</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>

                {!!performanceEntries.length && (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Timing</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Base</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Comparada</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Delta</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {performanceEntries.map(([key, metric]) => (
                          <TableRow key={key}>
                            <TableCell>{labelizeKey(key)}</TableCell>
                            <TableCell align="right">{formatComparisonValue(key, metric.base, 'performance')}</TableCell>
                            <TableCell align="right">{formatComparisonValue(key, metric.other, 'performance')}</TableCell>
                            <TableCell align="right"><ComparisonDeltaCell metric={metric} metricKey={key} category="performance" /></TableCell>
                          </TableRow>
                        ))}
                        {comparison.performance?.totalElapsedMs && (
                          <TableRow>
                            <TableCell>Tempo Total</TableCell>
                            <TableCell align="right">{formatComparisonValue('totalElapsedMs', comparison.performance.totalElapsedMs.base, 'performance')}</TableCell>
                            <TableCell align="right">{formatComparisonValue('totalElapsedMs', comparison.performance.totalElapsedMs.other, 'performance')}</TableCell>
                            <TableCell align="right"><ComparisonDeltaCell metric={comparison.performance.totalElapsedMs} metricKey="totalElapsedMs" category="performance" /></TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {!!comparison.paramsDiff?.length && (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Parametro</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Base</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Comparada</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparison.paramsDiff.slice(0, 12).map((diff) => (
                          <TableRow key={diff.path}>
                            <TableCell>{diff.path}</TableCell>
                            <TableCell>{diff.base}</TableCell>
                            <TableCell>{diff.other}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {run.status !== 'completed'
                  ? 'Comparacao disponivel apenas para execucoes concluidas.'
                  : 'Selecione uma execucao para carregar o comparativo.'}
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, maxHeight: 500, overflowY: 'auto', bgcolor: 'grey.900' }}>
            <Typography variant="subtitle2" fontWeight={800} color="white" mb={1}>Envelope bruto de auditoria</Typography>
            <pre style={{ margin: 0, fontSize: 12, color: '#4FC3F7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>{raw}</pre>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// ─── Main RunVisuals ───
function RunVisuals({
  run,
  lines,
  terminals,
  allRuns,
  activeSettings,
}: {
  run: OptimizationRun,
  lines: Line[],
  terminals: Terminal[],
  allRuns: OptimizationRun[],
  activeSettings: OptimizationSettings | null,
}) {
  const [tab, setTab] = useState(0);
  const res = run.resultSummary || {};
  const warningsRaw = res.warnings || [];
  const warnings = Array.isArray(warningsRaw) ? (warningsRaw as (string | OptimizationStructuredIssue)[]).map(w => typeof w === 'string' ? w : w.message) : [];
  const unassigned = res.unassigned_trips || [];
  const alertCount = (res.cct_violations ?? res.cctViolations ?? 0) + warnings.length + unassigned.length;
  const intervalPolicy = useMemo(
    () => buildTripIntervalPolicy(run, activeSettings),
    [run, activeSettings],
  );
  const duties = res.duties || [];
  const dutyAssignmentsByPublicTripId = useMemo(
    () => buildDutyAssignmentsByPublicTripId(duties),
    [duties],
  );
  const mealBreakIntervalKeys = useMemo(
    () => buildDutyMealBreakIntervalKeys(duties, intervalPolicy),
    [duties, intervalPolicy],
  );

  if (run.status === 'failed') {
    return (
      <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
        <AlertTitle>Falha de Processamento</AlertTitle>
        <Typography>O motor de otimização rejeitou os parâmetros ou abortou a execução.</Typography>
        <Typography variant="caption" sx={{ whiteSpace: 'pre-line', mt: 1, display: 'block' }}>{run.errorMessage || 'Detalhes indisponíveis.'}</Typography>
      </Alert>
    );
  }

  if (run.status === 'running') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <IconRobot size={48} color="#1976D2" />
        <Typography variant="h6" fontWeight={700} mt={2}>Motor em Execução...</Typography>
        <Typography color="text.secondary" mb={2}>Análise pesada e Set Partitioning em progressão.</Typography>
        <LinearProgress sx={{ maxWidth: 400, mx: 'auto', borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box>
      <KpiStrip res={res} run={run} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: -0.5 }}>
          <Tab icon={<IconUsers size={16} />} iconPosition="start" label="Escalas" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconBus size={16} />} iconPosition="start" label="Veículos" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab
            icon={<Badge badgeContent={alertCount} color="error" max={99}><IconAlertTriangle size={16} /></Badge>}
            iconPosition="start" label="Alertas" sx={{ textTransform: 'none', fontWeight: 600 }}
          />
          <Tab icon={<IconRoute size={16} />} iconPosition="start" label="Viagens" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconChartBar size={16} />} iconPosition="start" label="Gantt" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconFileCode size={16} />} iconPosition="start" label="Auditoria" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
      </Stack>

      {tab === 0 && (
        <TabOverview
          res={res}
          lines={lines}
          terminals={terminals}
          intervalPolicy={intervalPolicy}
          mealBreakIntervalKeys={mealBreakIntervalKeys}
        />
      )}
      {tab === 1 && (
        <TabVehicles
          res={res}
          lines={lines}
          terminals={terminals}
          dutyAssignmentsByPublicTripId={dutyAssignmentsByPublicTripId}
          intervalPolicy={intervalPolicy}
          mealBreakIntervalKeys={mealBreakIntervalKeys}
        />
      )}
      {tab === 2 && <TabAlerts res={res} lines={lines} terminals={terminals} />}
      {tab === 3 && <TabTrips res={res} lines={lines} terminals={terminals} />}
      {tab === 4 && (
        <TabGantt
          res={res}
          lines={lines}
          terminals={terminals}
          intervalPolicy={intervalPolicy}
        />
      )}
      {tab === 5 && <TabAudit run={run} allRuns={allRuns} />}
    </Box>
  );
}

// ─── Main Page ───
function OptimizationInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeSettings, setActiveSettings] = useState<OptimizationSettings | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [operationMode, setOperationMode] = useState<'urban' | 'charter'>('urban');
  const [algorithm, setAlgorithm] = useState('hybrid_pipeline');
  const [timeBudget, setTimeBudget] = useState(30);
  const [launching, setLaunching] = useState(false);
  const [selectedRun, setSelectedRun] = useState<OptimizationRun | null>(null);
  const [runName, setRunName] = useState('');
  const [openLaunchModal, setOpenLaunchModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [runsData, linesData, terminalsData] = await Promise.all([optimizationApi.getAll(), linesApi.getAll(), terminalsApi.getAll()]);
      setRuns(extractArray(runsData));
      setLines(extractArray(linesData));
      setTerminals(extractArray(terminalsData));
      const user = getSessionUser();
      if (user?.companyId) {
        try { setActiveSettings(await optimizationSettingsApi.getActive(user.companyId)); } catch {}
      }
    } catch { notify.error('Erro ao carregar dados.'); }
  }, [notify]);

  const runsRef = useRef(runs);
  runsRef.current = runs;

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      const hasActive = runsRef.current.some(r => r.status === 'running' || r.status === 'pending');
      if (hasActive) loadAll();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleLaunch = async () => {
    if (!selectedLineIds.length) return notify.warning('Selecione ao menos uma linha.');
    setLaunching(true);
    try {
      const payload: any = {
        name: runName || undefined,
        companyId: getSessionUser()?.companyId ?? 1,
        algorithm: algorithm as OptimizationAlgorithm,
        operationMode,
        timeBudgetSeconds: timeBudget,
      };
      if (selectedLineIds.length === 1) payload.lineId = selectedLineIds[0];
      else payload.lineIds = selectedLineIds;
      await optimizationApi.run(payload);
      notify.success('Otimização Iniciada com Sucesso');
      setSelectedLineIds([]);
      setRunName('');
      setOpenLaunchModal(false);
      loadAll();
    } catch { notify.error('Erro ao iniciar otimização.'); }
    finally { setLaunching(false); }
  };

  const activeRun = runs.find(r => r.status === 'running');
  const historyRuns = runs.filter(r => r.status !== 'running' && r.status !== 'failed');
  const failedRuns = runs.filter(r => r.status === 'failed');
  const viewRun = activeRun || selectedRun;

  const [showFailed, setShowFailed] = useState(false);

  return (
    <PageContainer title="Cockpit de Escalonamento — OTIMIZ" description="Painel multi-visão de otimização">
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: -0.5 }}>Cockpit de Otimização</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Gerencie e analise as execuções do motor VSP+CSP</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip label={activeSettings?.name ? `Perfil: ${activeSettings.name}` : 'Sem perfil'} color="secondary" variant="outlined" size="small" />
          <Tooltip title="Recarregar"><IconButton onClick={loadAll} size="small" sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}><IconRefresh size={16} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlayerPlay size={16} />} onClick={() => setOpenLaunchModal(true)} disabled={activeRun != null} sx={{ borderRadius: 2.5 }}>
            Nova otimização
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>Histórico</Typography>
          </Box>

          <OtimizToolbar>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar histórico..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
            />
          </OtimizToolbar>

          {historyRuns.length === 0 && failedRuns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nenhuma execução.</Typography>
          ) : (
            <OtimizPanel contentSx={{ px: 0, pb: 0 }} sx={{ maxHeight: 'calc(100vh - 200px)' }}>
              <TableContainer component={Box} sx={{ maxHeight: 'calc(100vh - 280px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 1, fontWeight: 700 }}>ID/Nome</TableCell>
                      <TableCell sx={{ py: 1, fontWeight: 700 }} align="right">Resultado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historyRuns
                      .filter(r => !historySearch || String(r.id).includes(historySearch) || (r as any).name?.toLowerCase().includes(historySearch.toLowerCase()))
                      .slice(0, 15).map((r) => (
                      <TableRow
                        key={r.id}
                        hover
                        onClick={() => setSelectedRun(r)}
                        sx={{ cursor: 'pointer', bgcolor: selectedRun?.id === r.id ? alpha(theme.palette.primary.main, 0.12) : 'inherit' }}
                      >
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="caption" fontWeight={700}>#{r.id}{(r as any).name ? ` - ${(r as any).name}` : ''}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">{new Date(r.createdAt || '').toLocaleString('pt-BR')}</Typography>
                          <RunHistorySummary run={r} />
                        </TableCell>
                        <TableCell sx={{ py: 1 }} align="right">
                          <Typography variant="caption" fontWeight={700} color="success.main">{fmtCurrency(r.totalCost)}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}

                    {failedRuns.length > 0 && (
                      <>
                        <TableRow 
                          onClick={() => setShowFailed(!showFailed)} 
                          sx={{ cursor: 'pointer', bgcolor: alpha(theme.palette.error.main, 0.05) }}
                        >
                          <TableCell colSpan={2} sx={{ py: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {showFailed ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                              <Typography variant="caption" fontWeight={800} color="error.main">Execuções com Falha ({failedRuns.length})</Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                        {showFailed && failedRuns.map((r) => (
                           <TableRow
                            key={r.id}
                            hover
                            onClick={() => setSelectedRun(r)}
                            sx={{ cursor: 'pointer', bgcolor: selectedRun?.id === r.id ? alpha(theme.palette.error.main, 0.08) : 'inherit' }}
                          >
                            <TableCell sx={{ py: 1, pl: 4 }}>
                              <Typography variant="caption" fontWeight={700}>#{r.id}</Typography>
                              <Typography variant="caption" color="text.secondary" display="block">{new Date(r.createdAt || '').toLocaleString('pt-BR')}</Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1 }} align="right">
                              <Chip size="small" color="error" label="Falhou" variant="outlined" sx={{ height: 18, fontSize: 9 }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </OtimizPanel>
          )}
        </Grid>

        <Grid item xs={12} md={9}>
          <OtimizPanel sx={{ minHeight: 400 }}>
            {viewRun ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700}>
                    {activeRun ? `⏳ Execução #${activeRun.id} em Andamento` : `Resultados — Execução #${selectedRun!.id}`}
                  </Typography>
                  {selectedRun && !activeRun && (
                    <IconButton size="small" onClick={() => setSelectedRun(null)}><IconX size={18} /></IconButton>
                  )}
                </Stack>
                <RunVisuals run={viewRun} lines={lines} terminals={terminals} allRuns={runs} activeSettings={activeSettings} />
              </>
            ) : (
              <Box textAlign="center" py={10}>
                <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <IconChartBar size={28} color="#9E9E9E" />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} color="text.secondary">Nenhuma execução selecionada</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>Selecione um item no histórico ou inicie uma nova otimização.</Typography>
              </Box>
            )}
          </OtimizPanel>
        </Grid>
      </Grid>

        <Dialog open={openLaunchModal} onClose={() => setOpenLaunchModal(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Nova Otimização</DialogTitle>
          <DialogContent dividers>
            <TextField 
              fullWidth size="small" label="Nome da Execução (Opcional)" value={runName}
              onChange={(e) => setRunName(e.target.value)} sx={{ mb: 2, mt: 1 }}
            />
            <TextField
              select fullWidth size="small" label="Linhas"
              SelectProps={{ multiple: true }} value={selectedLineIds}
              onChange={(e) => setSelectedLineIds(typeof e.target.value === 'string' ? [] : e.target.value as number[])}
              sx={{ mb: 2 }}
            >
              {lines.map((l) => <MenuItem key={l.id} value={l.id}>{l.code} — {l.name}</MenuItem>)}
            </TextField>
            <TextField
              select fullWidth size="small" label="Algoritmo" value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)} sx={{ mb: 2 }}
            >
              <MenuItem value="hybrid_pipeline">Hybrid Pipeline (Padrão)</MenuItem>
              <MenuItem value="greedy">Greedy (Rápido)</MenuItem>
              <MenuItem value="simulated_annealing">Simulated Annealing</MenuItem>
              <MenuItem value="tabu_search">Tabu Search</MenuItem>
              <MenuItem value="set_partitioning">Set Partitioning (ILP)</MenuItem>
              <MenuItem value="joint_solver">Joint Solver</MenuItem>
            </TextField>
            <TextField
              select fullWidth size="small" label="Modo de Operação" value={operationMode}
              onChange={(e) => setOperationMode(e.target.value as 'urban' | 'charter')} sx={{ mb: 2 }}
            >
              <MenuItem value="urban">🚍 Urbano (CCT padrão)</MenuItem>
              <MenuItem value="charter">🚌 Fretamento (turno flexível)</MenuItem>
            </TextField>
            <TextField
              fullWidth size="small" label="Budget (segundos)" type="number"
              value={timeBudget}
              onChange={(e) => setTimeBudget(Math.max(5, parseInt(e.target.value) || 30))}
              inputProps={{ min: 5, max: 600 }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenLaunchModal(false)} color="inherit">Cancelar</Button>
            <Button variant="contained" onClick={handleLaunch} disabled={launching} startIcon={launching ? <IconRefresh /> : <IconPlayerPlay />}>
              {launching ? "Iniciando..." : "Otimizar"}
            </Button>
          </DialogActions>
        </Dialog>
    </PageContainer>
  );
}

export default function OptimizationPage() { return <NotifyProvider><OptimizationInner /></NotifyProvider>; }
