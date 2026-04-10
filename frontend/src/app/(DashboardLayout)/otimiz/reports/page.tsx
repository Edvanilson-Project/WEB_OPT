'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Stack, Skeleton, ToggleButtonGroup, ToggleButton,
  useTheme,
} from '@mui/material';
import {
  IconRefresh, IconBus, IconUsers, IconCurrencyDollar, IconTrendingUp, IconCheckbox,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import KpiCard from '../_components/KpiCard';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { reportsApi, getSessionUser } from '@/lib/api';
import type { KpiData, HistoryPoint } from '../_types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Period = 7 | 30 | 90;

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

function ReportsInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [period, setPeriod] = useState<Period>(30);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadKpis = useCallback(async () => {
    setLoadingKpis(true);
    try { setKpis(await reportsApi.getKpis(getSessionUser()?.companyId ?? 1)); }
    catch { notify.error('Falha ao carregar KPIs.'); }
    finally { setLoadingKpis(false); }
  }, [notify]);

  const loadHistory = useCallback(async (p: Period) => {
    setLoadingHistory(true);
    try { setHistory(await reportsApi.getHistory(getSessionUser()?.companyId ?? 1, p)); }
    catch { /* silently ignore */ }
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { loadKpis(); }, [loadKpis]);
  useEffect(() => { loadHistory(period); }, [loadHistory, period]);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, background: 'transparent' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
    xaxis: {
      categories: history.map((h) => fmtDate(h.date)),
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
    { name: 'Veículos', data: history.map((h) => h.vehicles ?? 0) },
    { name: 'Tripulantes', data: history.map((h) => h.crew ?? 0) },
    { name: 'Custo (÷1000)', data: history.map((h) => h.cost ? Number((h.cost / 1000).toFixed(1)) : 0), yAxisIndex: 1 },
  ];

  const kpiCards = kpis ? [
    { title: 'Total de Execuções', value: kpis.totalRuns, subtitle: 'todas as otimizações', icon: <IconTrendingUp size={26} />, color: theme.palette.primary.main },
    { title: 'Execuções Concluídas', value: kpis.completedRuns, subtitle: `${kpis.totalRuns - kpis.completedRuns} falhas/canceladas`, icon: <IconCheckbox size={26} />, color: '#13DEB9' },
    { title: 'Taxa de Sucesso', value: `${isFinite(Number(kpis.successRate)) ? Number(kpis.successRate).toFixed(1) : '0'}%`, subtitle: 'execuções concluídas', icon: <IconTrendingUp size={26} />, color: '#FFAE1F' },
    { title: 'Custo Médio/Execução', value: fmtCurrency(kpis.avgCost), subtitle: 'por execução concluída', icon: <IconCurrencyDollar size={26} />, color: '#FA896B' },
  ] : [];

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
          <Button
            startIcon={<IconRefresh size={18} />}
            onClick={() => { loadKpis(); loadHistory(period); }}
            variant="outlined"
            size="small"
          >
            Atualizar
          </Button>
        </Stack>

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
        {kpis && (
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
        )}

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
