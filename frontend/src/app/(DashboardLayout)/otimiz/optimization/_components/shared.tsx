'use client';
import React from 'react';
import {
  Box, Grid, Typography, Stack, Tooltip, Chip, Paper,
  useTheme, alpha,
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const items = [
    { 
      label: 'Custo Total', 
      value: fmtCurrency(run.totalCost ?? res.total_cost ?? res.totalCost), 
      color: theme.palette.primary.main, 
      icon: <IconCurrencyDollar size={24} stroke={1.5} />,
      bgColor: alpha(theme.palette.primary.main, 0.05)
    },
    { 
      label: 'Veículos (VSP)', 
      value: run.totalVehicles ?? res.vehicles ?? res.num_vehicles ?? '--', 
      color: theme.palette.info.main, 
      icon: <IconBus size={24} stroke={1.5} />,
      bgColor: alpha(theme.palette.info.main, 0.05)
    },
    { 
      label: 'Tripulantes (CSP)', 
      value: run.totalCrew ?? res.crew ?? res.num_crew ?? '--', 
      color: theme.palette.success.main, 
      icon: <IconUsers size={24} stroke={1.5} />,
      bgColor: alpha(theme.palette.success.main, 0.05)
    },
    { 
      label: 'Violações CCT', 
      value: run.cctViolations ?? res.cct_violations ?? res.cctViolations ?? 0, 
      color: (run.cctViolations ?? res.cct_violations ?? res.cctViolations ?? 0) > 0 ? theme.palette.error.main : theme.palette.success.main, 
      icon: <IconShieldCheck size={24} stroke={1.5} />,
      bgColor: (run.cctViolations ?? res.cct_violations ?? res.cctViolations ?? 0) > 0 ? alpha(theme.palette.error.main, 0.05) : alpha(theme.palette.success.main, 0.05)
    },
  ];

  return (
    <Grid container spacing={2.5} mb={4}>
      {items.map((it) => (
        <Grid item xs={12} sm={6} md={3} key={it.label}>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2.5,
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha(it.color, 0.2),
              bgcolor: isDark ? alpha(it.color, 0.03) : '#fff',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 24px ${alpha(it.color, 0.12)}`,
                borderColor: alpha(it.color, 0.5),
              }
            }}
          >
            {/* Background Accent */}
            <Box sx={{ 
              position: 'absolute', top: -20, right: -20, 
              width: 80, height: 80, 
              borderRadius: '50%', 
              bgcolor: alpha(it.color, 0.05),
              zIndex: 0
            }} />

            <Stack direction="row" alignItems="center" spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 48, height: 48, borderRadius: 3,
                bgcolor: it.bgColor, color: it.color,
                boxShadow: `0 4px 12px ${alpha(it.color, 0.1)}`
              }}>
                {it.icon}
              </Box>
              
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', lineHeight: 1.2, display: 'block', mb: 0.5, letterSpacing: 0.5 }}>
                  {it.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.5, color: 'text.primary' }}>
                  {it.value}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
