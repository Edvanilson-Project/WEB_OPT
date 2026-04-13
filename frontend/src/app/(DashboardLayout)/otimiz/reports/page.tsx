'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Grid, LinearProgress, MenuItem, Paper, Stack, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
  useTheme,
} from '@mui/material';
import {
  IconAlertTriangle,
  IconBus,
  IconCheckbox,
  IconClockHour4,
  IconCurrencyDollar,
  IconDownload,
  IconRefresh,
  IconShieldCheck,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import KpiCard from '../_components/KpiCard';
import { NotifyProvider } from '../_components/Notify';
import { getSessionUser } from '@/lib/api';
import {
  useOptimizationComparison,
  useOptimizationHistory,
  useOptimizationKpis,
  useOptimizationLiveSync,
  useSchedules,
} from '@/lib/query-hooks';
import {
  buildAlgorithmBenchmarks,
  buildAlgorithmAuditRows,
  buildHistoryPoints,
  normalizeKpiData,
  normalizeOptimizationRuns,
  type AlgorithmBenchmarkRow,
  type AlgorithmAuditRow,
  type HistoricalRunPoint,
  type KpiSnapshot,
} from '../_helpers/run-history';
import type { OptimizationRunComparison, Schedule } from '../_types';
import { ComparisonDeltaCell, thSx } from '../optimization/_components/shared';
import { formatComparisonValue, labelizeKey } from '../optimization/_helpers/formatters';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Period = 7 | 30 | 90;

const ALGO_LABEL: Record<string, string> = {
  full_pipeline: 'Pipeline Completo',
  hybrid_pipeline: 'Pipeline Híbrido',
  vsp_only: 'Veículos (VSP)',
  csp_only: 'Tripulação (CSP)',
  greedy: 'Heurístico',
  genetic: 'Genético',
  simulated_annealing: 'Simulated Annealing',
  tabu_search: 'Tabu Search',
  set_partitioning: 'Set Partitioning',
  joint_solver: 'Joint Solver',
};

const COMPARISON_LABELS: Record<string, string> = {
  vehicles: 'Veículos',
  crew: 'Tripulantes',
  totalTrips: 'Viagens',
  totalCost: 'Custo total',
  cctViolations: 'Violações CCT',
  hardIssues: 'Issues hard',
  softIssues: 'Issues soft',
  unassignedTrips: 'Sem cobertura',
  uncoveredBlocks: 'Blocos descobertos',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtCurrency(n?: number) {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDuration(ms?: number) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtPercent(value?: number | null, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function fmtRatioPercent(value?: number | null, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return fmtPercent(Number(value) * 100, digits);
}

function fmtSignedPercent(value?: number | null, digits = 1, suffix = 'pp') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

function fmtSignedRelativePercent(value?: number | null, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function fmtAvg(value?: number | null, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function algorithmLabel(algorithm: string) {
  return ALGO_LABEL[algorithm] ?? labelizeKey(algorithm);
}

type AuditOperationFilter = 'all' | 'urban' | 'charter' | 'unknown';

type AuditScheduleFilter = 'all' | 'none' | `${number}`;

function operationModeLabel(value: AuditOperationFilter) {
  if (value === 'urban') return 'Urbano';
  if (value === 'charter') return 'Fretamento';
  if (value === 'unknown') return 'Sem operação';
  return 'Todas as operações';
}

function getHistoryPointLineIds(point: HistoricalRunPoint): number[] {
  const ids = point.lineIds?.filter((lineId): lineId is number => Number.isFinite(lineId)) ?? [];
  if (ids.length) return Array.from(new Set(ids)).sort((left, right) => left - right);
  return point.lineId != null ? [point.lineId] : [];
}

function scheduleFilterLabel(filter: AuditScheduleFilter, scheduleMap: Map<number, Schedule>) {
  if (filter === 'all') return 'Todos os quadros';
  if (filter === 'none') return 'Sem quadro vinculado';
  const scheduleId = Number(filter);
  const schedule = scheduleMap.get(scheduleId);
  if (!schedule) return `Quadro ${scheduleId}`;
  return `${schedule.name} · linha ${schedule.lineId}`;
}

function getHistoryPointProfileKey(point: HistoricalRunPoint): string | null {
  if (point.profileId != null) return `id:${point.profileId}`;
  if (point.profileName) return `name:${point.profileName}`;
  return null;
}

function getHistoryPointProfileLabel(point: HistoricalRunPoint): string {
  if (point.profileName && point.profileId != null) return `${point.profileName} · perfil ${point.profileId}`;
  if (point.profileName) return point.profileName;
  if (point.profileId != null) return `Perfil ${point.profileId}`;
  return 'Sem perfil';
}

function downloadComparisonCsv(
  comparison: OptimizationRunComparison,
  baseId: string,
  otherId: string,
) {
  const date = new Date().toISOString().slice(0, 10);
  const escape = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines: string[] = [
    `${escape('Duelo de Execuções')},${escape(`Base #${baseId}`)},${escape(`Comparada #${otherId}`)},${escape('Data:')},${escape(date)}`,
    `${escape('Algoritmo Base')},${escape(algorithmLabel(comparison.algorithms?.base ?? ''))}`,
    `${escape('Algoritmo Comparada')},${escape(algorithmLabel(comparison.algorithms?.other ?? ''))}`,
    `${escape('Headline')},${escape(comparison.summary?.headline ?? '')}`,
    '',
    [escape('Indicador'), escape('Base'), escape('Comparada'), escape('Delta'), escape('Delta %')].join(','),
    ...Object.entries(comparison.metrics ?? {}).map(([key, m]) =>
      [escape(COMPARISON_LABELS[key] ?? labelizeKey(key)), escape(m.base ?? ''), escape(m.other ?? ''), escape(m.delta ?? ''), escape(m.pctDelta != null ? `${(Number(m.pctDelta) * 100).toFixed(1)}%` : '')].join(','),
    ),
    '',
    escape('Integridade do Replay'),
    `${escape('Mesmo input hash')},${escape(comparison.reproducibility?.sameInputHash ?? '')}`,
    `${escape('Mesmo params hash')},${escape(comparison.reproducibility?.sameParamsHash ?? '')}`,
    `${escape('Mesmo budget')},${escape(comparison.reproducibility?.sameTimeBudget ?? '')}`,
    `${escape('Input base')},${escape(comparison.reproducibility?.base?.inputHash ?? '')}`,
    `${escape('Input comparada')},${escape(comparison.reproducibility?.other?.inputHash ?? '')}`,
  ];
  if (Object.keys(comparison.performance?.phaseTimings ?? {}).length > 0) {
    lines.push('');
    lines.push(escape('Timings de Fase'));
    lines.push([escape('Fase'), escape('Base (ms)'), escape('Comparada (ms)'), escape('Delta (ms)')].join(','));
    for (const [key, m] of Object.entries(comparison.performance!.phaseTimings!)) {
      lines.push([escape(labelizeKey(key)), escape(m.base ?? ''), escape(m.other ?? ''), escape(m.delta ?? '')].join(','));
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `duelo-run${baseId}-vs-run${otherId}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadComparisonJson(
  comparison: OptimizationRunComparison,
  baseId: string,
  otherId: string,
) {
  const date = new Date().toISOString().slice(0, 10);
  const payload = {
    exportedAt: new Date().toISOString(),
    base: { runId: Number(baseId), algorithm: comparison.algorithms?.base },
    other: { runId: Number(otherId), algorithm: comparison.algorithms?.other },
    summary: comparison.summary,
    metrics: comparison.metrics,
    reproducibility: comparison.reproducibility,
    performance: comparison.performance,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `duelo-run${baseId}-vs-run${otherId}-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function findLeader<T extends AlgorithmBenchmarkRow>(
  rows: T[],
  accessor: (row: T) => number | null,
  direction: 'higher' | 'lower',
): T | null {
  const valid = rows.filter((row) => accessor(row) != null);
  if (!valid.length) return null;

  return valid.reduce<T | null>((best, row) => {
    if (!best) return row;
    const rowValue = accessor(row);
    const bestValue = accessor(best);
    if (rowValue == null || bestValue == null) return best;
    return direction === 'higher'
      ? rowValue > bestValue ? row : best
      : rowValue < bestValue ? row : best;
  }, null);
}

function AuditDeltaChip({
  value,
  formatter,
  positiveIsGood = true,
}: {
  value: number | null;
  formatter: (value: number) => string;
  positiveIsGood?: boolean;
}) {
  if (value == null || !Number.isFinite(Number(value))) {
    return <Chip size="small" variant="outlined" label="—" />;
  }

  const normalized = Number(value);
  const direction = normalized === 0 ? 'neutral' : normalized > 0 ? 'positive' : 'negative';
  const color = direction === 'neutral'
    ? 'default'
    : (positiveIsGood
        ? direction === 'positive' ? 'success' : 'error'
        : direction === 'positive' ? 'error' : 'success');

  return <Chip size="small" color={color} variant={direction === 'neutral' ? 'outlined' : 'filled'} label={formatter(normalized)} />;
}

function BaselineTagChip({ row }: { row: AlgorithmAuditRow }) {
  if (row.baselineTag === 'above') {
    return <Chip size="small" color="success" label="Acima do baseline" />;
  }
  if (row.baselineTag === 'below') {
    return <Chip size="small" color="error" label="Abaixo do baseline" />;
  }
  return <Chip size="small" color="warning" label="Monitorar" />;
}

function ReportsInner() {
  const theme = useTheme();
  const companyId = getSessionUser()?.companyId ?? 1;
  const [period, setPeriod] = useState<Period>(30);
  const [auditOperationFilter, setAuditOperationFilter] = useState<AuditOperationFilter>('all');
  const [auditLineFilter, setAuditLineFilter] = useState('all');
  const [auditScheduleFilter, setAuditScheduleFilter] = useState<AuditScheduleFilter>('all');
  const [auditProfileFilter, setAuditProfileFilter] = useState('all');
  const [errorDismissed, setErrorDismissed] = useState(false);

  const {
    activeRun,
    hasActiveRun,
    refetch: refetchRuns,
    syncIntervalMs,
  } = useOptimizationLiveSync(companyId, {
    invalidateRelated: true,
    idleIntervalMs: 30_000,
    liveIntervalMs: 5_000,
  });
  const kpisQuery = useOptimizationKpis(companyId);
  const historyQuery = useOptimizationHistory(companyId, period);
  const schedulesQuery = useSchedules();

  const kpis: KpiSnapshot = useMemo(
    () => normalizeKpiData(kpisQuery.data),
    [kpisQuery.data],
  );
  const history: HistoricalRunPoint[] = useMemo(
    () => buildHistoryPoints(normalizeOptimizationRuns(historyQuery.data)),
    [historyQuery.data],
  );
  const loadingKpis = kpisQuery.isLoading;
  const loadingHistory = historyQuery.isLoading;
  const schedules = useMemo<Schedule[]>(
    () => Array.isArray(schedulesQuery.data) ? schedulesQuery.data as Schedule[] : [],
    [schedulesQuery.data],
  );
  const schedulesById = useMemo(
    () => new Map(schedules.map((schedule) => [schedule.id, schedule])),
    [schedules],
  );
  const benchmarks = useMemo(() => buildAlgorithmBenchmarks(history), [history]);
  const auditLineOptions = useMemo(() => {
    const counts = new Map<number, number>();

    history.forEach((point) => {
      getHistoryPointLineIds(point).forEach((lineId) => {
        counts.set(lineId, (counts.get(lineId) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([lineId, runCount]) => ({ value: String(lineId), label: `Linha ${lineId}`, runCount }));
  }, [history]);
  const hasRunsWithoutLine = useMemo(
    () => history.some((point) => getHistoryPointLineIds(point).length === 0),
    [history],
  );
  const auditScheduleOptions = useMemo(() => {
    const counts = new Map<number, number>();

    history.forEach((point) => {
      if (point.scheduleId == null) return;
      counts.set(point.scheduleId, (counts.get(point.scheduleId) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([scheduleId, runCount]) => ({
        value: String(scheduleId) as AuditScheduleFilter,
        label: scheduleFilterLabel(String(scheduleId) as AuditScheduleFilter, schedulesById),
        runCount,
      }));
  }, [history, schedulesById]);
  const hasRunsWithoutSchedule = useMemo(
    () => history.some((point) => point.scheduleId == null),
    [history],
  );
  const auditProfileOptions = useMemo(() => {
    const counts = new Map<string, { label: string; runCount: number }>();

    history.forEach((point) => {
      const key = getHistoryPointProfileKey(point);
      if (!key) return;
      const current = counts.get(key);
      if (current) {
        current.runCount += 1;
        return;
      }
      counts.set(key, { label: getHistoryPointProfileLabel(point), runCount: 1 });
    });

    return Array.from(counts.entries())
      .sort((left, right) => left[1].label.localeCompare(right[1].label, 'pt-BR'))
      .map(([value, meta]) => ({ value, label: meta.label, runCount: meta.runCount }));
  }, [history]);
  const hasRunsWithoutProfile = useMemo(
    () => history.some((point) => getHistoryPointProfileKey(point) == null),
    [history],
  );
  const auditHistory = useMemo(() => history.filter((point) => {
    if (auditOperationFilter === 'urban' || auditOperationFilter === 'charter') {
      if (point.operationMode !== auditOperationFilter) return false;
    }
    if (auditOperationFilter === 'unknown' && point.operationMode) {
      return false;
    }

    if (auditLineFilter === 'none') {
      if (getHistoryPointLineIds(point).length !== 0) return false;
    } else if (auditLineFilter !== 'all' && !getHistoryPointLineIds(point).includes(Number(auditLineFilter))) {
      return false;
    }

    if (auditScheduleFilter === 'none') {
      if (point.scheduleId != null) return false;
    } else if (auditScheduleFilter !== 'all' && point.scheduleId !== Number(auditScheduleFilter)) {
      return false;
    }

    if (auditProfileFilter === 'all') return true;
    if (auditProfileFilter === 'none') return getHistoryPointProfileKey(point) == null;
    return getHistoryPointProfileKey(point) === auditProfileFilter;
  }), [auditLineFilter, auditOperationFilter, auditProfileFilter, auditScheduleFilter, history]);
  const algorithmAudit = useMemo(() => buildAlgorithmAuditRows(auditHistory), [auditHistory]);
  const filteredAuditRunsCount = auditHistory.length;
  const completedRuns = useMemo(
    () => history.filter((run) => run.status === 'completed').slice().sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)),
    [history],
  );
  const [baseRunId, setBaseRunId] = useState('');
  const [otherRunId, setOtherRunId] = useState('');

  useEffect(() => {
    if (!completedRuns.length) {
      setBaseRunId('');
      setOtherRunId('');
      return;
    }

    const nextBaseId = baseRunId && completedRuns.some((run) => String(run.runId) === baseRunId)
      ? baseRunId
      : String(completedRuns[0].runId);
    const fallbackOther = completedRuns.find((run) => String(run.runId) !== nextBaseId);

    setBaseRunId(nextBaseId);
    setOtherRunId((current) => {
      if (current && completedRuns.some((run) => String(run.runId) === current) && current !== nextBaseId) return current;
      return fallbackOther ? String(fallbackOther.runId) : '';
    });
  }, [baseRunId, completedRuns]);

  const comparisonQuery = useOptimizationComparison(
    baseRunId ? Number(baseRunId) : undefined,
    otherRunId ? Number(otherRunId) : undefined,
  );
  const comparison = comparisonQuery.data as OptimizationRunComparison | undefined;

  const error = useMemo(() => {
    if (!kpisQuery.data && !historyQuery.data && (kpisQuery.isError || historyQuery.isError)) {
      return 'Falha ao carregar relatórios e KPIs.';
    }

    if (historyQuery.isError) {
      return 'Histórico detalhado indisponível no momento.';
    }

    return '';
  }, [historyQuery.data, historyQuery.isError, kpisQuery.data, kpisQuery.isError]);

  useEffect(() => {
    setErrorDismissed(false);
  }, [error, period]);

  useEffect(() => {
    if (auditLineFilter === 'all' || auditLineFilter === 'none') return;
    if (!auditLineOptions.some((option) => option.value === auditLineFilter)) {
      setAuditLineFilter('all');
    }
  }, [auditLineFilter, auditLineOptions]);

  useEffect(() => {
    if (auditScheduleFilter === 'all' || auditScheduleFilter === 'none') return;
    if (!auditScheduleOptions.some((option) => option.value === auditScheduleFilter)) {
      setAuditScheduleFilter('all');
    }
  }, [auditScheduleFilter, auditScheduleOptions]);

  useEffect(() => {
    if (auditProfileFilter === 'all' || auditProfileFilter === 'none') return;
    if (!auditProfileOptions.some((option) => option.value === auditProfileFilter)) {
      setAuditProfileFilter('all');
    }
  }, [auditProfileFilter, auditProfileOptions]);

  const clearAuditFilters = () => {
    setAuditOperationFilter('all');
    setAuditLineFilter('all');
    setAuditScheduleFilter('all');
    setAuditProfileFilter('all');
  };

  const handleRefresh = async () => {
    setErrorDismissed(false);
    await Promise.all([
      refetchRuns(),
      kpisQuery.refetch(),
      historyQuery.refetch(),
    ]);
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, background: 'transparent' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
    xaxis: {
      categories: history.map((h) => fmtDate(h.timestamp)),
      tickAmount: Math.min(7, history.length),
      labels: { style: { fontSize: '11px' } },
    },
    yaxis: [
      { title: { text: 'Veículos / Tripulantes' }, min: 0 },
      { opposite: true, title: { text: 'Custo (R$)' }, min: 0 },
    ],
    legend: { position: 'top' },
    tooltip: { theme: theme.palette.mode },
    theme: { mode: theme.palette.mode },
    colors: [theme.palette.primary.main, '#13DEB9', '#FFAE1F'],
  };

  const series = [
    { name: 'Veículos', data: history.map((h) => h.totalVehicles ?? 0) },
    { name: 'Tripulantes', data: history.map((h) => h.totalCrew ?? 0) },
    { name: 'Custo (÷1000)', data: history.map((h) => h.totalCost ? Number((h.totalCost / 1000).toFixed(1)) : 0), yAxisIndex: 1 },
  ];
  const qualityLeader = useMemo(() => findLeader(benchmarks, (row) => row.operationalScore, 'higher'), [benchmarks]);
  const costLeader = useMemo(() => findLeader(benchmarks, (row) => row.avgCost, 'lower'), [benchmarks]);
  const durationLeader = useMemo(() => findLeader(benchmarks, (row) => row.avgDurationMs, 'lower'), [benchmarks]);
  const stabilityLeader = useMemo(() => findLeader(benchmarks, (row) => row.avgSameRosterRatio, 'higher'), [benchmarks]);
  const metricsEntries = Object.entries(comparison?.metrics ?? {}).filter(([, metric]) => metric != null);
  const performanceEntries = Object.entries(comparison?.performance?.phaseTimings ?? {}).slice(0, 8);
  const benchmarkHighlights = [
    {
      label: 'Melhor score operacional',
      row: qualityLeader,
      value: qualityLeader ? fmtPercent(qualityLeader.operationalScore) : '—',
      subtitle: qualityLeader ? `${algorithmLabel(qualityLeader.algorithm)} · ${qualityLeader.runCount} runs` : 'Sem histórico suficiente',
      icon: <IconShieldCheck size={18} />,
      color: theme.palette.success.main,
    },
    {
      label: 'Menor custo médio',
      row: costLeader,
      value: costLeader ? fmtCurrency(costLeader.avgCost ?? undefined) : '—',
      subtitle: costLeader ? algorithmLabel(costLeader.algorithm) : 'Sem histórico suficiente',
      icon: <IconCurrencyDollar size={18} />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Menor duração média',
      row: durationLeader,
      value: durationLeader ? fmtDuration(durationLeader.avgDurationMs ?? undefined) : '—',
      subtitle: durationLeader ? algorithmLabel(durationLeader.algorithm) : 'Sem histórico suficiente',
      icon: <IconClockHour4 size={18} />,
      color: '#FFAE1F',
    },
    {
      label: 'Maior aderência de grupos',
      row: stabilityLeader,
      value: stabilityLeader ? fmtRatioPercent(stabilityLeader.avgSameRosterRatio) : '—',
      subtitle: stabilityLeader ? algorithmLabel(stabilityLeader.algorithm) : 'Sem histórico suficiente',
      icon: <IconAlertTriangle size={18} />,
      color: '#13DEB9',
    },
  ];
  const baselineSummary = algorithmAudit.baseline;
  const hasAuditFilters = auditOperationFilter !== 'all' || auditLineFilter !== 'all' || auditScheduleFilter !== 'all' || auditProfileFilter !== 'all';
  const activeAuditFilterChips = useMemo(() => {
    const chips: string[] = [];

    if (auditOperationFilter !== 'all') {
      chips.push(`Operação: ${operationModeLabel(auditOperationFilter)}`);
    }

    if (auditLineFilter === 'none') {
      chips.push('Linha: sem vínculo');
    } else if (auditLineFilter !== 'all') {
      const option = auditLineOptions.find((item) => item.value === auditLineFilter);
      chips.push(`Linha: ${option?.label ?? auditLineFilter}`);
    }

    if (auditScheduleFilter === 'none') {
      chips.push('Quadro: sem vínculo');
    } else if (auditScheduleFilter !== 'all') {
      chips.push(`Quadro: ${scheduleFilterLabel(auditScheduleFilter, schedulesById)}`);
    }

    if (auditProfileFilter === 'none') {
      chips.push('Perfil: sem identificação');
    } else if (auditProfileFilter !== 'all') {
      const option = auditProfileOptions.find((item) => item.value === auditProfileFilter);
      chips.push(`Perfil: ${option?.label ?? auditProfileFilter}`);
    }

    return chips;
  }, [
    auditLineFilter,
    auditLineOptions,
    auditOperationFilter,
    auditProfileFilter,
    auditProfileOptions,
    auditScheduleFilter,
    schedulesById,
  ]);

  const handleBaseRunChange = (value: string) => {
    setBaseRunId(value);
    if (value === otherRunId) {
      const fallback = completedRuns.find((run) => String(run.runId) !== value);
      setOtherRunId(fallback ? String(fallback.runId) : '');
    }
  };

  const kpiCards = [
    { title: 'Total de Execuções', value: kpis.totalRuns, subtitle: 'todas as otimizações', icon: <IconTrendingUp size={26} />, color: theme.palette.primary.main },
    { title: 'Execuções Concluídas', value: kpis.completedRuns, subtitle: `${kpis.failedRuns ?? Math.max(kpis.totalRuns - kpis.completedRuns, 0)} falhas/canceladas`, icon: <IconCheckbox size={26} />, color: '#13DEB9' },
    { title: 'Taxa de Sucesso', value: `${isFinite(Number(kpis.successRate)) ? Number(kpis.successRate).toFixed(1) : '0'}%`, subtitle: 'execuções concluídas', icon: <IconTrendingUp size={26} />, color: '#FFAE1F' },
    { title: 'Custo Médio/Execução', value: fmtCurrency(kpis.avgCost), subtitle: 'por execução concluída', icon: <IconCurrencyDollar size={26} />, color: '#FA896B' },
  ];

  return (
    <PageContainer title="Relatórios — OTIMIZ" description="Indicadores e histórico de otimizações">
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={700} lineHeight={1}>Relatórios & KPIs</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Indicadores de desempenho e evolução histórica das otimizações
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Chip
              size="small"
              variant="outlined"
              color={hasActiveRun ? 'warning' : 'default'}
              label={activeRun && 'id' in activeRun && activeRun.id != null
                ? `Ao vivo · run #${String(activeRun.id)} · ${Math.round(syncIntervalMs / 1000)}s`
                : `Sync passivo · ${Math.round(syncIntervalMs / 1000)}s`}
            />
            <Button
              startIcon={<IconRefresh size={18} />}
              onClick={() => void handleRefresh()}
              variant="outlined"
              size="small"
              disabled={kpisQuery.isFetching || historyQuery.isFetching}
            >
              Atualizar
            </Button>
          </Stack>
        </Stack>

        {!errorDismissed && error && <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setErrorDismissed(true)}>{error}</Alert>}

        {/* KPI Cards */}
        <Grid container spacing={3} mb={3}>
          {loadingKpis
            ? [...Array(4)].map((_, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Skeleton variant="rectangular" height={110} sx={{ borderRadius: 2 }} />
                </Grid>
              ))
            : kpiCards.map((c) => (
                <Grid item xs={12} sm={6} md={3} key={c.title}>
                  <KpiCard {...c} />
                </Grid>
              ))}
        </Grid>

        {/* Avg metrics */}
        <Grid container spacing={3} mb={3}>
          {[
            { title: 'Média de Veículos', value: isFinite(Number(kpis.avgVehicles)) ? Number(kpis.avgVehicles).toFixed(1) : '0', subtitle: 'por execução', icon: <IconBus size={26} />, color: theme.palette.primary.main },
            { title: 'Média de Tripulantes', value: isFinite(Number(kpis.avgCrew)) ? Number(kpis.avgCrew).toFixed(1) : '0', subtitle: 'por execução', icon: <IconUsers size={26} />, color: '#13DEB9' },
            { title: 'Duração Média', value: fmtDuration(kpis.avgDurationMs), subtitle: 'tempo de execução', icon: <IconTrendingUp size={26} />, color: '#FFAE1F' },
          ].map((c) => (
            <Grid item xs={12} sm={6} md={4} key={c.title}>
              <KpiCard {...c} />
            </Grid>
          ))}
        </Grid>

        {/* Chart */}
        <DashboardCard
          title="Evolução Histórica"
          action={
            <ToggleButtonGroup
              size="small"
              exclusive
              value={period}
              onChange={(_, v) => { if (v) setPeriod(v as Period); }}
            >
              <ToggleButton value={7}>7d</ToggleButton>
              <ToggleButton value={30}>30d</ToggleButton>
              <ToggleButton value={90}>90d</ToggleButton>
            </ToggleButtonGroup>
          }
        >
          {loadingHistory ? (
            <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1, mt: 1 }} />
          ) : history.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <IconTrendingUp size={40} color={theme.palette.grey[400]} />
              <Typography variant="body2" color="text.secondary" mt={1}>
                Sem dados históricos para o período selecionado.
              </Typography>
            </Box>
          ) : (
            <Chart options={chartOptions} series={series} type="area" height={280} />
          )}
        </DashboardCard>

        <Grid container spacing={3} mt={0.5}>
          <Grid item xs={12} lg={7}>
            <DashboardCard
              title="Benchmark Por Algoritmo"
              subtitle="Ranking histórico combinando sucesso, limpeza operacional e aderência de grupos"
            >
              {loadingHistory ? (
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
              ) : benchmarks.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <IconTrendingUp size={40} color={theme.palette.grey[400]} />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    Ainda não há execuções concluídas suficientes para comparar algoritmos.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={thSx}>Algoritmo</TableCell>
                        <TableCell sx={thSx} align="center">Runs</TableCell>
                        <TableCell sx={thSx} align="center">Score</TableCell>
                        <TableCell sx={thSx} align="right">Sucesso</TableCell>
                        <TableCell sx={thSx} align="right">Limpas</TableCell>
                        <TableCell sx={thSx} align="right">Custo médio</TableCell>
                        <TableCell sx={thSx} align="right">Tempo médio</TableCell>
                        <TableCell sx={thSx} align="right">CCT médio</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {benchmarks.map((row, index) => (
                        <TableRow key={row.algorithm} hover sx={index === 0 ? { bgcolor: `${theme.palette.success.main}10` } : undefined}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>{algorithmLabel(row.algorithm)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.bestRun ? `melhor run ${row.bestRun.label}` : 'sem benchmark concluído'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip size="small" variant="outlined" label={`${row.completedRuns}/${row.runCount}`} />
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight={800} color={index === 0 ? 'success.main' : 'text.primary'}>
                              {fmtPercent(row.operationalScore)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{fmtPercent(row.successRate)}</TableCell>
                          <TableCell align="right">{fmtPercent(row.cleanRunRate)}</TableCell>
                          <TableCell align="right">{fmtCurrency(row.avgCost ?? undefined)}</TableCell>
                          <TableCell align="right">{fmtDuration(row.avgDurationMs ?? undefined)}</TableCell>
                          <TableCell align="right">{fmtAvg(row.avgCctViolations)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DashboardCard>
          </Grid>

          <Grid item xs={12} lg={5}>
            <DashboardCard
              title="Leituras Do Benchmark"
              subtitle={`Líderes do recorte de ${period} dias por custo, qualidade e estabilidade`}
            >
              <Box>
                <Grid container spacing={2}>
                  {benchmarkHighlights.map((item) => (
                    <Grid item xs={12} sm={6} lg={12} key={item.label}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.75,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: `${item.color}33`,
                          bgcolor: `${item.color}10`,
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                            <Typography variant="subtitle1" fontWeight={800}>{item.value}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.subtitle}</Typography>
                          </Box>
                          <Box sx={{ color: item.color }}>{item.icon}</Box>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {!!benchmarks.length && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      Penalidades operacionais médias consideradas no score
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      <Chip size="small" variant="outlined" label={`Alertas soft: ${fmtAvg(benchmarks[0]?.avgSoftIssues)}`} />
                      <Chip size="small" variant="outlined" label={`Sem cobertura: ${fmtAvg(benchmarks[0]?.avgUnassignedTrips)}`} />
                      <Chip size="small" variant="outlined" label={`Aderência: ${fmtRatioPercent(benchmarks[0]?.avgSameRosterRatio)}`} />
                    </Stack>
                  </>
                )}
              </Box>
            </DashboardCard>
          </Grid>

          <Grid item xs={12}>
            <DashboardCard
              title="Auditoria Vs Baseline Operacional"
              subtitle="Cada algoritmo confrontado com a média das execuções concluídas da janela selecionada"
            >
              {loadingHistory ? (
                <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
              ) : !algorithmAudit.rows.length ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <IconShieldCheck size={40} color={theme.palette.grey[400]} />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {hasAuditFilters
                      ? 'Ainda não há dados concluídos suficientes para gerar uma auditoria contra baseline neste recorte.'
                      : 'Ainda não há dados concluídos suficientes para gerar uma auditoria contra baseline.'}
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25}>
                      <TextField
                        select
                        size="small"
                        label="Operação"
                        value={auditOperationFilter}
                        onChange={(event) => setAuditOperationFilter(event.target.value as AuditOperationFilter)}
                        sx={{ minWidth: 220 }}
                      >
                        {(['all', 'urban', 'charter', 'unknown'] as AuditOperationFilter[]).map((value) => (
                          <MenuItem key={value} value={value}>
                            {operationModeLabel(value)}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        size="small"
                        label="Linha"
                        value={auditLineFilter}
                        onChange={(event) => setAuditLineFilter(event.target.value)}
                        sx={{ minWidth: 220 }}
                      >
                        <MenuItem value="all">Todas as linhas</MenuItem>
                        {hasRunsWithoutLine && <MenuItem value="none">Sem linha vinculada</MenuItem>}
                        {auditLineOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {`${option.label} · ${option.runCount} runs`}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        size="small"
                        label="Quadro horário"
                        value={auditScheduleFilter}
                        onChange={(event) => setAuditScheduleFilter(event.target.value as AuditScheduleFilter)}
                        sx={{ minWidth: 260 }}
                      >
                        <MenuItem value="all">Todos os quadros</MenuItem>
                        {hasRunsWithoutSchedule && <MenuItem value="none">Sem quadro vinculado</MenuItem>}
                        {auditScheduleOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {`${option.label} · ${option.runCount} runs`}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        size="small"
                        label="Perfil"
                        value={auditProfileFilter}
                        onChange={(event) => setAuditProfileFilter(event.target.value)}
                        sx={{ minWidth: 260 }}
                      >
                        <MenuItem value="all">Todos os perfis</MenuItem>
                        {hasRunsWithoutProfile && <MenuItem value="none">Sem perfil identificado</MenuItem>}
                        {auditProfileOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {`${option.label} · ${option.runCount} runs`}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      <Chip size="small" variant="outlined" label={`${filteredAuditRunsCount} runs no recorte`} />
                      <Chip size="small" variant="outlined" label={`${baselineSummary.completedRuns} concluídas`} />
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={1.25}>
                    {activeAuditFilterChips.length ? (
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {activeAuditFilterChips.map((label) => (
                          <Chip key={label} size="small" color="primary" variant="outlined" label={label} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Sem recortes adicionais: a auditoria considera toda a janela histórica selecionada.
                      </Typography>
                    )}

                    <Button size="small" variant="text" onClick={clearAuditFilters} disabled={!hasAuditFilters}>
                      Limpar recortes
                    </Button>
                  </Stack>

                  <Grid container spacing={2}>
                    {[
                      { label: 'Sucesso baseline', value: fmtPercent(baselineSummary.successRate), subtitle: `${baselineSummary.completedRuns} concluídas`, icon: <IconCheckbox size={18} />, color: theme.palette.primary.main },
                      { label: 'Custo médio baseline', value: fmtCurrency(baselineSummary.avgCost ?? undefined), subtitle: 'média das concluídas', icon: <IconCurrencyDollar size={18} />, color: '#FA896B' },
                      { label: 'Tempo médio baseline', value: fmtDuration(baselineSummary.avgDurationMs ?? undefined), subtitle: 'execução por run', icon: <IconClockHour4 size={18} />, color: '#FFAE1F' },
                      { label: 'Qualidade baseline', value: fmtPercent(baselineSummary.operationalScore), subtitle: `limpas ${fmtPercent(baselineSummary.cleanRunRate)}`, icon: <IconShieldCheck size={18} />, color: '#13DEB9' },
                    ].map((item) => (
                      <Grid item xs={12} sm={6} lg={3} key={item.label}>
                        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, height: '100%' }}>
                          <Stack direction="row" justifyContent="space-between" gap={2}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                              <Typography variant="subtitle1" fontWeight={800}>{item.value}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.subtitle}</Typography>
                            </Box>
                            <Box sx={{ color: item.color }}>{item.icon}</Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={thSx}>Algoritmo</TableCell>
                          <TableCell sx={thSx} align="center">Status</TableCell>
                          <TableCell sx={thSx} align="right">Δ score</TableCell>
                          <TableCell sx={thSx} align="right">Δ custo</TableCell>
                          <TableCell sx={thSx} align="right">Δ tempo</TableCell>
                          <TableCell sx={thSx} align="right">Δ sucesso</TableCell>
                          <TableCell sx={thSx} align="right">Δ limpas</TableCell>
                          <TableCell sx={thSx} align="right">Δ CCT</TableCell>
                          <TableCell sx={thSx} align="right">Δ aderência</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {algorithmAudit.rows.map((row) => (
                          <TableRow key={`audit-${row.algorithm}`} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>{algorithmLabel(row.algorithm)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {row.bestRun ? `melhor run ${row.bestRun.label}` : `${row.completedRuns}/${row.runCount} concluídas`}
                              </Typography>
                            </TableCell>
                            <TableCell align="center"><BaselineTagChip row={row} /></TableCell>
                            <TableCell align="right">
                              <AuditDeltaChip value={row.operationalScoreGap} formatter={(value) => fmtSignedPercent(value, 1)} />
                            </TableCell>
                            <TableCell align="right">
                              <AuditDeltaChip value={row.costDeltaPct} formatter={(value) => fmtSignedRelativePercent(value, 1)} positiveIsGood={false} />
                            </TableCell>
                            <TableCell align="right">
                              <AuditDeltaChip value={row.durationDeltaPct} formatter={(value) => fmtSignedRelativePercent(value, 1)} positiveIsGood={false} />
                            </TableCell>
                            <TableCell align="right">
                              <AuditDeltaChip value={row.successRateGap} formatter={(value) => fmtSignedPercent(value, 1)} />
                            </TableCell>
                            <TableCell align="right">
                              <AuditDeltaChip value={row.cleanRunRateGap} formatter={(value) => fmtSignedPercent(value, 1)} />
                            </TableCell>
                            <TableCell align="right">
                              <AuditDeltaChip value={row.cctGap} formatter={(value) => fmtSignedPercent(value, 2, '')} positiveIsGood={false} />
                            </TableCell>
                            <TableCell align="right">
                              <AuditDeltaChip value={row.sameRosterGap} formatter={(value) => fmtSignedPercent(value * 100, 1)} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography variant="caption" color="text.secondary">
                    Δ positivos em score, sucesso, limpas e aderência são bons. Δ negativos em custo, tempo e CCT são melhores do que o baseline do período.
                  </Typography>
                </Stack>
              )}
            </DashboardCard>
          </Grid>

          <Grid item xs={12}>
            <DashboardCard
              title="Duelo Entre Execuções"
              subtitle="Comparação direta de custo, restrições e performance entre duas runs concluídas"
            >
              {!completedRuns.length ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <IconShieldCheck size={40} color={theme.palette.grey[400]} />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    Ainda não existem duas execuções concluídas para comparação direta.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
                    <TextField
                      select
                      size="small"
                      label="Execução base"
                      value={baseRunId}
                      onChange={(event) => handleBaseRunChange(event.target.value)}
                      sx={{ minWidth: 240 }}
                    >
                      {completedRuns.map((run) => (
                        <MenuItem key={`base-${run.runId}`} value={String(run.runId)}>
                          {`${run.label} · ${algorithmLabel(run.algorithm)} · ${fmtDate(run.timestamp)}`}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Execução comparada"
                      value={otherRunId}
                      onChange={(event) => setOtherRunId(event.target.value)}
                      sx={{ minWidth: 240 }}
                    >
                      {completedRuns
                        .filter((run) => String(run.runId) !== baseRunId)
                        .map((run) => (
                          <MenuItem key={`other-${run.runId}`} value={String(run.runId)}>
                            {`${run.label} · ${algorithmLabel(run.algorithm)} · ${fmtDate(run.timestamp)}`}
                          </MenuItem>
                        ))}
                    </TextField>
                  </Stack>

                  {comparisonQuery.isFetching && <LinearProgress sx={{ borderRadius: 2 }} />}
                  {comparisonQuery.isError && (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      Não foi possível comparar as execuções selecionadas.
                    </Alert>
                  )}

                  {comparison && (
                    <>
                      <Alert severity={comparison.summary?.betterRunId === Number(baseRunId) ? 'success' : 'info'} sx={{ borderRadius: 2 }}>
                        {comparison.summary?.headline ?? 'Comparação carregada.'}
                      </Alert>

                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        <Chip size="small" variant="outlined" label={`Base: ${algorithmLabel(comparison.algorithms?.base ?? 'base')}`} />
                        <Chip size="small" variant="outlined" label={`Comparada: ${algorithmLabel(comparison.algorithms?.other ?? 'other')}`} />
                        {comparison.summary?.betterRunId != null && (
                          <Chip
                            size="small"
                            color="primary"
                            label={`Melhor execução: #${String(comparison.summary.betterRunId).padStart(4, '0')}`}
                          />
                        )}
                      </Stack>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={8}>
                          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={thSx}>Indicador</TableCell>
                                  <TableCell sx={thSx} align="right">Base</TableCell>
                                  <TableCell sx={thSx} align="right">Comparada</TableCell>
                                  <TableCell sx={thSx} align="right">Delta</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {metricsEntries.map(([key, metric]) => (
                                  <TableRow key={key}>
                                    <TableCell>{COMPARISON_LABELS[key] ?? labelizeKey(key)}</TableCell>
                                    <TableCell align="right">{formatComparisonValue(key, metric.base)}</TableCell>
                                    <TableCell align="right">{formatComparisonValue(key, metric.other)}</TableCell>
                                    <TableCell align="right"><ComparisonDeltaCell metric={metric} metricKey={key} /></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>

                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
                            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Integridade do replay</Typography>
                            <Stack spacing={1.25}>
                              <Box display="flex" justifyContent="space-between" gap={2}>
                                <Typography variant="caption" color="text.secondary">Mesmo input hash</Typography>
                                <Chip size="small" color={comparison.reproducibility?.sameInputHash ? 'success' : 'warning'} label={comparison.reproducibility?.sameInputHash ? 'Sim' : 'Não'} />
                              </Box>
                              <Box display="flex" justifyContent="space-between" gap={2}>
                                <Typography variant="caption" color="text.secondary">Mesmo params hash</Typography>
                                <Chip size="small" color={comparison.reproducibility?.sameParamsHash ? 'success' : 'warning'} label={comparison.reproducibility?.sameParamsHash ? 'Sim' : 'Não'} />
                              </Box>
                              <Box display="flex" justifyContent="space-between" gap={2}>
                                <Typography variant="caption" color="text.secondary">Mesmo budget</Typography>
                                <Chip size="small" color={comparison.reproducibility?.sameTimeBudget ? 'success' : 'warning'} label={comparison.reproducibility?.sameTimeBudget ? 'Sim' : 'Não'} />
                              </Box>
                              <Divider />
                              <Box display="flex" justifyContent="space-between" gap={2}>
                                <Typography variant="caption" color="text.secondary">Input base</Typography>
                                <Typography variant="body2" fontWeight={700}>{comparison.reproducibility?.base?.inputHash ?? '—'}</Typography>
                              </Box>
                              <Box display="flex" justifyContent="space-between" gap={2}>
                                <Typography variant="caption" color="text.secondary">Input comparada</Typography>
                                <Typography variant="body2" fontWeight={700}>{comparison.reproducibility?.other?.inputHash ?? '—'}</Typography>
                              </Box>
                            </Stack>
                          </Paper>
                        </Grid>

                        {!!performanceEntries.length && (
                          <Grid item xs={12}>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={thSx}>Timing</TableCell>
                                    <TableCell sx={thSx} align="right">Base</TableCell>
                                    <TableCell sx={thSx} align="right">Comparada</TableCell>
                                    <TableCell sx={thSx} align="right">Delta</TableCell>
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
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Grid>
                        )}
                      </Grid>

                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          Para diff completo de parâmetros e settings snapshot, use a aba Auditoria no cockpit da execução.
                        </Typography>
                        <Stack direction="row" gap={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<IconDownload size={15} />}
                            onClick={() => downloadComparisonCsv(comparison, baseRunId, otherRunId)}
                          >
                            CSV
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<IconDownload size={15} />}
                            onClick={() => downloadComparisonJson(comparison, baseRunId, otherRunId)}
                          >
                            JSON
                          </Button>
                        </Stack>
                      </Stack>
                    </>
                  )}
                </Stack>
              )}
            </DashboardCard>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
}

export default function ReportsPage() {
  return (
    <NotifyProvider>
      <ReportsInner />
    </NotifyProvider>
  );
}
