'use client';
import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useDebounce } from '@/utils/useDebounce';
import {
  Grid,
  Box,
  Typography,
  Button,
  Paper,
  TableContainer,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  InputAdornment,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Skeleton,
  Alert,
  Stack,
  Divider,
  Tooltip,
  IconButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  IconRoute,
  IconMapPin,
  IconBus,
  IconBrain,
  IconRefresh,
  IconPlayerPlay,
  IconExternalLink,
  IconClockHour4,
  IconCurrencyDollar,
  IconUsers,
  IconFilter,
  IconChartBar,
} from '@tabler/icons-react';
import Link from 'next/link';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import KpiCard from '../_components/KpiCard';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { optimizationApi, reportsApi, getSessionUser } from '@/lib/api';
import type { OptimizationRun, DashboardStats, KpiData } from '../_types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

function fmtDuration(ms?: number): string {
  if (!ms) return '–';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtCurrency(val?: number): string {
  if (val == null) return '–';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

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

function RunsTable({ runs, loading }: { runs: OptimizationRun[]; loading: boolean }) {
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [algoFilter, setAlgoFilter] = React.useState('all');
  const [searchFilter, setSearchFilter] = React.useState('');
  const debouncedSearchFilter = useDebounce(searchFilter, 300);
  
  const filtered = runs.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (algoFilter !== 'all' && r.algorithm !== algoFilter) return false;
    if (debouncedSearchFilter && !String(r.id).includes(debouncedSearchFilter) && !(r.name ?? '').toLowerCase().includes(debouncedSearchFilter.toLowerCase())) return false;
    return true;
  });

  const theme = useTheme();
  if (loading) {
    return (
      <Box>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 0.5, borderRadius: 1 }} />
        ))}
      </Box>
    );
  }
  if (runs.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <IconBrain size={40} color={theme.palette.grey[400]} />
        <Typography variant="body2" color="text.secondary" mt={1}>
          Nenhuma execução ainda. Execute a primeira otimização!
        </Typography>
        <Button
          component={Link}
          href="/otimiz/optimization"
          variant="contained"
          size="small"
          sx={{ mt: 2 }}
          startIcon={<IconPlayerPlay size={16} />}
        >
          Iniciar Otimização
        </Button>
      </Box>
    );
  }
  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} mb={2} flexWrap="wrap">
        <TextField size="small" placeholder="Buscar por ID ou nome..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><IconFilter size={14} /></InputAdornment> }} sx={{ minWidth: 180, flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="completed">Concluído</MenuItem>
            <MenuItem value="running">Executando</MenuItem>
            <MenuItem value="failed">Falhou</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Algoritmo</InputLabel>
          <Select value={algoFilter} label="Algoritmo" onChange={e => setAlgoFilter(e.target.value)}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="hybrid_pipeline">Pipeline Híbrido</MenuItem>
            <MenuItem value="greedy">Heurístico</MenuItem>
            <MenuItem value="simulated_annealing">Simulated Annealing</MenuItem>
            <MenuItem value="tabu_search">Tabu Search</MenuItem>
            <MenuItem value="joint_solver">Joint Solver</MenuItem>
          </Select>
        </FormControl>
        <Chip size="small" variant="outlined" label={`${filtered.length} de ${runs.length}`} sx={{ alignSelf: 'center', fontWeight: 600 }} />
      </Stack>
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Algoritmo</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Veículos</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Tripulantes</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Custo</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Tempo</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((run) => (
            <TableRow key={run.id} hover>
              <TableCell>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    #{String(run.id).padStart(4, '0')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(run.createdAt)}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{ALGO_LABEL[run.algorithm] ?? run.algorithm}</Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2" fontWeight={600}>{run.totalVehicles ?? '–'}</Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2" fontWeight={600}>{run.totalCrew ?? '–'}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{fmtCurrency(run.totalCost)}</Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" color="text.secondary">
                  {fmtDuration(run.durationMs)}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <StatusChip type="opt" value={run.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    </Box>
  );
}

function HistoryChart({ runs, loading }: { runs: OptimizationRun[]; loading: boolean }) {
  const theme = useTheme();
  const completed = runs.filter((r) => r.status === 'completed' && r.totalVehicles != null).slice(0, 10).reverse();
  const labels = completed.map((r) => `#${r.id}`);
  const vehicles = completed.map((r) => r.totalVehicles ?? 0);
  const crew = completed.map((r) => r.totalCrew ?? 0);

  const options: ApexCharts.ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: theme.typography.fontFamily, sparkline: { enabled: false } },
    colors: [theme.palette.primary.main, '#13DEB9'],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.0, stops: [0, 100] } },
    stroke: { curve: 'smooth', width: 2.5 },
    xaxis: {
      categories: labels.length > 0 ? labels : ['–'],
      labels: { style: { colors: theme.palette.text.secondary as string, fontSize: '12px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: theme.palette.text.secondary as string } } },
    dataLabels: { enabled: false },
    legend: { position: 'top', horizontalAlign: 'right' },
    tooltip: { theme: theme.palette.mode },
    grid: { borderColor: theme.palette.divider, strokeDashArray: 4 },
  };
  const series = [
    { name: 'Veículos', data: vehicles.length > 0 ? vehicles : [0] },
    { name: 'Tripulantes', data: crew.length > 0 ? crew : [0] },
  ];
  if (loading) return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />;
  return <Chart options={options} series={series} type="area" height={220} />;
}

function DashboardInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [stats, setStats] = useState<Partial<DashboardStats>>({});
  const [kpis, setKpis] = useState<Partial<KpiData>>({});
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [firing, setFiring] = useState(false);
  const companyId = getSessionUser()?.companyId ?? 1;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, kpiData] = await Promise.allSettled([
        optimizationApi.getDashboard(companyId),
        reportsApi.getKpis(companyId),
      ]);
      if (dash.status === 'fulfilled' && dash.value) {
        const d = dash.value as DashboardStats;
        setStats(d);
        setRuns(d.recentRuns ?? []);
      }
      if (kpiData.status === 'fulfilled' && kpiData.value) {
        setKpis(kpiData.value as KpiData);
      }
    } catch {
      setError('Falha ao carregar dados. Verifique se o backend está online.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const handleQuickRun = () => {
    window.location.href = '/otimiz/optimization';
  };

  const kpiCards = [
    { title: 'Linhas Ativas', value: loading ? '–' : (stats.totalLines ?? 0), subtitle: 'rotas cadastradas', icon: <IconRoute size={26} />, color: theme.palette.primary.main },
    { title: 'Terminais', value: loading ? '–' : (stats.totalTerminals ?? 0), subtitle: 'pontos e garagens', icon: <IconMapPin size={26} />, color: '#13DEB9' },
    { title: 'Tipos de Veículo', value: loading ? '–' : (stats.totalVehicleTypes ?? 0), subtitle: 'frotas configuradas', icon: <IconBus size={26} />, color: '#FFAE1F' },
    { title: 'Otimizações', value: loading ? '–' : (stats.totalOptimizationRuns ?? 0), subtitle: `taxa de sucesso ${kpis.successRate != null && isFinite(Number(kpis.successRate)) ? Number(kpis.successRate).toFixed(0) + '%' : '–'}`, icon: <IconBrain size={26} />, color: '#FA896B' },
  ];

  return (
    <PageContainer title="Dashboard — OTIMIZ" description="Painel de controle OTIMIZ">
      <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Painel de Controle</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Visão geral do sistema de otimização de transporte</Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Atualizar dados">
            <IconButton onClick={load} disabled={loading} size="small">
              <IconRefresh size={18} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<IconPlayerPlay size={18} />} onClick={handleQuickRun} disabled={loading} sx={{ borderRadius: 2 }}>
            Nova Otimização
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>
      )}

      <Grid container spacing={3} mb={3}>
        {kpiCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <KpiCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {!loading && (stats.lastRunVehicles != null || stats.lastRunCrew != null) && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={600}>Resultado da Última Otimização</Typography>
            {stats.lastRunAt && (
              <Typography variant="caption" color="text.secondary">{fmtDate(stats.lastRunAt)}</Typography>
            )}
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={2}>
            {[
              { label: 'Veículos utilizados', value: stats.lastRunVehicles ?? '–', icon: <IconBus size={20} />, color: theme.palette.primary.main },
              { label: 'Tripulantes escalados', value: stats.lastRunCrew ?? '–', icon: <IconUsers size={20} />, color: '#13DEB9' },
              { label: 'Custo operacional', value: fmtCurrency(stats.lastRunCost), icon: <IconCurrencyDollar size={20} />, color: '#FFAE1F' },
              { label: 'Tempo médio', value: kpis.avgDurationMs ? fmtDuration(kpis.avgDurationMs) : '–', icon: <IconClockHour4 size={20} />, color: '#FA896B' },
            ].map((item) => (
              <Grid item xs={6} md={3} key={item.label}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Box sx={{ color: item.color }}>{item.icon}</Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                    <Typography variant="subtitle1" fontWeight={700}>{item.value}</Typography>
                  </Box>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <DashboardCard title="Evolução das Otimizações" subtitle="Veículos e tripulantes por execução">
            <HistoryChart runs={runs} loading={loading} />
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={7}>
          <DashboardCard
            title="Execuções Recentes"
            action={
              <Button component={Link} href="/otimiz/optimization" size="small" endIcon={<IconExternalLink size={14} />}>
                Ver todas
              </Button>
            }
          >
            <RunsTable runs={runs} loading={loading} />
          </DashboardCard>
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mt: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" mb={2} fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
          Acesso Rápido
        </Typography>
        <Grid container spacing={1.5}>
          {[
            { label: 'Linhas', href: '/otimiz/lines', icon: <IconRoute size={18} />, color: theme.palette.primary.main },
            { label: 'Terminais', href: '/otimiz/terminals', icon: <IconMapPin size={18} />, color: '#13DEB9' },
            { label: 'Frota', href: '/otimiz/vehicles', icon: <IconBus size={18} />, color: '#FFAE1F' },
            { label: 'Motor de Otimização', href: '/otimiz/optimization', icon: <IconBrain size={18} />, color: '#FA896B' },
            { label: 'Relatórios', href: '/otimiz/reports', icon: <IconClockHour4 size={18} />, color: '#7950f2' },
          ].map((item) => (
            <Grid item xs={6} sm={4} md={2.4} key={item.label}>
              <Button
                component={Link}
                href={item.href}
                fullWidth
                variant="outlined"
                sx={{
                  py: 1.5,
                  borderColor: 'divider',
                  color: 'text.primary',
                  justifyContent: 'flex-start',
                  gap: 1,
                  '&:hover': { borderColor: item.color, color: item.color, bgcolor: alpha(item.color, 0.06) },
                }}
                startIcon={<Box sx={{ color: item.color }}>{item.icon}</Box>}
              >
                {item.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>
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
