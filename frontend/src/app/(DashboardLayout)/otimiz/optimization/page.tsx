'use client';
import React, { useState, useMemo } from 'react';
import {
  Box, Grid, Typography, Button, Stack, Tooltip,
  IconButton, Chip,
  TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer,
  alpha, useTheme,
} from '@mui/material';
import {
  IconPlayerPlay, IconRefresh, IconChartBar,
  IconChevronDown, IconChevronUp, IconX,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import { OtimizPanel, OtimizToolbar } from '../_components/OtimizUI';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { optimizationApi, getSessionUser } from '@/lib/api';
import { useLines, useTerminals, useActiveSettings, useInvalidate, queryKeys, useOptimizationLiveSync } from '@/lib/query-hooks';
import type {
  Line, OptimizationRun, Terminal,
  OptimizationAlgorithm,
} from '../_types';
import { extractArray } from '../_types';
import { fmtCurrency } from './_helpers/formatters';
import { useDebounce } from '@/utils/useDebounce';
import { RunHistorySummary } from './_components/shared';
import { RunVisuals } from './_components/RunVisuals';


// ─── Main Page ───
function OptimizationInner() {
  const theme = useTheme();
  const notify = useNotify();
  const invalidate = useInvalidate();

  const sessionUser = getSessionUser();
  const companyId = sessionUser?.companyId;

  // ── TanStack Query data ──
  const {
    activeRun: liveRun,
    runs: syncedRuns,
    refetch: refetchRuns,
    syncIntervalMs,
  } = useOptimizationLiveSync<OptimizationRun>(companyId, {
    invalidateRelated: true,
    idleIntervalMs: 30_000,
    liveIntervalMs: 5_000,
  });
  const { data: linesRaw } = useLines();
  const { data: terminalsRaw } = useTerminals();
  const { data: activeSettings } = useActiveSettings(companyId);

  const runs: OptimizationRun[] = useMemo(() => syncedRuns as OptimizationRun[], [syncedRuns]);
  const lines: Line[] = useMemo(() => linesRaw ? extractArray(linesRaw) : [], [linesRaw]);
  const terminals: Terminal[] = useMemo(() => terminalsRaw ? extractArray(terminalsRaw) : [], [terminalsRaw]);

  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [operationMode, setOperationMode] = useState<'urban' | 'charter'>('urban');
  const [algorithm, setAlgorithm] = useState('hybrid_pipeline');
  const [timeBudget, setTimeBudget] = useState(30);
  const [launching, setLaunching] = useState(false);
  const [selectedRun, setSelectedRun] = useState<OptimizationRun | null>(null);
  const [runName, setRunName] = useState('');
  const [openLaunchModal, setOpenLaunchModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const debouncedHistorySearch = useDebounce(historySearch, 300);

  const blockingRun = useMemo(
    () => (liveRun as OptimizationRun | null) ?? null,
    [liveRun],
  );

  const loadAll = () => {
    invalidate(
      queryKeys.runs(companyId),
      queryKeys.lines,
      queryKeys.terminals,
      [...queryKeys.settingsActive, companyId] as const,
      queryKeys.optimizationDashboard(companyId),
      queryKeys.optimizationKpis(companyId),
      queryKeys.optimizationHistoryGroup(companyId),
    );
    void refetchRuns();
  };

  const handleLaunch = async () => {
    if (!selectedLineIds.length) return notify.warning('Selecione ao menos uma linha.');
    setLaunching(true);
    try {
      if (!companyId) {
        setLaunching(false);
        return notify.error('Usuário sem empresa associada.');
      }
      const payload: Record<string, unknown> = {
        name: runName?.trim() || undefined,
        companyId,
        algorithm: algorithm as OptimizationAlgorithm,
        operationMode,
        timeBudgetSeconds: timeBudget,
        ...(selectedLineIds.length === 1 ? { lineId: selectedLineIds[0] } : { lineIds: selectedLineIds }),
      };
      await optimizationApi.run(payload);
      notify.success('Otimização Iniciada com Sucesso');
      setSelectedLineIds([]);
      setRunName('');
      setOpenLaunchModal(false);
      invalidate(
        queryKeys.runs(companyId),
        queryKeys.optimizationDashboard(companyId),
        queryKeys.optimizationKpis(companyId),
        queryKeys.optimizationHistoryGroup(companyId),
      );
      void refetchRuns();
    } catch { notify.error('Erro ao iniciar otimização.'); }
    finally { setLaunching(false); }
  };

  const handleCancel = async (id: number) => {
    if (!confirm(`Deseja realmente abortar a execução #${id}?`)) return;
    try {
      await optimizationApi.cancel(id);
      notify.success('Execução cancelada com sucesso.');
      loadAll();
    } catch { notify.error('Erro ao cancelar execução.'); }
  };

  const runningRun = runs.find((run) => run.status === 'running') ?? null;
  const historyRuns = runs.filter((run) => run.status !== 'running' && run.status !== 'pending' && run.status !== 'failed');
  const failedRuns = runs.filter(r => r.status === 'failed');
  // Se houver uma selecionada manualmente, ela tem prioridade. Senão, mostra a ativa.
  const viewRun = selectedRun || blockingRun;

  const [showFailed, setShowFailed] = useState(false);

  return (
    <PageContainer title="Cockpit de Escalonamento — OTIMIZ" description="Painel multi-visão de otimização">
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: -0.5 }}>Cockpit de Otimização</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.75}>
            Visão operacional clean para execução, análise e auditoria do motor VSP+CSP.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip label={activeSettings?.name ? `Perfil: ${activeSettings.name}` : 'Sem perfil'} color="secondary" variant="outlined" size="small" />
          <Chip
            label={blockingRun?.id != null
              ? `${blockingRun.status === 'pending' ? 'Fila ativa' : 'Sync ao vivo'} · #${blockingRun.id} · ${Math.round(syncIntervalMs / 1000)}s`
              : `Sync passivo · ${Math.round(syncIntervalMs / 1000)}s`}
            color={blockingRun ? 'warning' : 'default'}
            variant="outlined"
            size="small"
          />
          <Tooltip title="Recarregar"><IconButton onClick={loadAll} size="small" sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}><IconRefresh size={16} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlayerPlay size={16} />} onClick={() => setOpenLaunchModal(true)} sx={{ borderRadius: 2.5 }}>
            Otimizar
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
                      .filter(r => !debouncedHistorySearch || String(r.id).includes(debouncedHistorySearch) || r.name?.toLowerCase().includes(debouncedHistorySearch.toLowerCase()))
                      .slice(0, 15).map((r) => (
                      <TableRow
                        key={r.id}
                        hover
                        onClick={() => setSelectedRun(r)}
                        sx={{ cursor: 'pointer', bgcolor: selectedRun?.id === r.id ? alpha(theme.palette.primary.main, 0.12) : 'inherit' }}
                      >
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="caption" fontWeight={700}>#{r.id}{r.name ? ` - ${r.name}` : ''}</Typography>
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
          <OtimizPanel sx={{ minHeight: 420 }}>
            {viewRun ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
                  <Typography variant="h6" fontWeight={700}>
                    {viewRun
                      ? viewRun.status === 'pending'
                        ? `Execução #${viewRun.id} na fila`
                        : viewRun.status === 'running'
                        ? `Execução #${viewRun.id} em andamento`
                        : `Resultados — Execução #${viewRun.id}`
                      : `Resultados — Execução #${selectedRun!.id}`}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {viewRun?.id != null && (viewRun.status === 'running' || viewRun.status === 'pending') && (
                      <Button 
                        size="small" 
                        color="error" 
                        variant="outlined" 
                        onClick={() => handleCancel(viewRun.id as number)}
                        sx={{ height: 28, fontSize: '0.75rem', px: 1.5, borderRadius: 1.5 }}
                      >
                        Abortar
                      </Button>
                    )}
                    {selectedRun && (
                      <IconButton size="small" onClick={() => setSelectedRun(null)}><IconX size={18} /></IconButton>
                    )}
                  </Stack>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                  Detalhes não críticos ficam em tooltips e no painel lateral da aba Gantt para reduzir ruído visual.
                </Typography>
                <RunVisuals run={viewRun} lines={lines} terminals={terminals} allRuns={runs} activeSettings={activeSettings ?? null} />
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
