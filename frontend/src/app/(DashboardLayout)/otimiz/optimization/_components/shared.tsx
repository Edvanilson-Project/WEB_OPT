'use client';
import React from 'react';
import {
  Box, Grid, Typography, Stack, Tooltip, Chip, Paper,
  useTheme,
} from '@mui/material';
import {
  IconCurrencyDollar, IconBus, IconUsers, IconShieldCheck,
} from '@tabler/icons-react';
import type {
  OptimizationRun, OptimizationResultSummary, TripDetail,
  OptimizationComparisonMetric,
} from '../../_types';
import {
  fmtCurrency, minToHHMM, fmtElapsedMsCompact,
  fmtSignedPercent, formatComparisonValue,
  getComparisonPreference, getComparisonDeltaStatus,
  getRunAuditSnapshot,
} from '../_helpers/formatters';

// ─── Shared sx tokens (re-exported from centralized _tokens) ────────────────
import { thSx as _thSx, tdCompactSx as _tdCompactSx, kpiCardSx as _kpiCardSx } from '../../_tokens/design-tokens';
export const thSx = _thSx;
export const tdCompactSx = _tdCompactSx;
export const kpiCardSx = _kpiCardSx;

// ─── ComparisonDeltaCell ─────────────────────────────────────────────────────
export function ComparisonDeltaCell({
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

// ─── RunHistorySummary ───────────────────────────────────────────────────────
export function RunHistorySummary({ run }: { run: OptimizationRun }) {
  const { totalElapsedMs } = getRunAuditSnapshot(run);

  if (totalElapsedMs == null) return null;

  return (
    <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
      Solver: {fmtElapsedMsCompact(totalElapsedMs)}
    </Typography>
  );
}

// ─── TripTimeline ────────────────────────────────────────────────────────────
export function TripTimeline({ trips, start, end, totalDuration }: { trips: TripDetail[], start: number, end: number, totalDuration: number }) {
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

// ─── KpiStrip ────────────────────────────────────────────────────────────────
export function KpiStrip({ res, run }: { res: OptimizationResultSummary; run: OptimizationRun }) {
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
          <Paper variant="outlined" sx={{ ...kpiCardSx, borderLeftColor: it.color }}>
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
