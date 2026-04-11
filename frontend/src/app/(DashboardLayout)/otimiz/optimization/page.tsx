'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Stack, Tooltip,
  IconButton, Chip, Divider, LinearProgress, Alert, AlertTitle,
  TextField, MenuItem, Card,
  Paper, Collapse, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Badge,
} from '@mui/material';
import {
  IconPlayerPlay, IconRefresh, IconChartBar,
  IconRobot, IconCurrencyDollar,
  IconBus, IconUsers, IconAlertTriangle,
  IconChevronDown, IconChevronUp, IconRoute, IconListDetails,
  IconFileCode, IconShieldCheck, IconX, IconCheck,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { optimizationApi, optimizationSettingsApi, linesApi, getSessionUser } from '@/lib/api';
import type {
  Line, OptimizationRun, OptimizationSettings, OptimizationResultSummary,
  OptimizationBlock, OptimizationDuty, TripDetail, OptimizationAlgorithm,
  OptimizationStructuredIssue
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
function TripDetailTable({ trips }: { trips: TripDetail[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 1, maxHeight: 300 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Duração</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>ID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trips.slice().sort((a,b) => (a.start_time ?? 0) - (b.start_time ?? 0)).map((t, i) => (
            <TableRow key={i} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{t.origin_name || t.origin_id || '--'}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{t.destination_name || t.destination_id || '--'}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{minToDuration(t.duration)}</TableCell>
              <TableCell sx={{ py: 0.75 }}><Typography variant="caption" fontWeight={700}>#{t.id}</Typography></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Sub: KPI Hero Cards ───
function KpiStrip({ res }: { res: OptimizationResultSummary }) {
  const items = [
    { label: 'Custo Total', value: fmtCurrency(res.total_cost || res.totalCost), color: 'primary.main', icon: <IconCurrencyDollar size={20} /> },
    { label: 'Veículos (VSP)', value: res.vehicles ?? res.num_vehicles ?? '--', color: 'info.main', icon: <IconBus size={20} /> },
    { label: 'Tripulantes (CSP)', value: res.crew ?? res.num_crew ?? '--', color: 'success.main', icon: <IconUsers size={20} /> },
    { label: 'Violações CCT', value: res.cct_violations ?? res.cctViolations ?? 0, color: (res.cct_violations ?? res.cctViolations ?? 0) > 0 ? 'error.main' : 'success.main', icon: <IconShieldCheck size={20} /> },
  ];
  return (
    <Grid container spacing={2} mb={3}>
      {items.map((it) => (
        <Grid item xs={6} sm={3} key={it.label}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center', borderLeft: '4px solid', borderLeftColor: it.color }}>
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
function TabOverview({ res }: { res: OptimizationResultSummary }) {
  const duties = res.duties || [];
  if (!duties.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem jornadas geradas nesta execução.</Typography>;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>{duties.length} Escalas de Trabalho Geradas</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, maxHeight: 600 }}>
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
              <DutyTableRow key={duty.duty_id ?? idx} duty={duty} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function DutyTableRow({ duty }: { duty: OptimizationDuty }) {
  const [open, setOpen] = useState(false);
  const maxShift = 900;
  const hasViolation = duty.spread_time > maxShift || (duty.cct_penalties_cost ?? 0) > 0 || (duty.rest_violations ?? 0) > 0;
  const hasOvertime = (duty.overtime_cost ?? 0) > 0 || (duty.overtime_minutes ?? 0) > 0;

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
          <Typography variant="body2" fontWeight={600}>{minToHHMM(duty.start_time)} → {minToHHMM(duty.end_time)}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{minToDuration(duty.spread_time)}</Typography>
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
                    <TripDetailTable trips={duty.trips as TripDetail[]} />
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
function TabVehicles({ res }: { res: OptimizationResultSummary }) {
  const blocks = res.blocks || [];
  if (!blocks.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem dados de alocação veicular disponíveis.</Typography>;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>{blocks.length} Blocos de Veículo</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, maxHeight: 600 }}>
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
              <VehicleTableRow key={block.block_id ?? idx} block={block} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function VehicleTableRow({ block }: { block: any }) {
  const [open, setOpen] = useState(false);
  const totalDur = block.end_time - block.start_time;

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
          <Typography variant="body2" fontWeight={600}>{minToHHMM(block.start_time)} → {minToHHMM(block.end_time)}</Typography>
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
                 <TripDetailTable trips={block.trips as TripDetail[]} />
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
function TabAlerts({ res }: { res: OptimizationResultSummary }) {
  const warningsRaw = res.warnings || [];
  const warnings = Array.isArray(warningsRaw) ? (warningsRaw as (string | OptimizationStructuredIssue)[]).map(w => typeof w === 'string' ? w : w.message) : [];
  const unassigned = res.unassigned_trips || [];
  const violations = res.cct_violations ?? res.cctViolations ?? 0;
  const duties = res.duties || [];
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
function TabTrips({ res }: { res: OptimizationResultSummary }) {
  const blocks = res.blocks || [];
  const unassigned = res.unassigned_trips || [];
  
  // Flatten all trips from blocks with their block assignment
  const assignedTrips: any[] = [];
  blocks.forEach((b) => {
    const rawTrips = b.trips || [];
    rawTrips.forEach((t) => {
      if (typeof t === 'number') {
        // Formato legado (runs antigos): apenas ID disponível
        assignedTrips.push({ id: t, trip_id: t, start_time: null, end_time: null, origin_id: '--', destination_id: '--', duration: 0, block_id: b.block_id, status: 'assigned' as const });
      } else {
        assignedTrips.push({ ...(t as TripDetail), block_id: b.block_id, status: 'assigned' as const });
      }
    });
  });
  
  // Also check duties for trips (legacy fallback)
  const duties = res.duties || [];
  if (assignedTrips.length === 0) {
    duties.forEach((d: OptimizationDuty) => {
      (d.trips || []).forEach((t: TripDetail) => {
        assignedTrips.push({ ...t, status: 'assigned' as const });
      });
    });
  }

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
                <TableCell>{t.origin_name || t.origin_id || '--'}</TableCell>
                <TableCell>{t.destination_name || t.destination_id || '--'}</TableCell>
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

// ─── Tab 4: Auditoria (Raw JSON) ───
function TabAudit({ res, run }: { res: OptimizationResultSummary; run: OptimizationRun }) {
  const raw = JSON.stringify(res, null, 2);
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={1}>Dados Brutos do Motor (Debug)</Typography>
      <Typography variant="caption" color="text.secondary" mb={2} display="block">
        Algoritmo: {run.algorithm} · Duração: {run.durationMs ? `${run.durationMs}ms` : '--'} · Status: {run.status}
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, maxHeight: 500, overflowY: 'auto', bgcolor: 'grey.900' }}>
        <pre style={{ margin: 0, fontSize: 12, color: '#4FC3F7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>{raw}</pre>
      </Paper>
    </Box>
  );
}

// ─── Main RunVisuals ───
function RunVisuals({ run }: { run: OptimizationRun }) {
  const [tab, setTab] = useState(0);
  const res = run.resultSummary || {};
  const warningsRaw = res.warnings || [];
  const warnings = Array.isArray(warningsRaw) ? (warningsRaw as (string | OptimizationStructuredIssue)[]).map(w => typeof w === 'string' ? w : w.message) : [];
  const unassigned = res.unassigned_trips || [];
  const alertCount = (res.cct_violations ?? res.cctViolations ?? 0) + warnings.length + unassigned.length;

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
      <KpiStrip res={res} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: -0.5 }}>
          <Tab icon={<IconUsers size={16} />} iconPosition="start" label="Escalas" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconBus size={16} />} iconPosition="start" label="Veículos" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab
            icon={<Badge badgeContent={alertCount} color="error" max={99}><IconAlertTriangle size={16} /></Badge>}
            iconPosition="start" label="Alertas" sx={{ textTransform: 'none', fontWeight: 600 }}
          />
          <Tab icon={<IconRoute size={16} />} iconPosition="start" label="Viagens" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconFileCode size={16} />} iconPosition="start" label="Auditoria" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
      </Stack>

      {tab === 0 && <TabOverview res={res} />}
      {tab === 1 && <TabVehicles res={res} />}
      {tab === 2 && <TabAlerts res={res} />}
      {tab === 3 && <TabTrips res={res} />}
      {tab === 4 && <TabAudit res={res} run={run} />}
    </Box>
  );
}

// ─── Main Page ───
function OptimizationInner() {
  const notify = useNotify();
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [activeSettings, setActiveSettings] = useState<OptimizationSettings | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [operationMode, setOperationMode] = useState<'urban' | 'charter'>('urban');
  const [algorithm, setAlgorithm] = useState('hybrid_pipeline');
  const [timeBudget, setTimeBudget] = useState(30);
  const [launching, setLaunching] = useState(false);
  const [selectedRun, setSelectedRun] = useState<OptimizationRun | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [runsData, linesData] = await Promise.all([optimizationApi.getAll(), linesApi.getAll()]);
      setRuns(extractArray(runsData));
      setLines(extractArray(linesData));
      const user = getSessionUser();
      if (user?.companyId) {
        try { setActiveSettings(await optimizationSettingsApi.getActive(user.companyId)); } catch {}
      }
    } catch { notify.error('Erro ao carregar dados.'); }
  }, [notify]);

  useEffect(() => {
    loadAll();
    // Iniciar polling apenas se houver uma execução pendente ou rodando
    const interval = setInterval(() => {
      const hasActive = runs.some(r => r.status === 'running' || r.status === 'pending');
      if (hasActive) {
        loadAll();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadAll, runs]);

  const handleLaunch = async () => {
    if (!selectedLineIds.length) return notify.warning('Selecione ao menos uma linha.');
    setLaunching(true);
    try {
      const payload: any = {
        companyId: getSessionUser()?.companyId ?? 1,
        algorithm: algorithm as OptimizationAlgorithm,
        operationMode,
        timeBudgetSeconds: timeBudget,
      };
      if (selectedLineIds.length === 1) payload.lineId = selectedLineIds[0];
      else payload.lineIds = selectedLineIds;
      await optimizationApi.run(payload);
      notify.success(`Iniciado: ${algorithm} · ${operationMode === 'charter' ? 'Fretamento' : 'Urbano'} · ${timeBudget}s`);
      setSelectedLineIds([]);
      loadAll();
    } catch { notify.error('Erro ao iniciar otimização.'); }
    finally { setLaunching(false); }
  };

  const activeRun = runs.find(r => r.status === 'running');
  const historyRuns = runs.filter(r => r.status !== 'running');
  const viewRun = activeRun || selectedRun;

  return (
    <PageContainer title="Cockpit de Escalonamento — OTIMIZ" description="Painel multi-visão de otimização">
      {/* HEADER */}
      <Box sx={{ mb: 4, pt: 2 }}>
        <Typography variant="overline" sx={{ letterSpacing: 1.6, color: 'primary.main', fontWeight: 800 }}>DISPATCH COCKPIT</Typography>
        <Typography variant="h3" fontWeight={800} mt={0.5}>Otimização Corporativa</Typography>
        <Typography variant="body1" color="text.secondary" mt={1}>Multi-Visão: Escalas, Veículos, Alertas, Viagens e Auditoria Técnica.</Typography>
        <Stack direction="row" spacing={1} mt={2}>
          <Chip label={activeSettings?.name ? `Perfil: ${activeSettings.name}` : 'Sem Perfil Ativo'} color="secondary" variant="outlined" size="small" />
          <Tooltip title="Recarregar"><IconButton onClick={loadAll} size="small" sx={{ border: '1px solid', borderColor: 'divider' }}><IconRefresh size={16} /></IconButton></Tooltip>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* LEFT: LAUNCH + HISTORY */}
        <Grid item xs={12} md={3}>
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>Iniciar Otimização</Typography>
            <TextField
              select fullWidth size="small" label="Linhas"
              SelectProps={{ multiple: true }}
              value={selectedLineIds}
              onChange={(e) => setSelectedLineIds(typeof e.target.value === 'string' ? [] : e.target.value as number[])}
              sx={{ mb: 1.5 }}
            >
              {lines.map((l) => <MenuItem key={l.id} value={l.id}>{l.code} — {l.name}</MenuItem>)}
            </TextField>
            <TextField
              select fullWidth size="small" label="Algoritmo" value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)} sx={{ mb: 1.5 }}
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
              onChange={(e) => setOperationMode(e.target.value as 'urban' | 'charter')} sx={{ mb: 1.5 }}
            >
              <MenuItem value="urban">🚍 Urbano (CCT padrão)</MenuItem>
              <MenuItem value="charter">🚌 Fretamento (turno flexível)</MenuItem>
            </TextField>
            <TextField
              fullWidth size="small" label="Budget (segundos)" type="number"
              value={timeBudget}
              onChange={(e) => setTimeBudget(Math.max(5, parseInt(e.target.value) || 30))}
              sx={{ mb: 2 }}
              inputProps={{ min: 5, max: 600 }}
            />
            <Button fullWidth variant="contained" onClick={handleLaunch} disabled={launching || activeRun != null} startIcon={launching ? <IconRefresh /> : <IconPlayerPlay />}>
              {launching ? "Calculando..." : activeRun ? "Ocupada" : "Otimizar"}
            </Button>
          </Paper>

          <Typography variant="subtitle2" fontWeight={700} mb={1.5} color="text.secondary">Histórico</Typography>
          {historyRuns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nenhuma execução.</Typography>
          ) : (
            <Stack spacing={1}>
              {historyRuns.slice(0, 15).map((r) => (
                <Card
                  key={r.id}
                  onClick={() => setSelectedRun(r)}
                  variant="outlined"
                  sx={{ cursor: 'pointer', borderRadius: 2, transition: '0.2s', borderColor: selectedRun?.id === r.id ? 'primary.main' : 'divider', '&:hover': { borderColor: 'primary.main' } }}
                >
                  <Box p={1.5} display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" fontWeight={700}>#{r.id}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{new Date(r.createdAt).toLocaleString('pt-BR')}</Typography>
                    </Box>
                    <Box textAlign="right">
                      {r.status === 'failed' ? (
                        <Chip size="small" color="error" label="Falhou" sx={{ height: 20, fontSize: 11 }} />
                      ) : (
                        <Typography variant="caption" fontWeight={700} color="success.main">{fmtCurrency(r.totalCost)}</Typography>
                      )}
                    </Box>
                  </Box>
                </Card>
              ))}
            </Stack>
          )}
        </Grid>

        {/* RIGHT: Multi-Tab View */}
        <Grid item xs={12} md={9}>
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, minHeight: 400 }}>
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
                <RunVisuals run={viewRun} />
              </>
            ) : (
              <Box textAlign="center" py={12}>
                <IconChartBar size={64} color="#BDBDBD" />
                <Typography variant="h6" color="text.secondary" mt={2}>Selecione uma execução ou inicie uma nova</Typography>
                <Typography variant="body2" color="text.secondary">Os resultados aparecerão aqui com todas as visões disponíveis.</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}

export default function OptimizationPage() { return <NotifyProvider><OptimizationInner /></NotifyProvider>; }
