'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { alpha } from '@mui/material/styles';
import {
  Box, Grid, Typography, Button, Stack, Skeleton, Tooltip,
  IconButton, Chip, Divider, LinearProgress, Alert, AlertTitle,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TextField, MenuItem, useTheme, OutlinedInput, Select, FormControl,
  InputLabel, ListItemText, Checkbox, Collapse, FormHelperText,
  Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions,
  Tabs, Tab, Paper,
} from '@mui/material';
import {
  IconPlayerPlay, IconPlayerStop, IconRefresh, IconChartBar,
  IconRoute, IconRobot, IconClock, IconCurrencyDollar,
  IconBus, IconUsers, IconChevronDown, IconChevronUp,
  IconCheck, IconX, IconAlertTriangle, IconInfoCircle,
  IconEye, IconArrowRight, IconArrowLeft, IconSettings,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { optimizationApi, optimizationSettingsApi, linesApi, tripsApi, getSessionUser } from '@/lib/api';
import type {
  Line,
  OptimizationComparisonMetric,
  OptimizationCostBreakdown,
  OptimizationFailureDiagnostics,
  OptimizationPhaseSummary,
  OptimizationReproducibility,
  OptimizationRun,
  OptimizationRunAudit,
  OptimizationRunComparison,
  OptimizationSettings,
  OptimizationSolverExplanation,
  OptimizationStructuredIssue,
  OptimizationTripGroupAudit,
} from '../_types';
import { extractArray } from '../_types';
import {
  openOptimizationSettingsDrawer,
  OptimizationSettingsHighlights,
  OPTIMIZATION_SETTINGS_UPDATED_EVENT,
} from '../_components/OptimizationSettingsEditor';

// ── Helpers ──────────────────────────────────────────────────────────────────

function minToHHMM(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(Number(minutes))) return '--:--';
  const m = Math.abs(Number(minutes));
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function minToDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(Number(minutes))) return '--';
  const m = Math.floor(Math.abs(Number(minutes)));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min.toString().padStart(2, '0')}min` : `${h}h`;
}

function fmtDuration(ms?: number) {
  if (!ms) return '--';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function fmtDate(d?: string) {
  if (!d) return '--';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ── CCT limits ───────────────────────────────────────────────────────────────
const DEFAULT_CCT_MAX_SHIFT_MIN = 480;
const DEFAULT_CCT_MAX_WORK_MIN = 440;
const DEFAULT_CCT_MAX_OVERTIME_MIN = 120;
const DEFAULT_CCT_MAX_DRIVING_MIN = 270;
const DEFAULT_CCT_MIN_BREAK_MIN = 30;
const DEFAULT_VSP_MAX_VEHICLE_SHIFT_MIN = 1200;
const DEFAULT_VSP_MIN_LAYOVER_MIN = 10;

// ── Tipos internos ───────────────────────────────────────────────────────────
interface BlockResult {
  block_id: number;
  trips: number[];
  num_trips: number;
  start_time: number;
  end_time: number;
  activation_cost?: number;
  connection_cost?: number;
  distance_cost?: number;
  time_cost?: number;
  idle_cost?: number;
  total_cost?: number;
  warnings?: string[];
  meta?: Record<string, unknown>;
}

interface DutyResult {
  duty_id: number;
  blocks: number[];
  trip_ids?: number[];
  work_time: number;
  spread_time: number;
  rest_violations: number;
  warnings?: string[];
  paid_minutes?: number;
  overtime_minutes?: number;
  nocturnal_minutes?: number;
  work_cost?: number;
  guaranteed_cost?: number;
  waiting_cost?: number;
  overtime_cost?: number;
  long_unpaid_break_penalty?: number;
  nocturnal_extra_cost?: number;
  holiday_extra_cost?: number;
  cct_penalties_cost?: number;
  total_cost?: number;
  meta?: Record<string, unknown>;
}

interface OptResult {
  vehicles: number;
  crew: number;
  total_cost: number;
  cct_violations: number;
  unassigned_trips: number;
  uncovered_blocks: number;
  vsp_algorithm: string;
  csp_algorithm: string;
  elapsed_ms: number;
  blocks: BlockResult[];
  duties: DutyResult[];
  trip_details?: TripDetail[];
  cost_breakdown?: OptimizationCostBreakdown;
  solver_explanation?: OptimizationSolverExplanation;
  phase_summary?: OptimizationPhaseSummary;
  trip_group_audit?: OptimizationTripGroupAudit;
  reproducibility?: OptimizationReproducibility;
  warnings?: string[];
  meta?: Record<string, unknown>;
}

interface TripDetail {
  id: number;
  tripCode?: string;
  lineId: number;
  direction: 'outbound' | 'return';
  startTimeMinutes: number;
  endTimeMinutes: number;
  durationMinutes: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  idleBeforeMinutes?: number;
  idleAfterMinutes?: number;
  isPullOut?: boolean;
  isPullBack?: boolean;
  isActive?: boolean;
}

interface DutyWindow {
  blockId: number;
  start: number;
  end: number;
}

interface CctVisualLimits {
  maxShiftMin: number;
  maxWorkMin: number;
  maxOvertimeMin: number;
  hardLimitMin: number;
  maxDrivingMin: number;
  minBreakMin: number;
}

interface VspVisualLimits {
  maxVehicleShiftMin: number;
  minLayoverMin: number;
}

interface BlockIdleWindow {
  start: number;
  end: number;
  rawGapMin: number;
  penalizedGapMin: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function getResolvedParamsBucket(
  result?: OptResult | null,
  run?: OptimizationRun | null,
  audit?: OptimizationRunAudit | null,
  bucketKey?: 'cct' | 'vsp',
): Record<string, unknown> {
  if (!bucketKey) return {};

  const meta: Record<string, unknown> = isRecord(result?.meta) ? result.meta : {};
  const input: Record<string, unknown> = isRecord(meta['input']) ? (meta['input'] as Record<string, unknown>) : {};
  const metaBucketKey = `${bucketKey}_params`;
  const metaBucket: Record<string, unknown> = isRecord(input[metaBucketKey]) ? (input[metaBucketKey] as Record<string, unknown>) : {};
  const auditResolved: Record<string, unknown> = isRecord(audit?.resolvedParams) ? audit.resolvedParams : {};
  const auditBucket: Record<string, unknown> = isRecord(auditResolved[bucketKey]) ? (auditResolved[bucketKey] as Record<string, unknown>) : {};
  const runParams: Record<string, unknown> = isRecord(run?.params) ? run.params : {};
  const runResolved: Record<string, unknown> = isRecord(runParams['resolved']) ? (runParams['resolved'] as Record<string, unknown>) : {};
  const runBucket: Record<string, unknown> = isRecord(runResolved[bucketKey]) ? (runResolved[bucketKey] as Record<string, unknown>) : {};

  return {
    ...metaBucket,
    ...auditBucket,
    ...runBucket,
  };
}

function getCctVisualLimits(
  result?: OptResult | null,
  run?: OptimizationRun | null,
  audit?: OptimizationRunAudit | null,
): CctVisualLimits {
  const cct = getResolvedParamsBucket(result, run, audit, 'cct');
  const maxShiftMin = Number(cct.max_shift_minutes ?? DEFAULT_CCT_MAX_SHIFT_MIN) || DEFAULT_CCT_MAX_SHIFT_MIN;
  const maxWorkMin = Number(cct.max_work_minutes ?? DEFAULT_CCT_MAX_WORK_MIN) || DEFAULT_CCT_MAX_WORK_MIN;
  const maxOvertimeMin = Number(cct.overtime_limit_minutes ?? DEFAULT_CCT_MAX_OVERTIME_MIN) || DEFAULT_CCT_MAX_OVERTIME_MIN;
  const maxDrivingMin = Number(cct.max_driving_minutes ?? DEFAULT_CCT_MAX_DRIVING_MIN) || DEFAULT_CCT_MAX_DRIVING_MIN;
  const minBreakMin = Number(cct.min_break_minutes ?? DEFAULT_CCT_MIN_BREAK_MIN) || DEFAULT_CCT_MIN_BREAK_MIN;
  const overtimeHardLimitMin = maxWorkMin > 0 ? (maxWorkMin + maxOvertimeMin) : maxShiftMin;
  return {
    maxShiftMin,
    maxWorkMin,
    maxOvertimeMin,
    hardLimitMin: Math.min(maxShiftMin, overtimeHardLimitMin),
    maxDrivingMin,
    minBreakMin,
  };
}

function getVspVisualLimits(
  result?: OptResult | null,
  run?: OptimizationRun | null,
  audit?: OptimizationRunAudit | null,
): VspVisualLimits {
  const vsp = getResolvedParamsBucket(result, run, audit, 'vsp');
  return {
    maxVehicleShiftMin: Number(vsp.max_vehicle_shift_minutes ?? DEFAULT_VSP_MAX_VEHICLE_SHIFT_MIN) || DEFAULT_VSP_MAX_VEHICLE_SHIFT_MIN,
    minLayoverMin: Number(vsp.min_layover_minutes ?? DEFAULT_VSP_MIN_LAYOVER_MIN) || DEFAULT_VSP_MIN_LAYOVER_MIN,
  };
}

function normalizeTripDetail(raw: any): TripDetail | null {
  if (!raw || raw.id == null) return null;
  return {
    id: Number(raw.id),
    tripCode: raw.tripCode ?? raw.trip_code ?? undefined,
    lineId: Number(raw.lineId ?? raw.line_id ?? 0),
    direction: (raw.direction ?? 'outbound') === 'return' ? 'return' : 'outbound',
    startTimeMinutes: Number(raw.startTimeMinutes ?? raw.start_time_minutes ?? raw.start_time ?? 0),
    endTimeMinutes: Number(raw.endTimeMinutes ?? raw.end_time_minutes ?? raw.end_time ?? 0),
    durationMinutes: Number(raw.durationMinutes ?? raw.duration_minutes ?? raw.duration ?? 0),
    originTerminalId: raw.originTerminalId ?? raw.origin_terminal_id ?? undefined,
    destinationTerminalId: raw.destinationTerminalId ?? raw.destination_terminal_id ?? undefined,
    idleBeforeMinutes: raw.idleBeforeMinutes ?? raw.idle_before_minutes ?? undefined,
    idleAfterMinutes: raw.idleAfterMinutes ?? raw.idle_after_minutes ?? undefined,
    isPullOut: raw.isPullOut ?? raw.is_pull_out ?? undefined,
    isPullBack: raw.isPullBack ?? raw.is_pull_back ?? undefined,
    isActive: raw.isActive ?? raw.is_active ?? undefined,
  };
}

function mergeTripDetails(...groups: Array<any[]>): TripDetail[] {
  const merged = new Map<number, TripDetail>();
  for (const group of groups) {
    for (const rawTrip of group) {
      const trip = normalizeTripDetail(rawTrip);
      if (!trip) continue;
      merged.set(trip.id, trip);
    }
  }
  return Array.from(merged.values()).sort((a, b) => (a.startTimeMinutes - b.startTimeMinutes) || (a.id - b.id));
}

function getMetaNumber(meta: Record<string, unknown> | undefined, key: string): number | null {
  const value = meta?.[key];
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDutyMetaNumber(duty: DutyResult | undefined, key: string): number | null {
  return getMetaNumber(duty?.meta, key);
}

function getDutyOvertimeMinutes(duty: DutyResult | undefined, limits: CctVisualLimits): number {
  if (!duty) return 0;
  const spreadValue = Number(duty.spread_time ?? 0);
  if (Number.isFinite(spreadValue) && spreadValue > 0) {
    return Math.max(0, spreadValue - limits.maxWorkMin);
  }
  const solverValue = Number(duty.overtime_minutes ?? 0);
  if (Number.isFinite(solverValue) && solverValue > 0) return solverValue;
  return 0;
}

function getDutySpreadExcessMinutes(duty: DutyResult | undefined, limits: CctVisualLimits): number {
  if (!duty) return 0;
  return Math.max(0, duty.spread_time - limits.maxShiftMin);
}

function isDutyHardViolation(duty: DutyResult | undefined, limits: CctVisualLimits): boolean {
  if (!duty) return false;
  return duty.spread_time > limits.hardLimitMin;
}

function isDutySoftViolation(duty: DutyResult | undefined, limits: CctVisualLimits): boolean {
  if (!duty) return false;
  return getDutyOvertimeMinutes(duty, limits) > 0;
}

function getBlockMetaNumber(block: BlockResult | undefined, key: string): number | null {
  return getMetaNumber(block?.meta, key);
}

function getBlockOperationalStartMinutes(block: BlockResult | undefined, trip?: TripDetail): number {
  const serviceStart = trip?.startTimeMinutes ?? block?.start_time ?? 0;
  return getBlockMetaNumber(block, 'operational_start_minutes') ?? (serviceStart - getBlockStartBufferMinutes(block, trip));
}

function getBlockOperationalEndMinutes(block: BlockResult | undefined, trip?: TripDetail): number {
  const serviceEnd = trip?.endTimeMinutes ?? block?.end_time ?? 0;
  return getBlockMetaNumber(block, 'operational_end_minutes') ?? (serviceEnd + getBlockEndBufferMinutes(block, trip));
}

function getBlockIdleWindows(sortedTrips: TripDetail[], minLayoverMin: number): BlockIdleWindow[] {
  return sortedTrips
    .slice(0, -1)
    .map((trip, idx) => {
      const nextTrip = sortedTrips[idx + 1];
      if (!nextTrip) return null;
      const rawGapMin = Math.max(0, nextTrip.startTimeMinutes - trip.endTimeMinutes);
      if (rawGapMin <= 0) return null;
      return {
        start: trip.endTimeMinutes,
        end: nextTrip.startTimeMinutes,
        rawGapMin,
        penalizedGapMin: Math.max(0, rawGapMin - minLayoverMin),
      };
    })
    .filter(Boolean) as BlockIdleWindow[];
}

function getDutyRosterId(duty: DutyResult | undefined): number | null {
  return getDutyMetaNumber(duty, 'roster_id');
}

function getDutyDisplayLabel(dutyId: number, duty?: DutyResult): string {
  const rosterId = getDutyRosterId(duty);
  return rosterId != null ? `P${dutyId} · R${rosterId}` : `P${dutyId}`;
}

function getDutySourceBlockIds(duty: DutyResult | undefined): number[] {
  const raw = Array.isArray((duty?.meta as any)?.source_block_ids)
    ? ((duty?.meta as any).source_block_ids as any[])
    : [];
  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function getTripStartBufferMinutes(trip?: TripDetail): number {
  if (!trip?.isPullOut) return 0;
  const value = Number(trip.idleBeforeMinutes ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getTripEndBufferMinutes(trip?: TripDetail): number {
  if (!trip?.isPullBack) return 0;
  const value = Number(trip.idleAfterMinutes ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getBlockStartBufferMinutes(block: BlockResult | undefined, trip?: TripDetail): number {
  return getBlockMetaNumber(block, 'start_buffer_minutes') ?? getTripStartBufferMinutes(trip);
}

function getBlockEndBufferMinutes(block: BlockResult | undefined, trip?: TripDetail): number {
  return getBlockMetaNumber(block, 'end_buffer_minutes') ?? getTripEndBufferMinutes(trip);
}

function getDutyTaskWindows(duty: DutyResult, blocks: BlockResult[]): DutyWindow[] {
  const raw = Array.isArray((duty.meta as any)?.task_windows) ? ((duty.meta as any).task_windows as any[]) : [];
  const knownBlockIds = new Set(blocks.map((block) => block.block_id));
  const sourceBlockIds = getDutySourceBlockIds(duty).filter((blockId) => knownBlockIds.has(blockId));
  const fromMeta = raw.map((entry) => {
    const blockId = Number(entry?.block_id ?? entry?.blockId ?? 0);
    const start = Number(entry?.start ?? entry?.start_time ?? 0);
    const end = Number(entry?.end ?? entry?.end_time ?? 0);
    if (!Number.isFinite(blockId) || !Number.isFinite(start) || !Number.isFinite(end)) return null;
    const matchingBlockId = knownBlockIds.has(blockId)
      ? blockId
      : blocks.find((block) => start >= block.start_time && end <= block.end_time)?.block_id
        ?? (sourceBlockIds.length === 1 ? sourceBlockIds[0] : blockId);
    return { blockId: matchingBlockId, start, end };
  }).filter(Boolean) as DutyWindow[];

  if (fromMeta.length > 0) {
    return fromMeta.sort((a, b) => (a.start - b.start) || (a.blockId - b.blockId));
  }

  return blocks
    .map((block) => ({ blockId: block.block_id, start: block.start_time, end: block.end_time }))
    .sort((a, b) => (a.start - b.start) || (a.blockId - b.blockId));
}

function getDutyOperationalBounds(duty: DutyResult, sortedTrips: TripDetail[], blocks: BlockResult[]) {
  const rawStart = sortedTrips.length > 0
    ? sortedTrips[0].startTimeMinutes
    : (blocks.length > 0 ? Math.min(...blocks.map((block) => block.start_time)) : null);
  const rawEnd = sortedTrips.length > 0
    ? sortedTrips[sortedTrips.length - 1].endTimeMinutes
    : (blocks.length > 0 ? Math.max(...blocks.map((block) => block.end_time)) : null);
  const startBuffer = getDutyMetaNumber(duty, 'start_buffer_minutes') ?? getTripStartBufferMinutes(sortedTrips[0]);
  const endBuffer = getDutyMetaNumber(duty, 'end_buffer_minutes') ?? getTripEndBufferMinutes(sortedTrips[sortedTrips.length - 1]);
  const dutyStart = getDutyMetaNumber(duty, 'duty_start_minutes') ?? (rawStart != null ? rawStart - startBuffer : null);
  const dutyEnd = getDutyMetaNumber(duty, 'duty_end_minutes') ?? (rawEnd != null ? rawEnd + endBuffer : null);
  return { rawStart, rawEnd, startBuffer, endBuffer, dutyStart, dutyEnd };
}

function getGapChipColor(gap: number, limits: CctVisualLimits): 'error' | 'warning' | 'success' {
  if (gap < limits.minBreakMin) return 'error';
  if (gap < 60) return 'warning';
  return 'success';
}

function getBlockAssignedDutyIds(block: BlockResult, tripToDuty: Map<number, number>): number[] {
  return Array.from(new Set(
    (block.trips ?? [])
      .map((tripId) => tripToDuty.get(tripId))
      .filter((dutyId): dutyId is number => dutyId != null),
  ));
}

function fmtCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '--';
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fmtRatioPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  return `${(Number(value) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function fmtPercentValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '--';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function formatLabel(key: string): string {
  const labels: Record<string, string> = {
    vehicles: 'Veiculos',
    crew: 'Tripulantes',
    totalCost: 'Custo total',
    total: 'Total',
    cctViolations: 'Violacoes CCT',
    hardIssues: 'Issues hard',
    softIssues: 'Issues soft',
    unassignedTrips: 'Viagens sem cobertura',
    uncoveredBlocks: 'Blocos sem cobertura',
    vsp_total: 'VSP total',
    vsp_activation: 'Ativacao VSP',
    vsp_connection: 'Conexao VSP',
    vsp_distance: 'Distancia VSP',
    vsp_time: 'Tempo VSP',
    vsp_idle_cost: 'Custo de ociosidade VSP',
    csp_total: 'CSP total',
    csp_work_cost: 'Custo de trabalho',
    csp_guaranteed_cost: 'Complemento de horas garantidas',
    csp_waiting_cost: 'Custo de espera',
    csp_overtime_cost: 'Adicional de hora extra',
    csp_long_break_penalty: 'Penalidade de intervalo longo',
    csp_nocturnal_extra: 'Adicional noturno',
    csp_holiday_extra: 'Adicional feriado',
    csp_cct_penalties: 'Penalidades CCT',
    activation: 'Ativacao',
    connection: 'Conexao',
    distance: 'Distancia',
    time: 'Tempo',
    idle_cost: 'Custo de ociosidade',
    work_cost: 'Custo de trabalho',
    guaranteed_cost: 'Complemento garantido',
    waiting_cost: 'Custo de espera',
    overtime_cost: 'Adicional de hora extra',
    long_unpaid_break_penalty: 'Penalidade de intervalo longo',
    nocturnal_extra: 'Adicional noturno',
    holiday_extra: 'Adicional feriado',
    cct_penalties: 'Penalidades CCT',
    nocturnal_extra_cost: 'Adicional noturno',
    holiday_extra_cost: 'Adicional feriado',
    cct_penalties_cost: 'Penalidades CCT',
    random_seed: 'Seed',
    solver_version: 'Versao do solver',
  };
  if (labels[key]) return labels[key];
  const normalized = key.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDiffValue(value: unknown): string {
  if (value == null || value === '') return '--';
  if (typeof value === 'boolean') return value ? 'sim' : 'nao';
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  return String(value);
}

function formatComparisonValue(key: string, value: number): string {
  const currencyLike = [
    'cost',
    'total',
    'activation',
    'connection',
    'distance',
    'time',
    'work',
    'waiting',
    'penalty',
    'extra',
  ];
  if (currencyLike.some((token) => key.toLowerCase().includes(token))) {
    return fmtCurrency(value);
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function getExplanationSeverity(status?: string): 'success' | 'warning' | 'error' | 'info' {
  if (status === 'hard_violation') return 'error';
  if (status === 'soft_violation') return 'warning';
  if (status === 'feasible') return 'success';
  return 'info';
}

function isEmptyJsonValue(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

function JsonPreview({
  title,
  value,
  emptyText = 'Sem dados disponiveis nesta execucao.',
}: {
  title: string;
  value: unknown;
  emptyText?: string;
}) {
  const hasValue = !isEmptyJsonValue(value);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700} mb={1}>{title}</Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: 'grey.50',
          fontSize: 12,
          overflow: 'auto',
          maxHeight: 240,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {hasValue ? JSON.stringify(value, null, 2) : emptyText}
      </Box>
    </Paper>
  );
}

function ComparisonMetricsTable({
  title,
  metrics,
}: {
  title: string;
  metrics?: Record<string, OptimizationComparisonMetric> | null;
}) {
  const theme = useTheme();
  if (!metrics || Object.keys(metrics).length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.100' }}>
            <TableCell sx={{ fontWeight: 700 }}>Metrica</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Base</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Comparada</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Delta</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>% Delta</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(metrics)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, metric]) => {
              const deltaColor = metric.delta < 0
                ? theme.palette.success.main
                : metric.delta > 0
                ? theme.palette.error.main
                : theme.palette.text.secondary;
              const deltaLabel = metric.delta > 0
                ? `+${formatComparisonValue(key, metric.delta)}`
                : formatComparisonValue(key, metric.delta);
              return (
                <TableRow key={key} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{formatLabel(key)}</Typography>
                  </TableCell>
                  <TableCell align="right">{formatComparisonValue(key, metric.base)}</TableCell>
                  <TableCell align="right">{formatComparisonValue(key, metric.other)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700} sx={{ color: deltaColor }}>
                      {deltaLabel}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{fmtPercentValue(metric.pctDelta)}</TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </Paper>
  );
}

function RunExplainabilityPanel({
  res,
  audit,
}: {
  res: OptResult;
  audit: OptimizationRunAudit | null;
}) {
  const solverExplanation = (audit?.result?.solverExplanation ?? res.solver_explanation ?? (res.meta as any)?.solver_explanation ?? null) as OptimizationSolverExplanation | null;
  const costBreakdown = (audit?.result?.costBreakdown ?? res.cost_breakdown ?? (res.meta as any)?.cost_breakdown ?? null) as OptimizationCostBreakdown | null;
  const phaseSummary = (audit?.result?.phaseSummary ?? res.phase_summary ?? (res.meta as any)?.phase_summary ?? null) as OptimizationPhaseSummary | null;
  const tripGroupAudit = (audit?.result?.tripGroupAudit ?? res.trip_group_audit ?? (res.meta as any)?.trip_group_audit ?? null) as OptimizationTripGroupAudit | null;
  const reproducibility = (res.reproducibility ?? (res.meta as any)?.reproducibility ?? null) as OptimizationReproducibility | null;
  const performance = (audit?.result?.performance ?? (res.meta as any)?.performance ?? null) as Record<string, any> | null;
  const solverVersion = audit?.result?.solverVersion ?? ((res.meta as any)?.solver_version as string | undefined) ?? null;
  const phaseTimings = (performance?.phase_timings_ms ?? null) as Record<string, number> | null;
  const issues = [
    ...(solverExplanation?.issues?.hard ?? []),
    ...(solverExplanation?.issues?.soft ?? []),
  ] as OptimizationStructuredIssue[];
  const vspBucket = ((costBreakdown?.vsp as Record<string, number | undefined> | undefined) ?? {});
  const cspBucket = ((costBreakdown?.csp as Record<string, number | undefined> | undefined) ?? {});
  const vspCostRows = ['activation', 'connection', 'distance', 'time', 'idle_cost']
    .map((key) => ({ key, value: vspBucket[key] }))
    .filter((item) => item.value != null && Number(item.value) !== 0);
  const cspCostRows = ['work_cost', 'guaranteed_cost', 'waiting_cost', 'overtime_cost', 'long_unpaid_break_penalty', 'nocturnal_extra', 'holiday_extra', 'cct_penalties']
    .map((key) => ({ key, value: cspBucket[key] }))
    .filter((item) => item.value != null && Number(item.value) !== 0);

  if (!solverExplanation && !costBreakdown && !phaseSummary && !tripGroupAudit && !reproducibility && !solverVersion) {
    return <Alert severity="info">Explicabilidade detalhada nao disponivel para esta execucao.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {solverExplanation && (
        <Alert severity={getExplanationSeverity(solverExplanation.status)} sx={{ borderRadius: 2 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>{solverExplanation.headline ?? 'Resumo do solver'}</AlertTitle>
          {Array.isArray(solverExplanation.summary) && solverExplanation.summary.length > 0 ? (
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {solverExplanation.summary.map((item) => (
                <Box component="li" key={item} sx={{ mb: 0.5 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
          ) : null}
        </Alert>
      )}

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {solverVersion ? <Chip label={`Solver ${solverVersion}`} variant="outlined" /> : null}
        {reproducibility?.random_seed != null ? <Chip label={`Seed ${reproducibility.random_seed}`} color="primary" variant="outlined" /> : null}
        {reproducibility ? (
          <Chip
            label={reproducibility.deterministic_replay_possible ? 'Replay deterministico possivel' : 'Replay nao deterministico'}
            color={reproducibility.deterministic_replay_possible ? 'success' : 'warning'}
            variant="outlined"
          />
        ) : null}
        {tripGroupAudit?.groups_total ? (
          <Chip
            label={`Trip groups no mesmo roster: ${tripGroupAudit.same_roster_groups ?? 0}/${tripGroupAudit.groups_total}`}
            color={(tripGroupAudit.split_groups ?? 0) > 0 ? 'warning' : 'success'}
            variant="outlined"
          />
        ) : null}
      </Stack>

      {costBreakdown && (
        <>
          <Grid container spacing={2}>
            {[
              {
                label: 'Custo total',
                value: fmtCurrency(costBreakdown.total),
                sub: 'Composicao consolidada VSP + CSP',
                color: 'warning.main',
              },
              {
                label: 'Custo VSP',
                value: fmtCurrency((costBreakdown.vsp as Record<string, number | undefined> | undefined)?.total),
                sub: `Dominante: ${formatLabel(String(phaseSummary?.vsp?.dominant_cost_component?.component ?? '--'))}`,
                color: 'primary.main',
              },
              {
                label: 'Custo CSP',
                value: fmtCurrency((costBreakdown.csp as Record<string, number | undefined> | undefined)?.total),
                sub: `Dominante: ${formatLabel(String(phaseSummary?.csp?.dominant_cost_component?.component ?? '--'))}`,
                color: 'success.main',
              },
            ].map((item) => (
              <Grid item xs={12} md={4} key={item.label}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ color: item.color }}>{item.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.sub}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Breakdown VSP</Typography>
                </Box>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right">{fmtCurrency(vspBucket.total)}</TableCell>
                    </TableRow>
                    {vspCostRows.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{formatLabel(item.key)}</TableCell>
                        <TableCell align="right">{fmtCurrency(item.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Breakdown CSP</Typography>
                </Box>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right">{fmtCurrency(cspBucket.total)}</TableCell>
                    </TableRow>
                    {cspCostRows.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{formatLabel(item.key)}</TableCell>
                        <TableCell align="right">{fmtCurrency(item.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {phaseSummary && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Fase VSP</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip label={`Veiculos: ${phaseSummary.vsp?.vehicles ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Viagens atribuidas: ${phaseSummary.vsp?.assigned_trips ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Viagens sem cobertura: ${phaseSummary.vsp?.unassigned_trips ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Avisos: ${phaseSummary.vsp?.warnings_count ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Custo: ${fmtCurrency(phaseSummary.vsp?.cost as number | undefined)}`} size="small" variant="outlined" />
              </Stack>
              {phaseSummary.vsp?.dominant_cost_component?.component ? (
                <Typography variant="body2" color="text.secondary" mt={1.25}>
                  Componente dominante: {formatLabel(String(phaseSummary.vsp.dominant_cost_component.component))}
                  {' · '}valor {fmtCurrency(phaseSummary.vsp.dominant_cost_component.value)}
                  {' · '}share {fmtRatioPercent(phaseSummary.vsp.dominant_cost_component.share)}
                </Typography>
              ) : null}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Fase CSP</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip label={`Duties: ${phaseSummary.csp?.duties ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Tripulantes: ${phaseSummary.csp?.crew ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Rosters: ${phaseSummary.csp?.rosters ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Violacoes CCT: ${phaseSummary.csp?.cct_violations ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Blocos descobertos: ${phaseSummary.csp?.uncovered_blocks ?? '--'}`} size="small" variant="outlined" />
                <Chip label={`Custo: ${fmtCurrency(phaseSummary.csp?.cost as number | undefined)}`} size="small" variant="outlined" />
              </Stack>
              {phaseSummary.csp?.dominant_cost_component?.component ? (
                <Typography variant="body2" color="text.secondary" mt={1.25}>
                  Componente dominante: {formatLabel(String(phaseSummary.csp.dominant_cost_component.component))}
                  {' · '}valor {fmtCurrency(phaseSummary.csp.dominant_cost_component.value)}
                  {' · '}share {fmtRatioPercent(phaseSummary.csp.dominant_cost_component.share)}
                </Typography>
              ) : null}
            </Paper>
          </Grid>
        </Grid>
      )}

      {issues.length > 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Issues estruturados</Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 700 }}>Severidade</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Fase</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Codigo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Mensagem</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Refs</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={`${issue.severity}-${issue.code}-${issue.raw}`} hover>
                  <TableCell>
                    <Chip
                      size="small"
                      label={issue.severity === 'hard' ? 'Hard' : 'Soft'}
                      color={issue.severity === 'hard' ? 'error' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>{String(issue.phase ?? '--').toUpperCase()}</TableCell>
                  <TableCell><Typography variant="body2" fontFamily="monospace">{issue.code ?? '--'}</Typography></TableCell>
                  <TableCell>{issue.message ?? issue.raw ?? '--'}</TableCell>
                  <TableCell>{issue.refs?.join(', ') || '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {solverExplanation?.recommendations?.length ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>Recomendacoes do solver</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {solverExplanation.recommendations.map((item) => (
              <Box component="li" key={item} sx={{ mb: 0.5 }}>
                <Typography variant="body2">{item}</Typography>
              </Box>
            ))}
          </Box>
        </Alert>
      ) : null}

      {tripGroupAudit?.groups_total ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Auditoria de trip_group</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} mb={tripGroupAudit.sample_splits?.length ? 1.5 : 0}>
            <Chip label={`Total: ${tripGroupAudit.groups_total}`} size="small" variant="outlined" />
            <Chip label={`Mesmo bloco: ${tripGroupAudit.same_block_groups ?? 0}`} size="small" variant="outlined" />
            <Chip label={`Mesmo duty: ${tripGroupAudit.same_duty_groups ?? 0}`} size="small" variant="outlined" />
            <Chip label={`Mesmo roster: ${tripGroupAudit.same_roster_groups ?? 0}`} size="small" color={(tripGroupAudit.split_groups ?? 0) > 0 ? 'warning' : 'success'} variant="outlined" />
            <Chip label={`Splits: ${tripGroupAudit.split_groups ?? 0}`} size="small" color={(tripGroupAudit.split_groups ?? 0) > 0 ? 'warning' : 'success'} variant="outlined" />
            <Chip label={`Missing: ${tripGroupAudit.missing_groups ?? 0}`} size="small" variant="outlined" />
            <Chip label={`Taxa mesmo roster: ${fmtRatioPercent(tripGroupAudit.same_roster_ratio)}`} size="small" variant="outlined" />
          </Stack>
          {tripGroupAudit.sample_splits?.length ? (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Trip group</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Trips</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Blocos</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Duties</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Rosters</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tripGroupAudit.sample_splits.map((item) => (
                  <TableRow key={`group-${item.trip_group_id}`} hover>
                    <TableCell>{item.trip_group_id ?? '--'}</TableCell>
                    <TableCell>{item.trip_ids?.join(', ') || '--'}</TableCell>
                    <TableCell>{item.block_ids?.join(', ') || '--'}</TableCell>
                    <TableCell>{item.duty_ids?.join(', ') || '--'}</TableCell>
                    <TableCell>{item.roster_ids?.join(', ') || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Paper>
      ) : null}

      {(reproducibility || phaseTimings) && (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Reprodutibilidade e performance</Typography>
          {reproducibility ? (
            <Alert severity={reproducibility.deterministic_replay_possible ? 'success' : 'warning'} sx={{ mb: phaseTimings ? 1.5 : 0 }}>
              <AlertTitle sx={{ fontWeight: 700 }}>Replay</AlertTitle>
              {reproducibility.note ?? 'Sem nota de reprodutibilidade.'}
            </Alert>
          ) : null}
          {phaseTimings ? (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {Object.entries(phaseTimings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <Chip key={key} label={`${formatLabel(key)}: ${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}ms`} size="small" variant="outlined" />
                ))}
            </Stack>
          ) : null}
        </Paper>
      )}
    </Stack>
  );
}

function RunAuditComparePanel({
  run,
  audit,
  auditLoading,
  availableRuns,
}: {
  run: OptimizationRun;
  audit: OptimizationRunAudit | null;
  auditLoading: boolean;
  availableRuns: OptimizationRun[];
}) {
  const [compareTargetId, setCompareTargetId] = useState('');
  const [comparison, setComparison] = useState<OptimizationRunComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const compareCandidates = availableRuns.filter(
    (candidate) => candidate.id !== run.id && candidate.status !== 'pending' && candidate.status !== 'running'
  );
  const phaseTimings = ((audit?.result?.performance as any)?.phase_timings_ms ?? null) as Record<string, number> | null;

  useEffect(() => {
    const firstCandidate = availableRuns.find(
      (candidate) => candidate.id !== run.id && candidate.status !== 'pending' && candidate.status !== 'running'
    );
    setCompareTargetId(firstCandidate ? String(firstCandidate.id) : '');
    setComparison(null);
    setComparisonError(null);
    setComparisonLoading(false);
  }, [run.id, availableRuns]);

  const handleCompare = async () => {
    if (!compareTargetId) return;
    setComparisonLoading(true);
    setComparisonError(null);
    try {
      const data = await optimizationApi.compare(run.id, Number(compareTargetId));
      setComparison(data as OptimizationRunComparison);
    } catch (error: any) {
      setComparison(null);
      setComparisonError(error?.response?.data?.message ?? error?.message ?? 'Nao foi possivel comparar as execucoes.');
    } finally {
      setComparisonLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5} mb={1}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Auditoria da execucao</Typography>
            <Typography variant="body2" color="text.secondary">
              Versionamento de regras, parametros resolvidos e telemetria persistida do backend.
            </Typography>
          </Box>
          {auditLoading ? <LinearProgress sx={{ width: { xs: '100%', md: 180 }, alignSelf: 'center' }} /> : null}
        </Stack>

        {audit ? (
          <>
            <Stack direction="row" flexWrap="wrap" gap={1} mb={phaseTimings ? 1.25 : 0}>
              <Chip label={`Run #${audit.runId}`} size="small" variant="outlined" />
              <Chip label={`Status: ${audit.status}`} size="small" variant="outlined" />
              <Chip label={`Algoritmo: ${audit.algorithm}`} size="small" variant="outlined" />
              <Chip label={`Duracao: ${fmtDuration(audit.durationMs)}`} size="small" variant="outlined" />
              {audit.result?.solverVersion ? <Chip label={`Solver: ${audit.result.solverVersion}`} size="small" variant="outlined" /> : null}
              {audit.versioning?.ruleHash ? <Chip label={`ruleHash: ${String(audit.versioning.ruleHash)}`} size="small" variant="outlined" /> : null}
              {audit.versioning?.inputHash ? <Chip label={`inputHash: ${String(audit.versioning.inputHash)}`} size="small" variant="outlined" /> : null}
              {audit.versioning?.settingsVersion ? <Chip label={`settings: ${String(audit.versioning.settingsVersion)}`} size="small" variant="outlined" /> : null}
            </Stack>
            {phaseTimings ? (
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {Object.entries(phaseTimings)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, value]) => (
                    <Chip key={key} label={`${formatLabel(key)}: ${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}ms`} size="small" variant="outlined" />
                  ))}
              </Stack>
            ) : null}
          </>
        ) : (
          <Alert severity="info">
            {auditLoading ? 'Carregando auditoria...' : 'Auditoria estruturada indisponivel para esta execucao.'}
          </Alert>
        )}
      </Paper>

      {audit ? (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}><JsonPreview title="Parametros solicitados" value={audit.requestedParams} /></Grid>
          <Grid item xs={12} md={4}><JsonPreview title="Parametros resolvidos" value={audit.resolvedParams} /></Grid>
          <Grid item xs={12} md={4}><JsonPreview title="Snapshot de regras" value={audit.settingsSnapshot} /></Grid>
        </Grid>
      ) : null}

      {audit?.result?.failureDiagnostics || audit?.result?.optimizerDiagnostics ? (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <JsonPreview
              title="Diagnostico de falha"
              value={audit?.result?.failureDiagnostics}
              emptyText="Sem diagnostico de falha estruturado."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <JsonPreview
              title="Diagnostico bruto do otimizador"
              value={audit?.result?.optimizerDiagnostics}
              emptyText="Sem payload bruto do otimizador."
            />
          </Grid>
        </Grid>
      ) : null}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} mb={1}>Comparar com outra execucao</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            select
            size="small"
            fullWidth
            label="Execucao alvo"
            value={compareTargetId}
            onChange={(event) => setCompareTargetId(event.target.value)}
            disabled={compareCandidates.length === 0}
          >
            {compareCandidates.length === 0 ? (
              <MenuItem value="">Nenhuma execucao comparavel</MenuItem>
            ) : compareCandidates.map((candidate) => (
              <MenuItem key={candidate.id} value={String(candidate.id)}>
                #{candidate.id} · {candidate.algorithm} · {candidate.status} · {fmtDate(candidate.createdAt)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={handleCompare}
            disabled={!compareTargetId || comparisonLoading}
          >
            {comparisonLoading ? 'Comparando...' : 'Comparar'}
          </Button>
        </Stack>

        {comparisonLoading ? <LinearProgress sx={{ mt: 1.5 }} /> : null}
        {comparisonError ? <Alert severity="error" sx={{ mt: 1.5 }}>{comparisonError}</Alert> : null}

        {comparison ? (
          <Stack spacing={2} sx={{ mt: 1.5 }}>
            <Alert
              severity={comparison.summary?.betterRunId == null ? 'info' : comparison.summary?.betterRunId === run.id ? 'success' : 'warning'}
              sx={{ borderRadius: 2 }}
            >
              <AlertTitle sx={{ fontWeight: 700 }}>
                {comparison.summary?.betterRunId == null
                  ? 'Empate tecnico'
                  : comparison.summary?.betterRunId === run.id
                  ? 'A execucao atual ficou melhor'
                  : `A execucao #${comparison.summary?.betterRunId} ficou melhor`}
              </AlertTitle>
              {comparison.summary?.headline ?? 'Comparacao concluida.'}
            </Alert>

            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip label={`Base: ${comparison.algorithms?.base ?? '--'}`} size="small" variant="outlined" />
              <Chip label={`Comparada: ${comparison.algorithms?.other ?? '--'}`} size="small" variant="outlined" />
              {comparison.versioning?.base?.ruleHash ? <Chip label={`ruleHash base: ${String(comparison.versioning.base.ruleHash)}`} size="small" variant="outlined" /> : null}
              {comparison.versioning?.other?.ruleHash ? <Chip label={`ruleHash comparada: ${String(comparison.versioning.other.ruleHash)}`} size="small" variant="outlined" /> : null}
            </Stack>

            <ComparisonMetricsTable title="Metricas principais" metrics={comparison.metrics} />
            <ComparisonMetricsTable title="Breakdown de custo" metrics={comparison.costBreakdown} />

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <JsonPreview
                  title="Diferencas de parametros resolvidos"
                  value={comparison.paramsDiff?.slice(0, 20) ?? []}
                  emptyText="Sem diferencas relevantes de parametros."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <JsonPreview
                  title="Diferencas de configuracao"
                  value={comparison.settingsDiff?.slice(0, 20) ?? []}
                  emptyText="Sem diferencas relevantes no snapshot de regras."
                />
              </Grid>
            </Grid>
          </Stack>
        ) : null}
      </Paper>
    </Stack>
  );
}

// ── Algoritmos ───────────────────────────────────────────────────────────────
type AlgorithmValue =
  | 'full_pipeline' | 'hybrid_pipeline' | 'greedy'
  | 'vsp_only' | 'csp_only'
  | 'genetic' | 'simulated_annealing' | 'tabu_search'
  | 'set_partitioning' | 'joint_solver';

interface AlgorithmDef {
  value: AlgorithmValue;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error';
}

const ALGORITHMS: AlgorithmDef[] = [
  { value: 'full_pipeline',       label: 'Pipeline Completo (VSP+CSP)',     description: 'Greedy VSP + Greedy CSP sequencialmente', badge: 'Recomendado', badgeColor: 'success' },
  { value: 'hybrid_pipeline',     label: 'Pipeline Hibrido',                description: 'Greedy-SA-Tabu-GA-ILP | melhor qualidade', badge: 'Melhor', badgeColor: 'primary' },
  { value: 'greedy',              label: 'Heuristica Gulosa',               description: 'Solucao rapida | boa base de comparacao' },
  { value: 'genetic',             label: 'Algoritmo Genetico (GA)',          description: 'Otimizacao evolutiva com selecao e crossover', badge: 'Evolutivo', badgeColor: 'secondary' },
  { value: 'simulated_annealing', label: 'Simulated Annealing (SA)',        description: 'Aceita piores solucoes para escapar de minimos locais' },
  { value: 'tabu_search',         label: 'Tabu Search',                     description: 'Busca local com memoria - evita revisitar solucoes' },
  { value: 'set_partitioning',    label: 'Set Partitioning (ILP)',           description: 'Solucao exata por programacao inteira', badge: 'Exato', badgeColor: 'info' },
  { value: 'joint_solver',        label: 'Solucionador Conjunto (VSP+CSP)', description: 'Resolve VSP e CSP de forma integrada', badge: 'Integrado', badgeColor: 'warning' },
  { value: 'vsp_only',            label: 'Apenas VSP',                      description: 'Programa somente veiculos (sem escala de tripulantes)' },
  { value: 'csp_only',            label: 'Apenas CSP',                      description: 'Programa somente tripulantes (requer blocos prontos)' },
];

// ── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: 'default' | 'info' | 'warning' | 'success' | 'error'; label: string }> = {
    pending:   { color: 'info',    label: 'Pendente' },
    running:   { color: 'warning', label: 'Executando' },
    completed: { color: 'success', label: 'Concluido' },
    failed:    { color: 'error',   label: 'Erro' },
    cancelled: { color: 'default', label: 'Cancelado' },
  };
  const s = map[status] ?? { color: 'default', label: status };
  return <Chip size="small" color={s.color} label={s.label} />;
}

// ── Componente: linha colapsavel de bloco (Tab Por Veiculo) ──────────────────
function BlockRow({
  block, duty, tripMap, tripToDuty, dutiesMap, lines, vehicleLimits,
}: {
  block: BlockResult;
  duty: DutyResult | undefined;
  tripMap: Map<number, TripDetail>;
  tripToDuty: Map<number, number>;
  dutiesMap: Map<number, DutyResult>;
  lines: Line[];
  vehicleLimits: VspVisualLimits;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const trips  = (block.trips ?? []).map((tid) => tripMap.get(tid)).filter(Boolean) as TripDetail[];
  const sortedTrips = [...trips].sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);
  const assignedDutyIds = getBlockAssignedDutyIds(block, tripToDuty);
  const summaryDutyId = assignedDutyIds.length === 1 ? assignedDutyIds[0] : duty?.duty_id;
  const summaryDuty = summaryDutyId != null ? (dutiesMap.get(summaryDutyId) ?? duty) : duty;
  const startBuffer = getBlockStartBufferMinutes(block, sortedTrips[0]);
  const endBuffer = getBlockEndBufferMinutes(block, sortedTrips[sortedTrips.length - 1]);
  const serviceStart = sortedTrips[0]?.startTimeMinutes ?? block.start_time;
  const serviceEnd = sortedTrips[sortedTrips.length - 1]?.endTimeMinutes ?? block.end_time;
  const operationalStart = getBlockOperationalStartMinutes(block, sortedTrips[0]);
  const operationalEnd = getBlockOperationalEndMinutes(block, sortedTrips[sortedTrips.length - 1]);
  const dur = Math.max(0, operationalEnd - operationalStart);
  const exceedsVehicleLimit = dur > vehicleLimits.maxVehicleShiftMin;
  const idleWindows = getBlockIdleWindows(sortedTrips, vehicleLimits.minLayoverMin);
  const rawIdleMinutes = idleWindows.reduce((sum, window) => sum + window.rawGapMin, 0);
  const penalizedIdleMinutes = getBlockMetaNumber(block, 'idle_minutes')
    ?? idleWindows.reduce((sum, window) => sum + window.penalizedGapMin, 0);
  const blockCostDetails = [
    { label: 'Ativacao', value: block.activation_cost },
    { label: 'Conexao', value: block.connection_cost },
    { label: 'Distancia', value: block.distance_cost },
    { label: 'Tempo', value: block.time_cost },
    { label: 'Ociosidade', value: block.idle_cost },
  ].filter((item) => item.value != null && Number(item.value) !== 0);

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: 'pointer',
          bgcolor: exceedsVehicleLimit ? 'error.lighter' : penalizedIdleMinutes > 0 ? 'warning.lighter' : undefined,
        }}
      >
        <TableCell sx={{ width: 36, pr: 0 }}>
          <IconButton size="small" tabIndex={-1}>
            {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Chip size="small" label={`Veiculo B${block.block_id}`} color="primary" variant="outlined"
            sx={{ fontWeight: 700, fontFamily: 'monospace' }} />
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
            {minToHHMM(operationalStart)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
            {minToHHMM(operationalEnd)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2"
            color={exceedsVehicleLimit ? 'error.main' : penalizedIdleMinutes > 0 ? 'warning.dark' : 'text.primary'}
            fontWeight={exceedsVehicleLimit || penalizedIdleMinutes > 0 ? 700 : 400}>
            {minToDuration(dur)}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip size="small" label={block.num_trips} />
        </TableCell>
        <TableCell>
          {assignedDutyIds.length > 1 ? (
            <Chip size="small" label={`${assignedDutyIds.length} plantoes`} color="info" variant="outlined"
              sx={{ fontFamily: 'monospace' }} />
          ) : summaryDutyId != null ? (
            <Chip size="small" label={`Plantao ${getDutyDisplayLabel(summaryDutyId, summaryDuty)}`} color="success" variant="outlined"
              sx={{ fontFamily: 'monospace' }} />
          ) : (
            <Chip size="small" label="Sem tripulante" color="warning" variant="outlined" />
          )}
        </TableCell>
        <TableCell>
          {exceedsVehicleLimit ? (
              <Chip
                size="small"
                color="error"
                label={`Uso > ${minToDuration(vehicleLimits.maxVehicleShiftMin)}`}
                icon={<IconAlertTriangle size={12} />}
              />
          ) : penalizedIdleMinutes > 0 ? (
            <Chip size="small" color="warning" label={`Ociosidade ${minToDuration(penalizedIdleMinutes)}`} />
          ) : (
            <Chip size="small" color="success" label="Dentro do limite" variant="outlined" icon={<IconCheck size={12} />} />
          )}
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" fontWeight={700} color="text.primary">
            {fmtCurrency(block.total_cost)}
          </Typography>
          {(Number(block.idle_cost ?? 0) > 0 || penalizedIdleMinutes > 0) && (
            <Typography variant="caption" color="text.secondary">
              Ociosa {minToDuration(penalizedIdleMinutes)} · {fmtCurrency(block.idle_cost)}
            </Typography>
          )}
        </TableCell>
      </TableRow>

      {/* Linha expandida: tabela de viagens do bloco */}
      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, border: 'none', bgcolor: theme.palette.grey[50] }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1, px: 2 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.75} display="block">
                VIAGENS DO BLOCO B{block.block_id} ({sortedTrips.length} viagens | IDs sem detalhes: {block.trips.length - sortedTrips.length})
              </Typography>
              {sortedTrips.length === 0 ? (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    IDs das viagens: {block.trips.join(', ')}.{' '}
                    Detalhes nao carregados (a otimizacao foi executada antes de este painel
                    ser aberto, abra novamente apos executar).
                  </Typography>
                </Alert>
              ) : (
                <Table size="small" sx={{ mb: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, width: 60 }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Codigo</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Linha</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Sentido</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Saida</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Chegada</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Duracao</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Tripulante</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Intervalo antes prox.</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedTrips.map((trip, idx) => {
                      const nextTrip = sortedTrips[idx + 1];
                      const gap = nextTrip ? nextTrip.startTimeMinutes - trip.endTimeMinutes : null;
                      const penalizedGap = gap != null ? Math.max(0, gap - vehicleLimits.minLayoverMin) : null;
                      const lineName = lines.find((l) => l.id === trip.lineId)?.code ?? `L${trip.lineId}`;
                      const dutyId = tripToDuty.get(trip.id);
                      const tripDuty = dutyId != null ? dutiesMap.get(dutyId) : undefined;
                      return (
                        <TableRow key={trip.id} sx={{ bgcolor: 'white' }}>
                          <TableCell>
                            <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                              #{trip.id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                              {trip.tripCode ?? '--'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={lineName} variant="outlined" sx={{ fontSize: 11 }} />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" gap={0.5}>
                              {trip.direction === 'outbound'
                                ? <IconArrowRight size={14} color={theme.palette.primary.main} />
                                : <IconArrowLeft size={14} color={theme.palette.secondary.main} />}
                              <Typography variant="body2" fontSize={11}>
                                {trip.direction === 'outbound' ? 'Ida' : 'Volta'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={700}
                              color="primary.main">
                              {minToHHMM(trip.startTimeMinutes)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={700}
                              color="text.secondary">
                              {minToHHMM(trip.endTimeMinutes)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{minToDuration(trip.durationMinutes)}</Typography>
                          </TableCell>
                          <TableCell>
                            {dutyId != null ? (
                              <Chip
                                size="small"
                                label={getDutyDisplayLabel(dutyId, tripDuty)}
                                color="success"
                                variant="outlined"
                                sx={{ fontFamily: 'monospace', fontSize: 10 }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">-- sem cobertura</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {gap != null ? (
                              <Chip
                                size="small"
                                label={penalizedGap && penalizedGap > 0 ? `${minToDuration(gap)} · ociosa ${minToDuration(penalizedGap)}` : minToDuration(gap)}
                                color={gap < vehicleLimits.minLayoverMin ? 'error' : penalizedGap && penalizedGap > 0 ? 'warning' : 'success'}
                                variant="outlined"
                                sx={{ fontSize: 10 }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">-- ultima</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {blockCostDetails.length > 0 && (
                <>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                    CUSTOS DO BLOCO
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} mb={1}>
                    {blockCostDetails.map((item) => (
                      <Chip
                        key={`${block.block_id}-${item.label}`}
                        size="small"
                        variant="outlined"
                        label={`${item.label} ${fmtCurrency(item.value)}`}
                      />
                    ))}
                    <Chip size="small" color="primary" label={`Total ${fmtCurrency(block.total_cost)}`} />
                  </Stack>
                </>
              )}
              {(idleWindows.length > 0 || penalizedIdleMinutes > 0) && (
                <>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                    OCIOSIDADE ENTRE VIAGENS
                  </Typography>
                  {idleWindows.length > 0 ? (
                    <Stack gap={0.75} mb={1}>
                      {idleWindows.map((window) => (
                        <Paper
                          key={`${block.block_id}-${window.start}-${window.end}`}
                          variant="outlined"
                          sx={{
                            p: 1,
                            borderRadius: 1.5,
                            borderColor: window.penalizedGapMin > 0 ? 'warning.light' : 'divider',
                            bgcolor: window.penalizedGapMin > 0 ? alpha(theme.palette.warning.light, 0.14) : 'white',
                          }}
                        >
                          <Typography variant="caption" fontWeight={700} color="text.primary" display="block">
                            {minToHHMM(window.start)} -- {minToHHMM(window.end)} ({minToDuration(window.rawGapMin)})
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {window.penalizedGapMin > 0
                              ? `Calculo: ${minToDuration(window.rawGapMin)} - layover minimo ${minToDuration(vehicleLimits.minLayoverMin)} = ${minToDuration(window.penalizedGapMin)} de ociosidade cobrada.`
                              : `Dentro do layover minimo de ${minToDuration(vehicleLimits.minLayoverMin)}; sem custo de ociosidade.`}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : null}
                  <Alert severity={penalizedIdleMinutes > 0 ? 'warning' : 'info'} sx={{ py: 0.5, mt: 0.5, mb: 1 }}>
                    <Typography variant="caption">
                      {idleWindows.length > 0
                        ? `Ociosidade total bruta ${minToDuration(rawIdleMinutes)} · Ociosidade cobrada ${minToDuration(penalizedIdleMinutes)} · Custo ${fmtCurrency(block.idle_cost)}.`
                        : `Ociosidade cobrada ${minToDuration(penalizedIdleMinutes)} · Custo ${fmtCurrency(block.idle_cost)}. Carregue os detalhes das viagens para ver o horario e o calculo por intervalo.`}
                    </Typography>
                  </Alert>
                </>
              )}
              <Alert severity="info" icon={<IconBus size={14} />} sx={{ py: 0.5, mt: 0.5 }}>
                <Typography variant="caption">
                  {startBuffer > 0 || endBuffer > 0 ? (
                    <>
                      <strong>Garagem:</strong>{' '}
                      {startBuffer > 0
                        ? `soltura ${minToHHMM(serviceStart - startBuffer)} -- ${minToHHMM(serviceStart)} (${minToDuration(startBuffer)})`
                        : 'sem soltura dedicada'}
                      {' '}·{' '}
                      {endBuffer > 0
                        ? `recolhimento ${minToHHMM(serviceEnd)} -- ${minToHHMM(serviceEnd + endBuffer)} (${minToDuration(endBuffer)})`
                        : 'sem recolhimento dedicado'}.
                      {' '}Quando existir troca de plantao no mesmo veiculo, a coluna Tripulante mostra por viagem quem assumiu cada trecho.
                    </>
                  ) : (
                    <>
                      Este bloco nao tem buffers de soltura/recolhimento configurados.
                      {' '}Se houver troca de plantao no mesmo veiculo, a coluna Tripulante mostra por viagem quem assumiu cada trecho.
                    </>
                  )}
                </Typography>
              </Alert>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ── Componente: linha colapsavel de plantao (Tab Por Tripulante) ─────────────
function DutyRow({
  duty, blocksMap, tripMap, lines, limits,
}: {
  duty: DutyResult;
  blocksMap: Map<number, BlockResult>;
  tripMap: Map<number, TripDetail>;
  lines: Line[];
  limits: CctVisualLimits;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const overHard = isDutyHardViolation(duty, limits);
  const overSoft = !overHard && isDutySoftViolation(duty, limits);
  const cctColor: 'error' | 'warning' | 'success' = overHard ? 'error' : overSoft ? 'warning' : 'success';

  const myBlocks = duty.blocks.map((bid) => blocksMap.get(bid)).filter(Boolean) as BlockResult[];
  const allTripIds = duty.trip_ids ?? myBlocks.flatMap((b) => b.trips ?? []);
  const allTrips = allTripIds.map((tid) => tripMap.get(tid)).filter(Boolean) as TripDetail[];
  const sortedTrips = [...allTrips].sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);
  const taskWindows = getDutyTaskWindows(duty, myBlocks);
  const { rawStart, rawEnd, startBuffer, endBuffer, dutyStart, dutyEnd } = getDutyOperationalBounds(duty, sortedTrips, myBlocks);
  const startsAt = dutyStart;
  const endsAt = dutyEnd;
  const rosterId = getDutyRosterId(duty);
  const waitingMinutes = getDutyMetaNumber(duty, 'waiting_minutes') ?? 0;
  const unpaidBreakTotal = getDutyMetaNumber(duty, 'unpaid_break_total_minutes') ?? Math.max(0, duty.spread_time - duty.work_time);

  // Indicador de horas trabalhadas
  const overtimeMin = getDutyOvertimeMinutes(duty, limits);
  const spreadExtraMin = getDutySpreadExcessMinutes(duty, limits);
  const dutyCostDetails = [
    { label: 'Trabalho', value: duty.work_cost },
    { label: 'Complemento', value: duty.guaranteed_cost },
    { label: 'Espera', value: duty.waiting_cost },
    { label: 'Hora extra', value: duty.overtime_cost },
    { label: 'Penalidade intervalo', value: duty.long_unpaid_break_penalty },
    { label: 'Adicional noturno', value: duty.nocturnal_extra_cost },
    { label: 'Adicional feriado', value: duty.holiday_extra_cost },
    { label: 'Penalidades CCT', value: duty.cct_penalties_cost },
  ].filter((item) => item.value != null && Number(item.value) !== 0);

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: 'pointer',
          bgcolor: overHard ? 'error.lighter' : overSoft ? 'warning.lighter' : undefined,
        }}
      >
        <TableCell sx={{ width: 36, pr: 0 }}>
          <IconButton size="small" tabIndex={-1}>
            {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Chip size="small" label={`Tripulante ${getDutyDisplayLabel(duty.duty_id, duty)}`} color={cctColor} variant="filled"
            sx={{ fontWeight: 700, fontFamily: 'monospace' }} />
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
              {minToHHMM(startsAt)} -- {minToHHMM(endsAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Spread: {minToDuration(duty.spread_time)}
              {rawStart != null && rawEnd != null && (startBuffer > 0 || endBuffer > 0)
                ? ` | Servico: ${minToHHMM(rawStart)} -- ${minToHHMM(rawEnd)}`
                : ''}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2" fontFamily="monospace">
              {minToDuration(duty.work_time)}
            </Typography>
            {overtimeMin > 0 && (
              <Typography variant="caption" color={overHard ? 'error.main' : 'warning.main'} fontWeight={700}>
                +{minToDuration(overtimeMin)} extra
              </Typography>
            )}
            {overtimeMin === 0 && spreadExtraMin > 0 && (
              <Typography variant="caption" color="warning.main" fontWeight={700}>
                Spread +{minToDuration(spreadExtraMin)}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Chip size="small" label={
            overHard ? `VIOLACAO CCT (${minToDuration(duty.spread_time)})` :
            overSoft ? (overtimeMin > 0 ? `Hora extra (${minToDuration(overtimeMin)})` : `Jornada estendida (${minToDuration(spreadExtraMin)})`) : 'Dentro do limite'
          } color={cctColor} sx={{ fontWeight: 700 }} />
        </TableCell>
        <TableCell align="center">
          <Chip size="small" label={duty.blocks.length} />
        </TableCell>
        <TableCell align="center">
          <Chip size="small" label={allTripIds.length} />
        </TableCell>
        <TableCell>
          {duty.rest_violations > 0 ? (
            <Chip size="small" color="error" label={`${duty.rest_violations} viol.`} />
          ) : (
            <Chip size="small" color="success" label="OK" variant="outlined" icon={<IconCheck size={12} />} />
          )}
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" fontWeight={700} color="text.primary">
            {fmtCurrency(duty.total_cost)}
          </Typography>
          {(Number(duty.waiting_cost ?? 0) > 0 || Number(duty.overtime_cost ?? 0) > 0) && (
            <Typography variant="caption" color="text.secondary">
              Espera {fmtCurrency(duty.waiting_cost)} · HE {fmtCurrency(duty.overtime_cost)}
            </Typography>
          )}
        </TableCell>
      </TableRow>

      {/* Linha expandida: blocos e viagens */}
      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, border: 'none', bgcolor: theme.palette.grey[50] }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1, px: 2 }}>
              {/* Blocos do plantao */}
              <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                BLOCOS COBERTOS PELO PLANTAO P{duty.duty_id}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                {myBlocks.map((b) => {
                  const gap = duty.blocks.indexOf(b.block_id) > 0
                    ? b.start_time - (blocksMap.get(duty.blocks[duty.blocks.indexOf(b.block_id) - 1])?.end_time ?? 0)
                    : null;
                  return (
                    <Box key={b.block_id}
                      sx={{ p: 0.75, border: '1px solid', borderColor: 'primary.light', borderRadius: 1, bgcolor: 'white', minWidth: 150 }}>
                      <Typography variant="caption" fontWeight={700} color="primary.main">
                        Bloco B{b.block_id}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {minToHHMM(b.start_time)} -- {minToHHMM(b.end_time)} ({b.num_trips} viagens)
                      </Typography>
                      {gap != null && (
                        <Chip size="small" label={`Folga: ${minToDuration(gap)}`}
                          color={gap < limits.minBreakMin ? 'error' : 'default'}
                          variant="outlined" sx={{ fontSize: 10, mt: 0.25 }} />
                      )}
                    </Box>
                  );
                })}
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                JORNADA VISUAL E DESCANSOS
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} mb={1.25}>
                {rosterId != null && (
                  <Chip size="small" color="secondary" variant="outlined" label={`Escala R${rosterId}`} />
                )}
                <Chip size="small" color="info" variant="outlined" label={`Espera total ${minToDuration(waitingMinutes)}`} />
                <Chip size="small" color="default" variant="outlined" label={`Ociosidade total ${minToDuration(unpaidBreakTotal)}`} />
                {overtimeMin > 0 && (
                  <Chip size="small" color={overHard ? 'error' : 'warning'} variant="outlined" label={`Hora extra ${minToDuration(overtimeMin)}`} />
                )}
                {overtimeMin === 0 && spreadExtraMin > 0 && (
                  <Chip size="small" color="warning" variant="outlined" label={`Jornada estendida ${minToDuration(spreadExtraMin)}`} />
                )}
              </Stack>
              {dutyCostDetails.length > 0 && (
                <>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                    CUSTOS DO PLANTAO
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} mb={1.25}>
                    {dutyCostDetails.map((item) => (
                      <Chip
                        key={`${duty.duty_id}-${item.label}`}
                        size="small"
                        variant="outlined"
                        label={`${item.label} ${fmtCurrency(item.value)}`}
                      />
                    ))}
                    <Chip size="small" color="primary" label={`Total ${fmtCurrency(duty.total_cost)}`} />
                  </Stack>
                </>
              )}
              <Stack direction="row" flexWrap="wrap" gap={0.75} mb={1.5}>
                {startBuffer > 0 && rawStart != null && dutyStart != null && (
                  <Chip
                    size="small"
                    color="info"
                    variant="outlined"
                    icon={<IconBus size={12} />}
                    label={`Garagem ${minToHHMM(dutyStart)} -- ${minToHHMM(rawStart)} (${minToDuration(startBuffer)})`}
                  />
                )}
                {taskWindows.map((window, idx) => {
                  const nextWindow = taskWindows[idx + 1];
                  const gap = nextWindow ? Math.max(0, nextWindow.start - window.end) : null;
                  return (
                    <React.Fragment key={`${window.blockId}-${window.start}-${window.end}`}>
                      <Chip
                        size="small"
                        color="primary"
                        label={`Trabalho B${window.blockId} ${minToHHMM(window.start)} -- ${minToHHMM(window.end)} (${minToDuration(window.end - window.start)})`}
                      />
                      {gap != null && gap > 0 && (
                        <Chip
                          size="small"
                          color={getGapChipColor(gap, limits)}
                          variant="outlined"
                          label={`Descanso ${minToHHMM(window.end)} -- ${minToHHMM(nextWindow!.start)} (${minToDuration(gap)})`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
                {endBuffer > 0 && rawEnd != null && dutyEnd != null && (
                  <Chip
                    size="small"
                    color="info"
                    variant="outlined"
                    icon={<IconBus size={12} />}
                    label={`Garagem ${minToHHMM(rawEnd)} -- ${minToHHMM(dutyEnd)} (${minToDuration(endBuffer)})`}
                  />
                )}
              </Stack>

              {/* Todas as viagens do plantao, linha a linha */}
              <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                TODAS AS VIAGENS ({sortedTrips.length}) -- em ordem cronologica
              </Typography>
              {sortedTrips.length === 0 ? (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  <Typography variant="caption">Detalhes de viagem nao disponíveis. IDs: {allTripIds.join(', ')}</Typography>
                </Alert>
              ) : (
                <Table size="small" sx={{ mb: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Codigo</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Linha</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Sentido</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Saida</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Chegada</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Duracao</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Bloco</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Intervalo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedTrips.map((trip, idx) => {
                      const nextTrip = sortedTrips[idx + 1];
                      const gap = nextTrip ? nextTrip.startTimeMinutes - trip.endTimeMinutes : null;
                      const lineName = lines.find((l) => l.id === trip.lineId)?.code ?? `L${trip.lineId}`;
                      const blockId = myBlocks.find((b) => (b.trips ?? []).includes(trip.id))?.block_id;
                      return (
                        <TableRow key={trip.id} sx={{ bgcolor: 'white' }}>
                          <TableCell>
                            <Typography variant="caption" fontFamily="monospace" color="text.secondary">#{trip.id}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                              {trip.tripCode ?? '--'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={lineName} variant="outlined" sx={{ fontSize: 11 }} />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" gap={0.5}>
                              {trip.direction === 'outbound'
                                ? <IconArrowRight size={14} color={theme.palette.primary.main} />
                                : <IconArrowLeft size={14} color={theme.palette.secondary.main} />}
                              <Typography variant="body2" fontSize={11}>
                                {trip.direction === 'outbound' ? 'Ida' : 'Volta'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="primary.main">
                              {minToHHMM(trip.startTimeMinutes)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="text.secondary">
                              {minToHHMM(trip.endTimeMinutes)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{minToDuration(trip.durationMinutes)}</Typography>
                          </TableCell>
                          <TableCell>
                            {blockId != null
                              ? <Chip size="small" label={`B${blockId}`} color="primary" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                              : '--'
                            }
                          </TableCell>
                          <TableCell>
                            {gap != null ? (
                              <Chip size="small" label={minToDuration(gap)}
                                color={gap < limits.minBreakMin ? 'error' : gap < 60 ? 'warning' : 'success'}
                                variant="outlined" sx={{ fontSize: 10 }} />
                            ) : (
                              <Typography variant="caption" color="text.secondary">-- ultima</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <Alert severity="info" icon={<IconBus size={14} />} sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  <strong>Nota CCT:</strong> o spread mostrado inclui a soltura quando o plantao assume a primeira viagem do veiculo
                  e inclui o recolhimento quando ele encerra na ultima viagem do mesmo veiculo.
                  Troca de tripulante continua restrita a fronteiras validas entre viagens, nao dentro da viagem.
                </Typography>
              </Alert>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ── DetailedResultDialog ─────────────────────────────────────────────────────
function DetailedResultDialog({
  run, lines, fetchedTrips, availableRuns, audit, loadingAudit, open, onClose,
}: {
  run: OptimizationRun | null;
  lines: Line[];
  fetchedTrips: TripDetail[];
  availableRuns: OptimizationRun[];
  audit: OptimizationRunAudit | null;
  loadingAudit: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  if (!run) return null;

  const res = run.resultSummary as unknown as OptResult | undefined;
  const visualLimits = getCctVisualLimits(res, run, audit);
  const vehicleLimits = getVspVisualLimits(res, run, audit);
  const failureDiagnostics = (audit?.result?.failureDiagnostics ?? (run.resultSummary as any)?.diagnostics ?? null) as OptimizationFailureDiagnostics | null;
  const optimizerDiagnostics = (audit?.result?.optimizerDiagnostics ?? (run.resultSummary as any)?.optimizerDiagnostics ?? null) as Record<string, any> | null;
  const failureSettings = failureDiagnostics?.currentSettings as Record<string, any> | undefined;
  const algLabel = ALGORITHMS.find((a) => a.value === run.algorithm)?.label ?? run.algorithm;
  const metaEntries = Object.entries(res?.meta ?? {}).filter(([, value]) => {
    if (value == null) return false;
    if (typeof value === 'object') return false;
    return true;
  });
  const lineNames = (() => {
    const ids: number[] = (run as any).lineIds ?? (run.lineId ? [run.lineId] : []);
    return ids.map((id) => lines.find((l) => l.id === id)?.code ?? `#${id}`).join(', ');
  })();

  if (run.status === 'failed') {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.background.default, 0.92)} 100%)`,
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.16)',
          },
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconAlertTriangle color={theme.palette.error.main} />
            <Typography fontWeight={700}>Execucao #{run.id} -- Falhou</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {loadingAudit ? <LinearProgress sx={{ mt: 1 }} /> : null}
          <Alert severity="error" sx={{ mt: 1 }}>
            <AlertTitle>Erro na otimizacao</AlertTitle>
            <Box sx={{ whiteSpace: 'pre-line' }}>
              {failureDiagnostics?.summary ?? run.errorMessage ?? 'Erro desconhecido no processamento.'}
            </Box>
          </Alert>
          {failureDiagnostics?.hints?.length ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              <AlertTitle>Como corrigir</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {failureDiagnostics.hints.map((hint) => (
                  <Box component="li" key={hint} sx={{ mb: 0.5 }}>
                    <Typography variant="body2">{hint}</Typography>
                  </Box>
                ))}
              </Box>
            </Alert>
          ) : null}
          {failureSettings ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <AlertTitle>Configuração usada nesta tentativa</AlertTitle>
              <Typography variant="body2">
                Algoritmo: {String(failureSettings.algorithm ?? '--')} ·
                Linhas: {Array.isArray(failureSettings.lineIds) ? failureSettings.lineIds.join(', ') : '--'} ·
                Refeição: {failureSettings.mealBreakMinutes ?? '--'} min ·
                Relief: {failureSettings.allowReliefPoints ? 'ligado' : 'desligado'} ·
                Pairing: {failureSettings.preservePreferredPairs ? 'ligado' : 'desligado'}
              </Typography>
            </Alert>
          ) : null}
          {optimizerDiagnostics ? (
            <Box sx={{ mt: 2 }}>
              <JsonPreview title="Diagnostico do otimizador" value={optimizerDiagnostics} />
            </Box>
          ) : null}
          <Box sx={{ mt: 2 }}>
            <RunAuditComparePanel
              run={run}
              audit={audit}
              auditLoading={loadingAudit}
              availableRuns={availableRuns}
            />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Fechar</Button></DialogActions>
      </Dialog>
    );
  }

  if (!res) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Execucao #{run.id}</DialogTitle>
        <DialogContent>
          <Alert severity="info">Resultado detalhado nao disponivel.</Alert>
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Fechar</Button></DialogActions>
      </Dialog>
    );
  }

  const blocks: BlockResult[] = Array.isArray(res.blocks) ? res.blocks : [];
  const duties: DutyResult[]  = Array.isArray(res.duties) ? res.duties : [];

  // Mapas de cross-reference
  const blocksMap  = new Map<number, BlockResult>(blocks.map((b) => [b.block_id, b]));
  const dutiesMap  = new Map<number, DutyResult>(duties.map((d) => [d.duty_id, d]));
  const tripMap    = new Map<number, TripDetail>(fetchedTrips.map((t) => [t.id, t]));

  // Qual duty cobre cada trip (via `trip_ids` reais do duty; fallback via bloco para compatibilidade)
  const tripToDuty = new Map<number, number>();
  duties.forEach((d) => {
    const tripIds = d.trip_ids ?? [];
    if (tripIds.length > 0) tripIds.forEach((tid) => tripToDuty.set(tid, d.duty_id));
  });
  if (tripToDuty.size === 0) {
    const blockToDuty = new Map<number, number>();
    duties.forEach((d) => d.blocks.forEach((bid) => blockToDuty.set(bid, d.duty_id)));
    blocks.forEach((b) => {
      const dId = blockToDuty.get(b.block_id);
      if (dId != null) (b.trips ?? []).forEach((tid) => tripToDuty.set(tid, dId));
    });
  }
  const tripToBlock = new Map<number, number>();
  blocks.forEach((b) => (b.trips ?? []).forEach((tid) => tripToBlock.set(tid, b.block_id)));
  const blockToDuty = new Map<number, number>();
  blocks.forEach((b) => {
    const counter = new Map<number, number>();
    (b.trips ?? []).forEach((tid) => {
      const dutyId = tripToDuty.get(tid);
      if (dutyId != null) counter.set(dutyId, (counter.get(dutyId) ?? 0) + 1);
    });
    const dominant = Array.from(counter.entries()).sort((a, b2) => b2[1] - a[1])[0]?.[0];
    if (dominant != null) blockToDuty.set(b.block_id, dominant);
  });

  // Violations
  const dutyViolationsSpread = duties.filter((d) => isDutyHardViolation(d, visualLimits));
  const dutyViolationsSoft   = duties.filter((d) => !isDutyHardViolation(d, visualLimits) && isDutySoftViolation(d, visualLimits));
  const dutyViolationsRest   = duties.filter((d) => d.rest_violations > 0);
  const assignedBlockIds     = new Set(duties.flatMap((d) => d.blocks));
  const orphanBlocks         = blocks.filter((b) => !assignedBlockIds.has(b.block_id));
  const totalBlockCost = blocks.reduce((sum, block) => sum + Number(block.total_cost ?? 0), 0);
  const totalBlockIdleCost = blocks.reduce((sum, block) => sum + Number(block.idle_cost ?? 0), 0);
  const totalDutyCost = duties.reduce((sum, duty) => sum + Number(duty.total_cost ?? 0), 0);
  const totalDutyGuaranteedCost = duties.reduce((sum, duty) => sum + Number(duty.guaranteed_cost ?? 0), 0);
  const totalDutyWaitingCost = duties.reduce((sum, duty) => sum + Number(duty.waiting_cost ?? 0), 0);
  const totalDutyOvertimeCost = duties.reduce((sum, duty) => sum + Number(duty.overtime_cost ?? 0), 0);
  const totalDutyOvertimeMinutes = duties.reduce((sum, duty) => sum + getDutyOvertimeMinutes(duty, visualLimits), 0);

  // Todas as trips conhecidas (com detalhes)
  const allKnownTripIds = new Set(blocks.flatMap((b) => b.trips ?? []));
  const allTripsInResult = Array.from(allKnownTripIds)
    .map((tid) => ({
      trip: tripMap.get(tid),
      blockId: tripToBlock.get(tid),
      dutyId: tripToDuty.get(tid),
    }));
  const sortedAllTrips = allTripsInResult
    .filter((x) => x.trip)
    .sort((a, b) =>
      sortDir === 'asc'
        ? (a.trip!.startTimeMinutes - b.trip!.startTimeMinutes)
        : (b.trip!.startTimeMinutes - a.trip!.startTimeMinutes)
    );
  const unknownTripCount = allTripsInResult.filter((x) => !x.trip).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{
        sx: {
          height: '94vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.background.default, 0.92)} 100%)`,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.16)',
        },
      }}>
      <DialogTitle sx={{ pb: 0, pt: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Resultado Detalhado -- Execucao #{run.id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {algLabel} | Linhas: {lineNames} | {fmtDate(run.createdAt)}
            </Typography>
          </Box>
          <StatusBadge status={run.status} />
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ flex: 1, overflow: 'auto', pt: 2, borderColor: 'rgba(148, 163, 184, 0.14)' }}>

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <Grid container spacing={2} mb={2}>
          {[
            { label: 'Veiculos (Blocos VSP)', value: res.vehicles, sub: `${blocks.length} blocos`, color: theme.palette.primary.main, icon: <IconBus size={18} /> },
            { label: 'Tripulantes (Plantoes CSP)', value: res.crew, sub: `${duties.length} plantoes`, color: theme.palette.success.main, icon: <IconUsers size={18} /> },
            { label: 'Viagens Otimizadas', value: allKnownTripIds.size, sub: `${fetchedTrips.length} carregadas`, color: theme.palette.info.main, icon: <IconRoute size={18} /> },
            { label: 'Custo Total', value: res.total_cost != null ? `R$ ${Number(res.total_cost).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '--', sub: `VSP ${fmtCurrency(totalBlockCost)} | CSP ${fmtCurrency(totalDutyCost)}`, color: theme.palette.warning.main, icon: <IconCurrencyDollar size={18} /> },
            { label: 'Tempo Processamento', value: res.elapsed_ms != null ? `${Math.round(res.elapsed_ms)}ms` : '--', sub: `VSP: ${res.vsp_algorithm} | CSP: ${res.csp_algorithm}`, color: theme.palette.grey[600], icon: <IconClock size={18} /> },
            { label: 'Violacoes CCT', value: dutyViolationsSpread.length + dutyViolationsSoft.length, sub: `${dutyViolationsSpread.length} graves, ${minToDuration(totalDutyOvertimeMinutes)} em hora extra`, color: (dutyViolationsSpread.length > 0 ? theme.palette.error.main : dutyViolationsSoft.length > 0 ? theme.palette.warning.main : theme.palette.success.main), icon: <IconAlertTriangle size={18} /> },
          ].map(({ label, value, sub, color, icon }) => (
            <Grid item xs={6} sm={4} md={2} key={label}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" gap={0.5} mb={0.5} sx={{ color }}>
                    {icon}
                    <Typography variant="caption" color="text.secondary" lineHeight={1.2}>{label}</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700} sx={{ color }}>{value}</Typography>
                  <Typography variant="caption" color="text.secondary">{sub}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* ── Explicacao vehicles vs crew ────────────────────────────────── */}
        <Alert
          severity={res.vehicles > res.crew ? 'info' : res.vehicles === res.crew ? 'success' : 'warning'}
          icon={<IconInfoCircle size={18} />} sx={{ mb: 2, borderRadius: 2 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>
            {res.vehicles > res.crew
              ? `Por que ${res.vehicles} veiculos mas apenas ${res.crew} tripulantes?`
              : res.vehicles === res.crew
              ? 'Relacao 1:1: cada tripulante cobre exatamente 1 veiculo'
              : `${res.crew} tripulantes para ${res.vehicles} veiculos`}
          </AlertTitle>
          <Typography variant="body2">
            {res.vehicles > res.crew
              ? `Isso e ESPERADO e correto: o CSP (Crew Scheduling) agrupa multiplos blocos de veiculo
                 num unico plantao de tripulante, desde que os intervalos de descanso CCT sejam respeitados.
                 Ex: um motorista pode fazer o bloco B1 das 05h-09h e o bloco B3 das 14h-17h (jornada espalhada = 12h).
                 Verifique a aba "Por Tripulante" para ver os spreads e alertas CCT.`
              : `Cada tripulante esta cobrindo exatamente um veiculo/bloco neste cenario.`}
          </Typography>
        </Alert>

        {(metaEntries.length > 0 || (res.warnings?.length ?? 0) > 0) && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Metadados avançados</Typography>
            {metaEntries.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={1} mb={res.warnings?.length ? 1.25 : 0}>
                {metaEntries.map(([key, value]) => (
                  <Chip key={key} label={`${key}: ${String(value)}`} size="small" variant="outlined" />
                ))}
              </Stack>
            )}
            {(res.warnings?.length ?? 0) > 0 && (
              <Stack spacing={1}>
                {res.warnings?.map((warning) => (
                  <Alert key={warning} severity="warning" sx={{ py: 0.25 }}>{warning}</Alert>
                ))}
              </Stack>
            )}
          </Paper>
        )}

        {/* ── Warnings ──────────────────────────────────────────────────── */}
        {(dutyViolationsSpread.length > 0 || dutyViolationsSoft.length > 0 || dutyViolationsRest.length > 0 || res.unassigned_trips > 0 || res.uncovered_blocks > 0 || orphanBlocks.length > 0) && (
          <Box mb={2}>
            <Typography variant="subtitle2" fontWeight={700} mb={1} color="warning.dark">
              Avisos e Violacoes
            </Typography>
            <Stack spacing={1}>
              {dutyViolationsSpread.map((d) => (
                <Alert key={d.duty_id} severity="error" icon={<IconAlertTriangle size={16} />}>
                  <AlertTitle sx={{ fontWeight: 700 }}>
                    Plantao P{d.duty_id}: JORNADA EXCEDE LIMITE MAXIMO CCT ({minToDuration(d.spread_time)} {'>'} {minToDuration(visualLimits.hardLimitMin)})
                  </AlertTitle>
                  Spread: {minToDuration(d.spread_time)} | Trabalho efetivo: {minToDuration(d.work_time)} |
                  Hora extra: {minToDuration(getDutyOvertimeMinutes(d, visualLimits))} | Excesso: {minToDuration(d.spread_time - visualLimits.hardLimitMin)}.
                  Blocos cobertos: {d.blocks.map((bid) => `B${bid}`).join(', ')}.
                  Nota: soltura e recolhimento entram quando o plantao realmente abre ou fecha na garagem.
                </Alert>
              ))}
              {dutyViolationsSoft.map((d) => (
                <Alert key={d.duty_id} severity="warning" icon={<IconAlertTriangle size={16} />}>
                  <AlertTitle sx={{ fontWeight: 700 }}>
                    Plantao P{d.duty_id}: {getDutyOvertimeMinutes(d, visualLimits) > 0
                      ? `em hora extra (${minToDuration(getDutyOvertimeMinutes(d, visualLimits))} acima da jornada regular)`
                      : `com jornada estendida (${minToDuration(getDutySpreadExcessMinutes(d, visualLimits))} acima do spread regular)`}
                  </AlertTitle>
                  Spread: {minToDuration(d.spread_time)} | Trabalho efetivo: {minToDuration(d.work_time)}.
                  Blocos: {d.blocks.map((bid) => `B${bid}`).join(', ')}
                </Alert>
              ))}
              {dutyViolationsRest.length > 0 && (
                <Alert severity="warning">
                  <AlertTitle sx={{ fontWeight: 700 }}>
                    {dutyViolationsRest.length} plantao(oes) com intervalo de descanso insuficiente (&lt; 30min entre blocos)
                  </AlertTitle>
                  Plantoes: {dutyViolationsRest.map((d) => `P${d.duty_id}`).join(', ')}
                </Alert>
              )}
              {res.unassigned_trips > 0 && (
                <Alert severity="error">
                  <AlertTitle sx={{ fontWeight: 700 }}>
                    {res.unassigned_trips} viagem(ns) nao atribuidas pelo VSP
                  </AlertTitle>
                  O algoritmo nao conseguiu cobrir todas as viagens. Possivel causa: frota insuficiente
                  ou conflito de deadhead times. Aumente o numero maximo de veiculos.
                </Alert>
              )}
              {res.uncovered_blocks > 0 && (
                <Alert severity="warning">
                  {res.uncovered_blocks} bloco(s) do VSP sem tripulante atribuido pelo CSP.
                  Verifique os blocos: {orphanBlocks.map((b) => `B${b.block_id}`).join(', ')}
                </Alert>
              )}
            </Stack>
          </Box>
        )}

        {/* ── Regras CCT ────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
          <Typography variant="caption" fontWeight={700} display="block" mb={0.75} color="text.secondary">
            REGRAS CCT APLICADAS NESTA OTIMIZACAO
          </Typography>
          <Grid container spacing={1}>
            {[
              { label: 'Jornada maxima', value: `${visualLimits.maxShiftMin}min`, warn: false },
              { label: 'Jornada regular/base HE', value: `${visualLimits.maxWorkMin}min`, warn: false },
              { label: 'Hora extra maxima', value: `${visualLimits.maxOvertimeMin}min`, warn: false },
              { label: 'Teto hard da jornada', value: `${visualLimits.hardLimitMin}min`, warn: true },
              { label: 'Direcao continua maxima', value: `${visualLimits.maxDrivingMin}min`, warn: true },
              { label: 'Intervalo minimo entre blocos', value: `${visualLimits.minBreakMin}min`, warn: false },
              { label: 'Soltura/Recolhimento', value: 'Todos os veiculos; no plantao so nas bordas do veiculo', warn: false },
            ].map(({ label, value, warn }) => (
              <Grid item xs={6} sm={4} md={2} key={label}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                <Typography variant="caption" fontWeight={700} color={warn ? 'warning.dark' : 'text.primary'}>
                  {value}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(148, 163, 184, 0.14)', mb: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: 999,
                bgcolor: 'secondary.main',
              },
              '& .MuiTab-root': {
                minHeight: 48,
                textTransform: 'none',
                color: 'text.secondary',
              },
              '& .Mui-selected': {
                color: 'text.primary',
              },
            }}
          >
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconBus size={14} /><span>Por Veiculo ({blocks.length} blocos)</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconUsers size={14} /><span>Por Tripulante ({duties.length} plantoes)</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconRoute size={14} /><span>Todas as Viagens ({allKnownTripIds.size})</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconChartBar size={14} /><span>Resumo Jornadas</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconRobot size={14} /><span>Explicabilidade</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconSettings size={14} /><span>Auditoria / Compare</span></Stack>} />
          </Tabs>
        </Box>

        {/* ── Tab 0: Por Veiculo ────────────────────────────────────────── */}
        {tab === 0 && (
          <Box>
            <Alert severity="info" icon={<IconBus size={16} />} sx={{ mb: 1.5, py: 0.5 }}>
              <Typography variant="body2">
                Cada linha e um <strong>veiculo/onibus</strong> (bloco VSP). Clique para expandir
                e ver <strong>todas as viagens</strong> que esse onibus realizara no dia, em ordem cronologica.
                A coluna &ldquo;Tripulante&rdquo; resume a cobertura do bloco e, na expansao, voce ve por viagem
                qual plantao assumiu cada trecho do mesmo veiculo. A secao de ociosidade mostra cada intervalo
                entre viagens e calcula apenas o excedente acima do layover minimo do veiculo.
              </Typography>
            </Alert>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ width: 36 }} />
                    <TableCell sx={{ fontWeight: 700 }}>Veiculo</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Inicio Operacao</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fim Operacao</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Duracao Bloco</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Qtd Viagens</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tripulante</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status do Bloco</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Custo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {blocks.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Alert severity="info">Nenhum bloco VSP no resultado.</Alert>
                    </TableCell></TableRow>
                  ) : (
                    [...blocks]
                      .sort((a, b) => a.start_time - b.start_time)
                      .map((b) => (
                        <BlockRow
                          key={b.block_id}
                          block={b}
                          duty={dutiesMap.get(blockToDuty.get(b.block_id)!)}
                          tripMap={tripMap}
                          tripToDuty={tripToDuty}
                          dutiesMap={dutiesMap}
                          lines={lines}
                          vehicleLimits={vehicleLimits}
                        />
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* ── Tab 1: Por Tripulante ─────────────────────────────────────── */}
        {tab === 1 && (
          <Box>
            <Alert severity="info" icon={<IconUsers size={16} />} sx={{ mb: 1.5, py: 0.5 }}>
              <Typography variant="body2">
                Cada linha e um <strong>plantao de tripulante</strong> (motorista/cobrador).
                Clique para ver os blocos atribuidos e <strong>todas as viagens em ordem cronologica</strong>,
                com intervalos entre blocos e alertas CCT. A cor indica o status da jornada.
              </Typography>
            </Alert>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ width: 36 }} />
                    <TableCell sx={{ fontWeight: 700 }}>Tripulante</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Horario (Inicio -- Fim)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Trabalho Efetivo</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status CCT</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Blocos</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Viagens</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Viol. Descanso</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Custo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {duties.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Alert severity="info">Nenhum plantao CSP no resultado.</Alert>
                    </TableCell></TableRow>
                  ) : (
                    [...duties]
                      .sort((a, b) => {
                        const aStart = Math.min(...(blocksMap.get(a.blocks[0])
                          ? [blocksMap.get(a.blocks[0])!.start_time] : [9999]));
                        const bStart = Math.min(...(blocksMap.get(b.blocks[0])
                          ? [blocksMap.get(b.blocks[0])!.start_time] : [9999]));
                        return aStart - bStart;
                      })
                      .map((d) => (
                        <DutyRow
                          key={d.duty_id}
                          duty={d}
                          blocksMap={blocksMap}
                          tripMap={tripMap}
                          lines={lines}
                          limits={visualLimits}
                        />
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* ── Tab 2: Todas as Viagens ───────────────────────────────────── */}
        {tab === 2 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Alert severity="info" icon={<IconRoute size={16} />} sx={{ py: 0.5, flex: 1, mr: 2 }}>
                <Typography variant="body2">
                  Listagem de <strong>todas as viagens otimizadas</strong>, mostrando o veiculo (bloco)
                  e o tripulante (plantao) atribuido a cada uma. Ordenadas por horario de saida.
                  {unknownTripCount > 0 && ` (${unknownTripCount} IDs sem detalhes carregados)`}
                </Typography>
              </Alert>
              <Button
                size="small" variant="outlined"
                onClick={() => setSortDir((s) => s === 'asc' ? 'desc' : 'asc')}
              >
                Ordem: {sortDir === 'asc' ? 'Mais Cedo' : 'Mais Tarde'}
              </Button>
            </Stack>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Codigo</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Linha</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Sentido</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Saida</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Chegada</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Duracao</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Veiculo (Bloco)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tripulante (Plantao)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedAllTrips.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma viagem com detalhes. As viagens sao carregadas ao abrir este dialogo.
                        Feche e abra novamente para carregar os detalhes.
                      </Typography>
                    </TableCell></TableRow>
                  ) : sortedAllTrips.map(({ trip, blockId, dutyId }) => {
                    const lineName = lines.find((l) => l.id === trip!.lineId)?.code ?? `L${trip!.lineId}`;
                    return (
                      <TableRow key={trip!.id} hover>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                            #{trip!.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontWeight={700}>
                            {trip!.tripCode ?? '--'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={lineName} variant="outlined" sx={{ fontSize: 11 }} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" gap={0.5}>
                            {trip!.direction === 'outbound'
                              ? <IconArrowRight size={14} color={theme.palette.primary.main} />
                              : <IconArrowLeft size={14} color={theme.palette.secondary.main} />}
                            <Typography variant="body2" fontSize={11}>
                              {trip!.direction === 'outbound' ? 'Ida' : 'Volta'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="primary.main">
                            {minToHHMM(trip!.startTimeMinutes)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                            {minToHHMM(trip!.endTimeMinutes)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{minToDuration(trip!.durationMinutes)}</Typography>
                        </TableCell>
                        <TableCell>
                          {blockId != null ? (
                            <Chip size="small" label={`Veiculo B${blockId}`} color="primary" variant="outlined"
                              sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
                          ) : (
                            <Chip size="small" label="Nao alocado" color="error" />
                          )}
                        </TableCell>
                        <TableCell>
                          {dutyId != null ? (
                            <Chip size="small" label={`Tripulante P${dutyId}`} color="success" variant="outlined"
                              sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
                          ) : (
                            <Chip size="small" label="Sem tripulante" color="warning" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* ── Tab 3: Resumo Jornadas ────────────────────────────────────── */}
        {tab === 3 && (
          <Box>
            {/* Distribuicao de jornadas */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              Distribuicao de Jornadas dos Tripulantes
            </Typography>
            <Grid container spacing={2} mb={2}>
              {[
                { label: 'Dentro do limite', count: duties.filter((d) => !isDutyHardViolation(d, visualLimits) && !isDutySoftViolation(d, visualLimits)).length, color: theme.palette.success.main },
                { label: 'Em hora extra', count: dutyViolationsSoft.length, color: theme.palette.warning.main },
                { label: 'Violacao grave', count: dutyViolationsSpread.length, color: theme.palette.error.main },
                { label: 'Com viol. de descanso', count: duties.filter((d) => d.rest_violations > 0).length, color: theme.palette.error.main },
                { label: 'Media do spread', count: duties.length > 0 ? minToDuration(Math.round(duties.reduce((s, d) => s + d.spread_time, 0) / duties.length)) : '--', color: theme.palette.text.primary, isText: true },
                { label: 'Media trabalho efetivo', count: duties.length > 0 ? minToDuration(Math.round(duties.reduce((s, d) => s + d.work_time, 0) / duties.length)) : '--', color: theme.palette.text.primary, isText: true },
                { label: 'Maior jornada', count: duties.length > 0 ? minToDuration(Math.max(...duties.map((d) => d.spread_time))) : '--', color: theme.palette.error.light, isText: true },
                { label: 'Menor jornada', count: duties.length > 0 ? minToDuration(Math.min(...duties.map((d) => d.spread_time))) : '--', color: theme.palette.success.light, isText: true },
              ].map(({ label, count, color }) => (
                <Grid item xs={6} sm={3} key={label}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color }}>{count}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={2} mb={2}>
              {[
                { label: 'Custo VSP', value: fmtCurrency(totalBlockCost), sub: `Ociosa ${fmtCurrency(totalBlockIdleCost)}`, color: theme.palette.primary.main },
                { label: 'Custo CSP', value: fmtCurrency(totalDutyCost), sub: `HE ${fmtCurrency(totalDutyOvertimeCost)}`, color: theme.palette.success.main },
                { label: 'Espera paga', value: fmtCurrency(totalDutyWaitingCost), sub: `${duties.filter((d) => Number(d.waiting_cost ?? 0) > 0).length} plantoes`, color: theme.palette.info.main },
                { label: 'Complemento garantido', value: fmtCurrency(totalDutyGuaranteedCost), sub: `${duties.filter((d) => Number(d.guaranteed_cost ?? 0) > 0).length} plantoes`, color: theme.palette.warning.main },
              ].map(({ label, value, sub, color }) => (
                <Grid item xs={6} sm={3} key={label}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
                      <Typography variant="caption" color="text.secondary">{sub}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Tabela de resumo por plantao */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              Detalhe por Plantao de Tripulante
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Plantao</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Inicio</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fim</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Spread</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Trabalho</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Hora Extra</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Custo</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Blocos</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Viagens</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>CCT</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Viol. Desc.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...duties].sort((a, b) => a.duty_id - b.duty_id).map((d) => {
                    const overHard = isDutyHardViolation(d, visualLimits);
                    const overSoft = !overHard && isDutySoftViolation(d, visualLimits);
                    const myB = d.blocks.map((bid) => blocksMap.get(bid)).filter(Boolean) as BlockResult[];
                    const startsAt = myB.length > 0 ? Math.min(...myB.map((b) => b.start_time)) : null;
                    const endsAt   = myB.length > 0 ? Math.max(...myB.map((b) => b.end_time))   : null;
                    const totalTrips = myB.reduce((sum, b) => sum + (b.trips?.length ?? b.num_trips), 0);
                    const extraMin = getDutyOvertimeMinutes(d, visualLimits);
                    return (
                      <TableRow key={d.duty_id} hover
                        sx={overHard ? { bgcolor: 'error.lighter' } : overSoft ? { bgcolor: 'warning.lighter' } : undefined}>
                        <TableCell>
                          <Chip size="small" label={`P${d.duty_id}`}
                            color={overHard ? 'error' : overSoft ? 'warning' : 'success'}
                            sx={{ fontWeight: 700, fontFamily: 'monospace' }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">{minToHHMM(startsAt)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">{minToHHMM(endsAt)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={overHard || overSoft ? 700 : 400}
                            color={overHard ? 'error.main' : overSoft ? 'warning.dark' : 'text.primary'}>
                            {minToDuration(d.spread_time)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{minToDuration(d.work_time)}</Typography>
                        </TableCell>
                        <TableCell>
                          {extraMin > 0 ? (
                            <Typography variant="body2" fontWeight={700}
                              color={overHard ? 'error.main' : 'warning.dark'}>
                              +{minToDuration(extraMin)}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">--</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{fmtCurrency(d.total_cost)}</Typography>
                            {(Number(d.waiting_cost ?? 0) > 0 || Number(d.overtime_cost ?? 0) > 0) && (
                              <Typography variant="caption" color="text.secondary">
                                Espera {fmtCurrency(d.waiting_cost)} · HE {fmtCurrency(d.overtime_cost)}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={d.blocks.length} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={totalTrips} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small"
                            label={overHard ? 'VIOLACAO' : overSoft ? (extraMin > 0 ? 'Hora extra' : 'Jornada estendida') : 'OK'}
                            color={overHard ? 'error' : overSoft ? 'warning' : 'success'}
                            sx={{ fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>
                          {d.rest_violations > 0 ? (
                            <Chip size="small" color="error" label={`${d.rest_violations}`} />
                          ) : (
                            <Chip size="small" color="success" label="OK" variant="outlined" icon={<IconCheck size={12} />} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {tab === 4 && (
          <RunExplainabilityPanel res={res} audit={audit} />
        )}

        {tab === 5 && (
          <RunAuditComparePanel
            run={run}
            audit={audit}
            auditLoading={loadingAudit}
            availableRuns={availableRuns}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Execucao #{run.id} | {fmtDuration(run.durationMs)} | {algLabel} | {fetchedTrips.length} viagens carregadas
        </Typography>
        <Button onClick={onClose} variant="contained">Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
function OptimizationInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [activeSettings, setActiveSettings] = useState<OptimizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [algorithm, setAlgorithm] = useState<AlgorithmValue>('full_pipeline');
  const [maxVehicles, setMaxVehicles] = useState('');
  const [connectionToleranceMinutes, setConnectionToleranceMinutes] = useState('');
  const [launching, setLaunching] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [detailRun, setDetailRun] = useState<OptimizationRun | null>(null);
  const [fetchedTrips, setFetchedTrips] = useState<TripDetail[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [detailAudit, setDetailAudit] = useState<OptimizationRunAudit | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = useCallback(async () => {
    try { setRuns(extractArray(await optimizationApi.getAll())); }
    catch { /* silently */ }
    finally { setLoading(false); }
  }, []);

  const loadLines = useCallback(async () => {
    try { setLines(extractArray(await linesApi.getAll())); }
    catch { /* silently */ }
  }, []);

  const loadActiveSettings = useCallback(async () => {
    try {
      const user = getSessionUser();
      const data = await optimizationSettingsApi.getActive(user?.companyId);
      setActiveSettings(data);
    } catch {
      setActiveSettings(null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadRuns(), loadLines(), loadActiveSettings()]);
  }, [loadRuns, loadLines, loadActiveSettings]);

  useEffect(() => {
    const handleSettingsUpdated = () => { loadActiveSettings(); };
    window.addEventListener(OPTIMIZATION_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => window.removeEventListener(OPTIMIZATION_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
  }, [loadActiveSettings]);

  useEffect(() => {
    const hasActive = runs.some((r) => r.status === 'running' || r.status === 'pending');
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(loadRuns, 5000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [runs, loadRuns]);

  const openDetail = async (run: OptimizationRun) => {
    setDetailRun(run);
    setDetailAudit(null);
    const savedTripSnapshot = Array.isArray((run.resultSummary as any)?.trip_details)
      ? ((run.resultSummary as any).trip_details as TripDetail[])
      : [];
    const savedTrips = mergeTripDetails([], savedTripSnapshot);
    setFetchedTrips(savedTrips);
    setLoadingAudit(true);
    const auditPromise = optimizationApi.getAudit(run.id)
      .then((data) => {
        setDetailAudit(data as OptimizationRunAudit);
      })
      .catch(() => {
        setDetailAudit(null);
      })
      .finally(() => {
        setLoadingAudit(false);
      });
    if (run.status !== 'completed') return;
    setLoadingTrips(true);
    try {
      const ids: number[] = (run as any).lineIds ?? (run.lineId ? [run.lineId] : []);
      if (!ids.length) return;
      const results = await Promise.all(
        ids.map((lid) => tripsApi.getAll({ lineId: lid, companyId: run.companyId ?? 1 }))
      );
      const all = results.flatMap((r) => extractArray(r)) as TripDetail[];
      setFetchedTrips((current) => mergeTripDetails(current, all));
    } catch {
      // silently -- trips nao carregados
    } finally {
      setLoadingTrips(false);
    }

    await auditPromise;
  };

  const handleLaunch = async () => {
    if (!selectedLineIds.length) {
      notify.warning('Selecione pelo menos uma linha para otimizar.');
      return;
    }
    setLaunching(true);
    try {
      const user = getSessionUser();
      const parsedMaxVehicles = maxVehicles ? parseInt(maxVehicles, 10) : null;
      const parsedConnectionTolerance = connectionToleranceMinutes !== ''
        ? parseInt(connectionToleranceMinutes, 10)
        : null;
      const payload: any = {
        companyId: user?.companyId ?? 1,
        algorithm,
        ...(parsedMaxVehicles != null && Number.isFinite(parsedMaxVehicles) ? { vspParams: { maxVehicles: parsedMaxVehicles } } : {}),
        ...(parsedConnectionTolerance != null && Number.isFinite(parsedConnectionTolerance)
          ? { cspParams: { connectionToleranceMinutes: Math.max(0, parsedConnectionTolerance) } }
          : {}),
      };
      if (selectedLineIds.length === 1) {
        payload.lineId = selectedLineIds[0];
      } else {
        payload.lineIds = selectedLineIds;
      }
      await optimizationApi.run(payload);
      const lineLabel = selectedLineIds.length === 1
        ? lines.find((l) => l.id === selectedLineIds[0])?.code ?? `#${selectedLineIds[0]}`
        : `${selectedLineIds.length} linhas`;
      notify.success(`Otimizacao iniciada para ${lineLabel}!`);
      setSelectedLineIds([]);
      setMaxVehicles('');
      setConnectionToleranceMinutes('');
      await loadRuns();
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? e?.message ?? 'Erro ao iniciar otimizacao.');
    } finally {
      setLaunching(false);
    }
  };

  const handleCancel = async (id: number) => {
    setCancelling(id);
    try {
      await optimizationApi.cancel(id);
      notify.info('Execucao cancelada.');
      await loadRuns();
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? 'Erro ao cancelar.');
    } finally {
      setCancelling(null);
    }
  };

  const activeRun      = runs.find((r) => r.status === 'running');
  const pending        = runs.filter((r) => r.status === 'pending');
  const selectedAlgDef = ALGORITHMS.find((a) => a.value === algorithm);

  const stats = {
    total:     runs.length,
    completed: runs.filter((r) => r.status === 'completed').length,
    failed:    runs.filter((r) => r.status === 'failed').length,
    bestCost:  runs
      .filter((r) => r.status === 'completed' && r.totalCost != null)
      .reduce((b, r) => (b == null || r.totalCost! < b ? r.totalCost! : b), null as number | null),
  };

  const runLineLabel = (r: OptimizationRun) => {
    const rids: number[] = (r as any).lineIds ?? (r.lineId ? [r.lineId] : []);
    if (!rids.length) return '--';
    const names = rids.map((id: number) => lines.find((l) => l.id === id)?.code ?? `#${id}`);
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  };

  const latestCompleted = runs.find((r) => r.status === 'completed');
  const shellSx = {
    position: 'relative',
    isolation: 'isolate',
    color: 'text.primary',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '0 auto auto -120px',
      width: 280,
      height: 280,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(71,215,188,0.24) 0%, rgba(71,215,188,0) 72%)',
      pointerEvents: 'none',
      zIndex: -1,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '120px -100px auto auto',
      width: 340,
      height: 340,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(0,116,186,0.22) 0%, rgba(0,116,186,0) 74%)',
      pointerEvents: 'none',
      zIndex: -1,
    },
  } as const;

  const glassPanelSx = {
    borderRadius: 4,
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.92)} 100%)`,
    backdropFilter: 'blur(14px)',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.10)',
  } as const;

  const metricCardSx = {
    borderRadius: 3,
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.light, 0.18)} 100%)`,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
  } as const;

  return (
    <PageContainer title="Otimizacao -- OTIMIZ" description="Engine de otimizacao VSP/CSP">
      <Box sx={shellSx}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={3}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 1.6, color: 'secondary.main', fontWeight: 700 }}>
              OTIMIZ CONTROL TOWER
            </Typography>
            <Typography variant="h3" fontWeight={800} lineHeight={1.02} sx={{ mt: 0.5 }}>
              Planejamento VSP/CSP com leitura operacional real.
            </Typography>
            <Typography variant="body1" color="text.secondary" mt={1.25} sx={{ maxWidth: 760 }}>
              Interface clara, com contraste alto e foco em decisão: execução, auditoria, comparação e leitura de qualidade no mesmo fluxo.
            </Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Chip label="Light default" color="secondary" variant="outlined" />
            <Chip label={activeSettings?.name ? `Perfil ${activeSettings.name}` : 'Sem perfil ativo'} variant="outlined" />
            <Tooltip title="Recarregar">
              <IconButton onClick={loadRuns} size="small" sx={{ border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.92) }}>
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ ...glassPanelSx, p: { xs: 2, md: 3 }, mb: 3, overflow: 'hidden' }}>
          <Grid container spacing={3} alignItems="stretch">
            <Grid item xs={12} lg={7}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: activeRun ? 'warning.main' : 'success.main', boxShadow: activeRun ? '0 0 22px rgba(255,174,31,0.6)' : '0 0 20px rgba(19,222,185,0.45)' }} />
                  <Typography variant="subtitle1" fontWeight={800}>
                    {activeRun ? 'Engine em execução' : 'Engine pronta para nova programação'}
                  </Typography>
                </Stack>

                <Typography variant="h5" fontWeight={750} sx={{ maxWidth: 720 }}>
                  {activeSettings?.name
                    ? `${activeSettings.name} como baseline ativa para regras, pricing e auditoria.`
                    : 'Nenhum preset ativo encontrado; sem baseline forte de regras a leitura da execução fica mais fraca.'}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 780 }}>
                  {activeSettings?.description || 'A página agora prioriza o que importa para operação: status do run, custo, qualidade regulatória e evidência para comparar cenários.'}
                </Typography>

                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip label={activeRun ? `Run ativo #${activeRun.id}` : 'Sem fila crítica'} color={activeRun ? 'warning' : 'success'} variant="filled" />
                  <Chip label={`Linhas carregadas: ${lines.length}`} variant="outlined" />
                  <Chip label={`Execuções concluídas: ${stats.completed}`} variant="outlined" />
                  <Chip label={latestCompleted ? `Último run bom #${latestCompleted.id}` : 'Sem histórico concluído'} variant="outlined" />
                </Stack>

                {activeSettings ? <OptimizationSettingsHighlights settings={activeSettings} /> : null}
              </Stack>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Grid container spacing={2}>
                {[
                  {
                    label: 'Melhor run recente',
                    value: stats.bestCost != null ? fmtCurrency(stats.bestCost) : '--',
                    helper: latestCompleted ? `Run #${latestCompleted.id} · ${runLineLabel(latestCompleted)}` : 'Aguardando histórico',
                  },
                  {
                    label: 'Perfil operacional',
                    value: activeSettings?.algorithmType ? String(activeSettings.algorithmType).replace('_', ' ') : '--',
                    helper: activeSettings?.allowReliefPoints ? 'Relief points ligados' : 'Relief points desligados',
                  },
                  {
                    label: 'Frota alvo',
                    value: activeRun?.totalVehicles ?? latestCompleted?.totalVehicles ?? '--',
                    helper: activeRun ? 'estimativa em andamento' : 'última execução concluída',
                  },
                  {
                    label: 'Crew alvo',
                    value: activeRun?.totalCrew ?? latestCompleted?.totalCrew ?? '--',
                    helper: activeRun ? 'cálculo em andamento' : 'última execução concluída',
                  },
                ].map((item) => (
                  <Grid item xs={12} sm={6} key={item.label}>
                    <Paper
                      variant="outlined"
                      sx={{
                        height: '100%',
                        borderRadius: 3,
                        p: 1.75,
                        borderColor: alpha(theme.palette.divider, 0.9),
                        bgcolor: alpha(theme.palette.background.paper, 0.96),
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                      <Typography variant="h5" fontWeight={800} mt={0.35}>{item.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.helper}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mt={2}>
                <Button variant="outlined" startIcon={<IconSettings size={16} />} onClick={openOptimizationSettingsDrawer} fullWidth>
                  Ajuste rápido
                </Button>
                <Button variant="contained" href="/otimiz/settings" fullWidth>
                  Gerenciar perfis
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* KPIs */}
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Execucoes', value: stats.total, sub: 'Janela recente carregada', color: theme.palette.primary.main, icon: <IconChartBar size={18} /> },
            { label: 'Concluidas', value: stats.completed, sub: 'Runs finalizados com payload', color: theme.palette.success.main, icon: <IconCheck size={18} /> },
            { label: 'Erros', value: stats.failed, sub: 'Falhas operacionais ou técnicas', color: theme.palette.error.main, icon: <IconAlertTriangle size={18} /> },
            {
              label: 'Melhor custo',
              value: stats.bestCost != null
                ? fmtCurrency(stats.bestCost)
                : '--',
              sub: latestCompleted ? `Último concluído #${latestCompleted.id}` : 'Sem benchmark ainda',
              color: theme.palette.warning.main,
              icon: <IconCurrencyDollar size={18} />,
            },
          ].map(({ label, value, color, icon, sub }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Card variant="outlined" sx={metricCardSx}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" gap={0.75} mb={0.75} sx={{ color }}>
                    {icon}
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700} sx={{ color }}>{value}</Typography>
                  <Typography variant="caption" color="text.secondary">{sub}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {activeRun && (
          <Alert severity="warning" icon={<IconRobot size={20} />} sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle sx={{ fontWeight: 700 }}>Otimizacao em andamento</AlertTitle>
            {runLineLabel(activeRun)} -- {ALGORITHMS.find((a) => a.value === activeRun.algorithm)?.label ?? activeRun.algorithm}
            <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Painel de lancamento */}
          <Grid item xs={12} md={4}>
            <DashboardCard
              title="Nova Execucao"
              subtitle="Dispare cenários com leitura operacional imediata"
              action={<IconPlayerPlay size={20} />}
              sx={glassPanelSx}
            >
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Linhas a otimizar</InputLabel>
                  <Select
                    multiple
                    value={selectedLineIds}
                    onChange={(e) => setSelectedLineIds(e.target.value as number[])}
                    input={<OutlinedInput label="Linhas a otimizar" />}
                    renderValue={(sel) => {
                      const names = (sel as number[]).map(
                        (id) => lines.find((l) => l.id === id)?.code ?? `#${id}`
                      );
                      return names.length > 3
                        ? `${names.slice(0, 3).join(', ')} +${names.length - 3}`
                        : names.join(', ') || 'Selecione...';
                    }}
                  >
                    {lines.map((l) => (
                      <MenuItem key={l.id} value={l.id}>
                        <Checkbox checked={selectedLineIds.includes(l.id)} size="small" />
                        <ListItemText
                          primary={`${l.code} -- ${l.name}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {selectedLineIds.length === 0 && 'Selecione uma ou mais linhas'}
                    {selectedLineIds.length === 1 && '1 linha selecionada'}
                    {selectedLineIds.length > 1 && `${selectedLineIds.length} linhas -- otimizacao conjunta`}
                  </FormHelperText>
                </FormControl>

                <TextField
                  label="Algoritmo" select fullWidth size="small"
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as AlgorithmValue)}
                  helperText={activeSettings?.algorithmType === algorithm ? 'Mesmo algoritmo do perfil ativo' : `Perfil ativo: ${ALGORITHMS.find((a) => a.value === activeSettings?.algorithmType)?.label ?? '--'}`}
                >
                  {ALGORITHMS.map((a) => (
                    <MenuItem key={a.value} value={a.value}>
                      <Box sx={{ width: '100%' }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" fontWeight={600}>{a.label}</Typography>
                          {a.badge && (
                            <Chip size="small" label={a.badge} color={a.badgeColor ?? 'default'}
                              sx={{ fontSize: 10, height: 18, ml: 1 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{a.description}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>

                {selectedAlgDef && (
                  <Alert severity="info" icon={<IconInfoCircle size={16} />} sx={{ py: 0.5, borderRadius: 1.5 }}>
                    <Typography variant="caption">{selectedAlgDef.description}</Typography>
                  </Alert>
                )}

                <TextField
                  label="Max. Veiculos (opcional)" fullWidth size="small" type="number"
                  value={maxVehicles} onChange={(e) => setMaxVehicles(e.target.value)}
                  helperText="Deixe em branco para o solver calcular a frota"
                  inputProps={{ min: 1 }}
                />

                <TextField
                  label="Tolerancia de conexao (min)" fullWidth size="small" type="number"
                  value={connectionToleranceMinutes}
                  onChange={(e) => setConnectionToleranceMinutes(e.target.value)}
                  helperText="Microajuste opcional para absorver deficits curtos de conexao com qualquer valor de minutos informado, sem persistir mudanca na viagem"
                  inputProps={{ min: 0 }}
                />

                <Divider />

                {activeSettings && (
                  <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    <Typography variant="caption">
                      Esta execução usará o perfil ativo <strong>{activeSettings.name || `#${activeSettings.id}`}</strong> no backend,
                      incluindo regras CCT, set covering, pricing e parâmetros de energia. Os campos desta tela apenas ajustam a execução corrente,
                      sem persistir alteração na base.
                    </Typography>
                  </Alert>
                )}

                <Button
                  variant="contained" size="large" fullWidth
                  startIcon={<IconPlayerPlay size={18} />}
                  onClick={handleLaunch}
                  disabled={launching || !selectedLineIds.length || !!activeRun}
                  sx={{ fontWeight: 700, py: 1.2, borderRadius: 2.5, boxShadow: '0 18px 40px rgba(0,116,186,0.35)' }}
                >
                  {launching ? 'Iniciando...' : activeRun ? 'Aguardando execucao atual...' : 'Executar Otimizacao'}
                </Button>

                {pending.length > 0 && (
                  <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    <Typography variant="caption">{pending.length} execucao(oes) na fila.</Typography>
                  </Alert>
                )}

                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
                    Acesso rapido:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(['greedy', 'genetic', 'simulated_annealing', 'tabu_search', 'set_partitioning', 'joint_solver'] as AlgorithmValue[]).map((alg) => (
                      <Chip key={alg} size="small"
                        label={ALGORITHMS.find((a) => a.value === alg)?.label.split(' ')[0] ?? alg}
                        onClick={() => setAlgorithm(alg)}
                        color={algorithm === alg ? 'primary' : 'default'}
                        variant={algorithm === alg ? 'filled' : 'outlined'}
                        sx={{ fontSize: 10, cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Box>
              </Stack>
            </DashboardCard>
          </Grid>

          {/* Historico */}
          <Grid item xs={12} md={8}>
            <DashboardCard
              title={`Historico de Execucoes (${runs.length})`}
              subtitle="Lista operacional pronta para abrir detalhe, auditoria e comparação"
              sx={glassPanelSx}
            >
              <>
                {loading ? (
                  <Box>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box>
                ) : (
                  <TableContainer sx={{ borderRadius: 3, border: '1px solid rgba(148, 163, 184, 0.12)', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.light, 0.5) }}>
                          <TableCell sx={{ fontWeight: 600, width: 40 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Linhas</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Algoritmo</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Veic.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Trip.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Custo</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Duracao</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Data</TableCell>
                          <TableCell sx={{ width: 80 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {runs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                              <IconRoute size={40} color={theme.palette.grey[400]} />
                              <Typography variant="body2" color="text.secondary" mt={1}>
                                Nenhuma execucao ainda. Lance sua primeira otimizacao acima!
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : runs.map((r) => (
                          <TableRow key={r.id} hover
                            sx={r.status === 'running'
                              ? { bgcolor: 'rgba(255,174,31,0.12)' }
                              : { '&:nth-of-type(odd)': { bgcolor: alpha(theme.palette.primary.light, 0.22) } }}>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">#{r.id}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                {runLineLabel(r)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 140 }}>
                                {ALGORITHMS.find((a) => a.value === r.algorithm)?.label ?? r.algorithm}
                              </Typography>
                            </TableCell>
                            <TableCell align="center"><StatusBadge status={r.status} /></TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600}>{r.totalVehicles ?? '--'}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600}>{r.totalCrew ?? '--'}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              {r.totalCost != null ? (
                                <Typography variant="body2">
                                  {Number(r.totalCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </Typography>
                              ) : '--'}
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={0.5}>
                                <IconClock size={12} />
                                <Typography variant="body2">{fmtDuration(r.durationMs)}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary" noWrap>{fmtDate(r.createdAt)}</Typography>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" gap={0.5}>
                                {(r.status === 'completed' || r.status === 'failed') && (
                                  <Tooltip title="Ver resultado detalhado">
                                    <IconButton size="small" color="primary" onClick={() => openDetail(r)} sx={{ border: '1px solid', borderColor: 'rgba(71,215,188,0.24)', bgcolor: 'rgba(71,215,188,0.08)' }}>
                                      <IconEye size={16} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {(r.status === 'running' || r.status === 'pending') && (
                                  <Tooltip title="Cancelar">
                                    <IconButton size="small" color="error" disabled={cancelling === r.id}
                                      onClick={() => handleCancel(r.id)} sx={{ border: '1px solid', borderColor: 'rgba(250,137,107,0.24)', bgcolor: 'rgba(250,137,107,0.08)' }}>
                                      <IconPlayerStop size={15} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                {activeRun && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress color="warning" sx={{ borderRadius: 1 }} />
                    <Typography variant="caption" color="text.secondary"
                      sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                      Atualizando a cada 5 segundos...
                    </Typography>
                  </Box>
                )}
              </>
            </DashboardCard>
          </Grid>
        </Grid>
      </Box>

      {/* Carregando viagens */}
      {loadingTrips && (
        <Box sx={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
          borderRadius: 2, px: 2, py: 1, boxShadow: 4,
        }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <LinearProgress sx={{ width: 120 }} />
            <Typography variant="caption">Carregando viagens...</Typography>
          </Stack>
        </Box>
      )}

      <DetailedResultDialog
        run={detailRun}
        lines={lines}
        fetchedTrips={fetchedTrips}
        availableRuns={runs}
        audit={detailAudit}
        loadingAudit={loadingAudit}
        open={!!detailRun}
        onClose={() => { setDetailRun(null); setDetailAudit(null); setFetchedTrips([]); }}
      />
    </PageContainer>
  );
}

export default function OptimizationPage() {
  return <NotifyProvider><OptimizationInner /></NotifyProvider>;
}
