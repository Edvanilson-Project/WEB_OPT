'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDebounce } from '@/utils/useDebounce';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  IconAlertTriangle,
  IconBrain,
  IconBus,
  IconClockHour4,
  IconCurrencyDollar,
  IconExternalLink,
  IconFilter,
  IconMapPin,
  IconPlayerPlay,
  IconRefresh,
  IconRoute,
  IconShieldCheck,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import KpiCard from '../_components/KpiCard';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider } from '../_components/Notify';
import { getSessionUser } from '@/lib/api';
import {
  fmtCurrency as fmtCurrencyBase,
  fmtDateTimeShort,
  fmtDayMonth,
  fmtDurationMs,
  fmtNumber as fmtNumberBase,
  fmtPercent as fmtPercentBase,
} from '@/lib/format';
import {
  useOptimizationDashboard,
  useOptimizationHistory,
  useOptimizationKpis,
  useOptimizationLiveSync,
} from '@/lib/query-hooks';
import {
  buildHistoricalSummary,
  buildHistoryPoints,
  normalizeDashboardStats,
  normalizeKpiData,
  normalizeOptimizationRuns,
  type DashboardStatsSnapshot,
  type DistributionItem,
  type HistoricalRunPoint,
  type KpiSnapshot,
} from '../_helpers/run-history';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Period = 7 | 30 | 90;

// Thin wrappers locais: preservam a preferência visual do dashboard
// (moeda sem decimais, números com 1 casa) reutilizando a fonte única
// de verdade em @/lib/format. Nenhuma lógica de formatação nasce aqui.
const fmtDuration = fmtDurationMs;
const fmtDate = fmtDateTimeShort;
const fmtShortDate = fmtDayMonth;
const fmtCurrency = (value?: number | null) =>
  fmtCurrencyBase(value, { maxFractionDigits: 0 });
const fmtPercent = (value?: number | null, digits = 0) => fmtPercentBase(value, digits);
const fmtNumber = (value?: number | null, digits = 1) =>
  fmtNumberBase(value, { maxFractionDigits: digits, minFractionDigits: digits });

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

function QualityChip({ run }: { run: HistoricalRunPoint }) {
  if (run.unassignedTrips > 0) {
    return <Chip size="small" color="error" variant="outlined" label={`${run.unassignedTrips} sem cobertura`} />;
  }
  if (run.cctViolations > 0) {
    return <Chip size="small" color="error" label={`${run.cctViolations} CCT`} />;
  }
  if (run.softIssues > 0) {
    return <Chip size="small" color="warning" label={`${run.softIssues} alertas`} />;
  }
  return <Chip size="small" color="success" label="Limpa" />;
}

function RunsTable({ runs, loading }: { runs: HistoricalRunPoint[]; loading: boolean }) {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [algoFilter, setAlgoFilter] = React.useState('all');
  const [searchFilter, setSearchFilter] = React.useState('');
  const debouncedSearchFilter = useDebounce(searchFilter, 300);

  const algorithmOptions = Array.from(new Set(runs.map((run) => run.algorithm))).sort((left, right) => left.localeCompare(right));
  const filteredRuns = runs
    .slice()
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .filter((run) => {
      if (statusFilter !== 'all' && run.status !== statusFilter) return false;
      if (algoFilter !== 'all' && run.algorithm !== algoFilter) return false;
      if (!debouncedSearchFilter) return true;

      const search = debouncedSearchFilter.toLowerCase();
      return (
        run.label.toLowerCase().includes(search) ||
        (run.name ?? '').toLowerCase().includes(search) ||
        (ALGO_LABEL[run.algorithm] ?? run.algorithm).toLowerCase().includes(search)
      );
    });

  if (loading) {
    return (
      <Box>
        {[...Array(6)].map((_, index) => (
          <Skeleton key={index} variant="rectangular" height={46} sx={{ mb: 0.75, borderRadius: 1.5 }} />
        ))}
      </Box>
    );
  }

  if (!runs.length) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <IconBrain size={40} color={theme.palette.grey[400]} />
        <Typography variant="body2" color="text.secondary" mt={1}>
          Ainda não há execuções suficientes para compor o histórico.
        </Typography>
        <Button
          component={Link}
          href="/otimiz/optimization"
          variant="contained"
          size="small"
          sx={{ mt: 2 }}
          startIcon={<IconPlayerPlay size={16} />}
        >
          Abrir cockpit
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Buscar execução, nome ou algoritmo..."
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconFilter size={14} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(event) => setStatusFilter(event.target.value)}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="completed">Concluídas</MenuItem>
            <MenuItem value="running">Executando</MenuItem>
            <MenuItem value="failed">Falhas</MenuItem>
            <MenuItem value="pending">Pendentes</MenuItem>
            <MenuItem value="cancelled">Canceladas</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Algoritmo</InputLabel>
          <Select value={algoFilter} label="Algoritmo" onChange={(event) => setAlgoFilter(event.target.value)}>
            <MenuItem value="all">Todos</MenuItem>
            {algorithmOptions.map((algorithm) => (
              <MenuItem key={algorithm} value={algorithm}>
                {ALGO_LABEL[algorithm] ?? algorithm}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip size="small" variant="outlined" label={`${filteredRuns.length} de ${runs.length}`} sx={{ alignSelf: 'center', fontWeight: 700 }} />
      </Stack>

      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Execução</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Algoritmo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Veículos</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tripulação</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Custo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tempo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Qualidade</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRuns.map((run) => (
              <TableRow key={`${run.runId}-${run.timestamp}`} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{run.label}</Typography>
                  {run.name && <Typography variant="caption" color="text.secondary" display="block">{run.name}</Typography>}
                  <Typography variant="caption" color="text.secondary">{fmtDate(run.timestamp)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{ALGO_LABEL[run.algorithm] ?? run.algorithm}</Typography>
                </TableCell>
                <TableCell align="center"><Typography variant="body2" fontWeight={700}>{run.totalVehicles || '–'}</Typography></TableCell>
                <TableCell align="center"><Typography variant="body2" fontWeight={700}>{run.totalCrew || '–'}</Typography></TableCell>
                <TableCell align="right"><Typography variant="body2">{fmtCurrency(run.totalCost)}</Typography></TableCell>
                <TableCell align="center"><Typography variant="caption" color="text.secondary">{fmtDuration(run.durationMs)}</Typography></TableCell>
                <TableCell align="center"><QualityChip run={run} /></TableCell>
                <TableCell align="center"><StatusChip type="opt" value={run.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function HistoryChart({ points, loading }: { points: HistoricalRunPoint[]; loading: boolean }) {
  const theme = useTheme();
  const completedRuns = points.filter((point) => point.status === 'completed');

  if (loading) return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />;
  if (!completedRuns.length) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <IconClockHour4 size={40} color={theme.palette.grey[400]} />
        <Typography variant="body2" color="text.secondary" mt={1}>
          Sem execuções concluídas suficientes para desenhar a série histórica.
        </Typography>
      </Box>
    );
  }

  const labels = completedRuns.map((point) => fmtShortDate(point.timestamp));
  const series: ApexAxisChartSeries = [
    { name: 'Veículos', type: 'area', data: completedRuns.map((point) => point.totalVehicles) },
    { name: 'Tripulação', type: 'area', data: completedRuns.map((point) => point.totalCrew) },
    { name: 'Custo (R$ mil)', type: 'line', data: completedRuns.map((point) => Number((point.totalCost / 1000).toFixed(1))) },
  ];

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      fontFamily: theme.typography.fontFamily,
      animations: { easing: 'easeinout', speed: 450 },
    },
    colors: [theme.palette.primary.main, '#13DEB9', '#FA896B'],
    stroke: { curve: 'smooth', width: [2, 2, 3] },
    fill: {
      type: ['gradient', 'gradient', 'solid'],
      gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02, stops: [0, 100] },
    },
    dataLabels: { enabled: false },
    legend: { position: 'top', horizontalAlign: 'left' },
    grid: { borderColor: theme.palette.divider, strokeDashArray: 4 },
    xaxis: {
      categories: labels,
      labels: { style: { colors: theme.palette.text.secondary as string, fontSize: '12px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      {
        title: { text: 'Recursos' },
        labels: { style: { colors: theme.palette.text.secondary as string } },
      },
      {
        opposite: true,
        title: { text: 'Custo (R$ mil)' },
        labels: { style: { colors: theme.palette.text.secondary as string } },
      },
    ],
    tooltip: {
      theme: theme.palette.mode,
      shared: true,
      x: {
        formatter: (_value, context) => {
          const point = completedRuns[context.dataPointIndex];
          return point ? `${point.label} • ${fmtDate(point.timestamp)}` : String(_value);
        },
      },
    },
  };

  return <Chart options={options} series={series} type="line" height={320} />;
}

function DistributionChart({ items, loading }: { items: DistributionItem[]; loading: boolean }) {
  const theme = useTheme();

  if (loading) return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />;
  if (!items.length) {
    return (
      <Box sx={{ py: 7, textAlign: 'center' }}>
        <IconBrain size={36} color={theme.palette.grey[400]} />
        <Typography variant="body2" color="text.secondary" mt={1}>
          O mix de algoritmos aparece assim que houver histórico concluído na janela.
        </Typography>
      </Box>
    );
  }

  const options: ApexCharts.ApexOptions = {
    chart: { type: 'donut', toolbar: { show: false } },
    labels: items.map((item) => item.label),
    legend: { position: 'bottom' },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    colors: [theme.palette.primary.main, '#13DEB9', '#FFAE1F', '#FA896B', theme.palette.info.main],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Execuções',
              formatter: () => String(items.reduce((sum, item) => sum + item.value, 0)),
            },
          },
        },
      },
    },
    tooltip: {
      theme: theme.palette.mode,
      y: { formatter: (value) => `${value} exec.` },
    },
  };

  return <Chart options={options} series={items.map((item) => item.value)} type="donut" height={280} />;
}

function DashboardInner() {
  const theme = useTheme();
  const companyId = getSessionUser()?.companyId ?? 1;
  const [period, setPeriod] = useState<Period>(30);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const {
    activeRun,
    hasActiveRun,
    refetch: refetchRuns,
    syncIntervalMs,
  } = useOptimizationLiveSync<HistoricalRunPoint & { id?: number }>(companyId, {
    invalidateRelated: true,
    idleIntervalMs: 30_000,
    liveIntervalMs: 5_000,
  });
  const dashboardQuery = useOptimizationDashboard(companyId);
  const kpisQuery = useOptimizationKpis(companyId);
  const historyQuery = useOptimizationHistory(companyId, period);

  const stats: DashboardStatsSnapshot = useMemo(
    () => normalizeDashboardStats(dashboardQuery.data),
    [dashboardQuery.data],
  );
  const kpis: KpiSnapshot = useMemo(
    () => normalizeKpiData(kpisQuery.data),
    [kpisQuery.data],
  );
  const historyPoints: HistoricalRunPoint[] = useMemo(() => {
    if (historyQuery.data != null) {
      return buildHistoryPoints(normalizeOptimizationRuns(historyQuery.data));
    }

    return buildHistoryPoints(stats.recentRuns);
  }, [historyQuery.data, stats.recentRuns]);
  const loading = dashboardQuery.isLoading || kpisQuery.isLoading || historyQuery.isLoading;
  const refreshing = dashboardQuery.isFetching || kpisQuery.isFetching || historyQuery.isFetching;

  const summary = useMemo(() => buildHistoricalSummary(historyPoints), [historyPoints]);
  const lastOptimization = useMemo(() => {
    if (stats.lastOptimization) return stats.lastOptimization;
    if (kpis.lastOptimization) return kpis.lastOptimization;

    const latestCompleted = historyPoints.slice().reverse().find((point) => point.status === 'completed');
    return latestCompleted
      ? {
          id: latestCompleted.runId,
          date: latestCompleted.timestamp,
          vehicles: latestCompleted.totalVehicles,
          crew: latestCompleted.totalCrew,
          cost: latestCompleted.totalCost,
          cctViolations: latestCompleted.cctViolations,
        }
      : null;
  }, [historyPoints, kpis.lastOptimization, stats.lastOptimization]);

  const error = useMemo(() => {
    const loadedSomething =
      dashboardQuery.data != null ||
      kpisQuery.data != null ||
      historyQuery.data != null;

    if (!loadedSomething && (dashboardQuery.isError || kpisQuery.isError || historyQuery.isError)) {
      return 'Falha ao carregar o dashboard. Verifique backend e autenticação.';
    }

    if (historyQuery.isError && stats.recentRuns.length > 0) {
      return 'Histórico detalhado indisponível no momento; exibindo o resumo recente do backend.';
    }

    return '';
  }, [dashboardQuery.data, dashboardQuery.isError, historyQuery.data, historyQuery.isError, kpisQuery.data, kpisQuery.isError, stats.recentRuns.length]);

  useEffect(() => {
    setErrorDismissed(false);
  }, [error, period]);

  const historySubtitle = period === 7
    ? 'Recorte curto para detectar desvios recentes.'
    : period === 30
      ? 'Janela mensal para leitura de tendência operacional.'
      : 'Sinal de estabilidade em horizonte trimestral.';

  const baseChips = [
    { label: `${stats.totalLines || 0} linhas`, icon: <IconRoute size={14} /> },
    { label: `${stats.totalTerminals || 0} terminais`, icon: <IconMapPin size={14} /> },
    { label: `${stats.totalVehicleTypes || 0} tipos de frota`, icon: <IconBus size={14} /> },
    { label: `${stats.totalOptimizationRuns || kpis.totalRuns || 0} execuções totais`, icon: <IconBrain size={14} /> },
  ];

  const signalCards = [
    {
      label: 'Execuções limpas',
      value: fmtPercent(summary.cleanRunRate),
      badge: summary.cleanRunRate != null && summary.cleanRunRate >= 80 ? 'estável' : 'atenção',
      color: summary.cleanRunRate != null && summary.cleanRunRate >= 80 ? theme.palette.success.main : theme.palette.warning.main,
    },
    {
      label: 'CCT médio por execução',
      value: fmtNumber(summary.avgCctViolations),
      badge: summary.avgCctViolations != null && summary.avgCctViolations <= 0.2 ? 'controlado' : 'revisar',
      color: summary.avgCctViolations != null && summary.avgCctViolations <= 0.2 ? theme.palette.success.main : theme.palette.error.main,
    },
    {
      label: 'Alertas soft médios',
      value: fmtNumber(summary.avgSoftIssues),
      badge: summary.avgSoftIssues != null && summary.avgSoftIssues <= 1 ? 'baixo ruído' : 'acima do ideal',
      color: summary.avgSoftIssues != null && summary.avgSoftIssues <= 1 ? theme.palette.success.main : theme.palette.warning.main,
    },
    {
      label: 'Aderência de grupos',
      value: summary.avgSameRosterRatio != null ? fmtPercent(summary.avgSameRosterRatio * 100, 1) : '–',
      badge: summary.avgSameRosterRatio != null && summary.avgSameRosterRatio >= 0.95 ? 'consistente' : 'oscila',
      color: summary.avgSameRosterRatio != null && summary.avgSameRosterRatio >= 0.95 ? theme.palette.success.main : theme.palette.warning.main,
    },
  ];

  const kpiCards = [
    {
      title: `Taxa de Sucesso (${period}d)`,
      value: fmtPercent(summary.successRate),
      subtitle: `${summary.totalRuns} execuções observadas na janela`,
      icon: <IconShieldCheck size={26} />,
      color: theme.palette.primary.main,
      trend: summary.trends.successRate,
    },
    {
      title: 'Custo Médio Concluído',
      value: fmtCurrency(summary.avgCost),
      subtitle: summary.bestCostRun ? `melhor custo em ${summary.bestCostRun.label}` : 'aguardando base histórica',
      icon: <IconCurrencyDollar size={26} />,
      color: '#FA896B',
      trend: summary.trends.avgCost,
    },
    {
      title: 'Tempo Médio de Execução',
      value: fmtDuration(summary.avgDurationMs ?? kpis.avgDurationMs),
      subtitle: `${summary.completedRuns} execuções concluídas na janela`,
      icon: <IconClockHour4 size={26} />,
      color: '#13DEB9',
      trend: summary.trends.avgDurationMs,
    },
    {
      title: 'Execuções Sem Alertas',
      value: fmtPercent(summary.cleanRunRate),
      subtitle: `${summary.failedRuns} falhas e ${summary.completedRuns} concluídas`,
      icon: <IconAlertTriangle size={26} />,
      color: '#FFAE1F',
      trend: summary.trends.cleanRunRate,
    },
  ];

  const handleRefresh = async () => {
    setErrorDismissed(false);
    await Promise.all([
      refetchRuns(),
      dashboardQuery.refetch(),
      kpisQuery.refetch(),
      historyQuery.refetch(),
    ]);
  };

  return (
    <PageContainer title="Dashboard — OTIMIZ" description="KPIs históricos e saúde operacional da otimização">
      <Box>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} mb={3} gap={2}>
          <Box>
            <Typography variant="h4" fontWeight={800} lineHeight={1}>Painel de Controle</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.75}>
              KPIs históricos, saúde operacional e leitura rápida das últimas execuções do motor VSP+CSP.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} mt={2}>
              {baseChips.map((chip) => (
                <Chip key={chip.label} icon={chip.icon} size="small" variant="outlined" label={chip.label} />
              ))}
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Chip
              size="small"
              variant="outlined"
              color={hasActiveRun ? 'warning' : 'default'}
              label={activeRun?.id != null
                ? `Ao vivo · run #${activeRun.id} · ${Math.round(syncIntervalMs / 1000)}s`
                : `Sync passivo · ${Math.round(syncIntervalMs / 1000)}s`}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={period}
              onChange={(_event, value) => { if (value) setPeriod(value as Period); }}
            >
              <ToggleButton value={7}>7d</ToggleButton>
              <ToggleButton value={30}>30d</ToggleButton>
              <ToggleButton value={90}>90d</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Atualizar dados">
              <IconButton onClick={() => void handleRefresh()} disabled={refreshing} size="small">
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<IconPlayerPlay size={18} />} onClick={() => { window.location.href = '/otimiz/optimization'; }} disabled={loading} sx={{ borderRadius: 2.5 }}>
              Nova Otimização
            </Button>
          </Stack>
        </Stack>

        {!errorDismissed && error && <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setErrorDismissed(true)}>{error}</Alert>}

        <Grid container spacing={3} mb={3}>
          {kpiCards.map((card) => (
            <Grid item xs={12} sm={6} xl={3} key={card.title}>
              <KpiCard {...card} loading={loading} trendLabel={`vs metade anterior (${period}d)`} />
            </Grid>
          ))}
        </Grid>

        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: 2.5,
            mb: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.035),
          }}
        >
          <Stack direction={{ xs: 'column', xl: 'row' }} gap={3} justifyContent="space-between">
            <Box flex={1}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="subtitle1" fontWeight={800}>Última otimização concluída</Typography>
                {lastOptimization?.id != null && <Chip size="small" color="primary" variant="outlined" label={`#${String(lastOptimization.id).padStart(4, '0')}`} />}
                {lastOptimization?.date && <Chip size="small" variant="outlined" label={fmtDate(lastOptimization.date)} />}
              </Stack>
              <Typography variant="body2" color="text.secondary" mt={0.75}>
                Fotografia do último resultado concluído combinada com os sinais médios da janela histórica selecionada.
              </Typography>

              <Grid container spacing={2} mt={0.75}>
                {[
                  { label: 'Veículos utilizados', value: lastOptimization?.vehicles ?? null, icon: <IconBus size={18} />, color: theme.palette.primary.main },
                  { label: 'Tripulantes escalados', value: lastOptimization?.crew ?? null, icon: <IconUsers size={18} />, color: '#13DEB9' },
                  { label: 'Custo operacional', value: fmtCurrency(lastOptimization?.cost), icon: <IconCurrencyDollar size={18} />, color: '#FA896B' },
                  {
                    label: 'Violações CCT',
                    value: lastOptimization?.cctViolations != null ? String(lastOptimization.cctViolations) : '–',
                    icon: <IconShieldCheck size={18} />,
                    color: lastOptimization?.cctViolations ? theme.palette.error.main : theme.palette.success.main,
                  },
                ].map((item) => (
                  <Grid item xs={6} md={3} key={item.label}>
                    <Paper elevation={0} sx={{ height: '100%', borderRadius: 2, p: 1.75, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                      <Stack direction="row" alignItems="center" gap={1.25}>
                        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: alpha(item.color, 0.12), color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.icon}
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                          <Typography variant="subtitle1" fontWeight={800}>{item.value ?? '–'}</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Box sx={{ minWidth: { xl: 320 }, width: '100%' }}>
              <Typography variant="subtitle2" fontWeight={800} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
                Sinais do período
              </Typography>
              <Stack gap={1.25} mt={1.5}>
                {signalCards.map((signal) => (
                  <Paper
                    key={signal.label}
                    elevation={0}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(signal.color, 0.22),
                      bgcolor: alpha(signal.color, 0.08),
                      p: 1.5,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">{signal.label}</Typography>
                        <Typography variant="subtitle1" fontWeight={800}>{signal.value}</Typography>
                      </Box>
                      <Chip size="small" label={signal.badge} sx={{ bgcolor: alpha(signal.color, 0.12), color: signal.color, fontWeight: 700 }} />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <DashboardCard
              title={`Evolução histórica (${period}d)`}
              subtitle={historySubtitle}
              action={
                <Button component={Link} href="/otimiz/reports" size="small" endIcon={<IconExternalLink size={14} />}>
                  Relatórios
                </Button>
              }
            >
              <HistoryChart points={historyPoints} loading={loading} />
            </DashboardCard>
          </Grid>

          <Grid item xs={12} lg={4}>
            <DashboardCard title="Mix de algoritmos" subtitle="Distribuição das execuções concluídas na janela">
              <Box>
                <DistributionChart
                  items={summary.algorithmDistribution.map((item) => ({
                    ...item,
                    label: ALGO_LABEL[item.label] ?? item.label,
                  }))}
                  loading={loading}
                />

                {!loading && summary.statusDistribution.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      Status na janela
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {summary.statusDistribution.map((item) => (
                        <Chip key={item.label} size="small" variant="outlined" label={`${item.label}: ${item.value}`} />
                      ))}
                    </Stack>
                  </>
                )}
              </Box>
            </DashboardCard>
          </Grid>

          <Grid item xs={12}>
            <DashboardCard
              title="Execuções recentes"
              subtitle="Histórico navegável com foco em qualidade operacional"
              action={
                <Button component={Link} href="/otimiz/optimization" size="small" endIcon={<IconExternalLink size={14} />}>
                  Abrir cockpit
                </Button>
              }
            >
              <RunsTable runs={historyPoints} loading={loading} />
            </DashboardCard>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
}

export default function DashboardPage() {
  return (
    <NotifyProvider>
      <DashboardInner />
    </NotifyProvider>
  );
}
