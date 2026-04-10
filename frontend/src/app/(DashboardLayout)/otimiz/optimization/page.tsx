'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Stack, Tooltip,
  IconButton, Chip, Divider, LinearProgress, Alert, AlertTitle,
  TextField, MenuItem, useTheme, Card, CardContent,
  Paper, Collapse, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Badge,
} from '@mui/material';
import {
  IconPlayerPlay, IconRefresh, IconChartBar,
  IconRobot, IconCurrencyDollar,
  IconBus, IconUsers, IconAlertTriangle,
  IconChevronDown, IconChevronUp, IconRoute, IconListDetails,
  IconFileCode, IconShieldCheck, IconX,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { optimizationApi, optimizationSettingsApi, linesApi, getSessionUser } from '@/lib/api';
import type { Line, OptimizationRun, OptimizationSettings } from '../_types';
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
function TripTimeline({ trips, start, end, totalDuration }: { trips: any[], start: number, end: number, totalDuration: number }) {
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
function TripDetailTable({ trips }: { trips: any[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 1, maxHeight: 300 }}>
      <Table size="small">
        <TableHead sx={{ bgcolor: 'grey.50' }}>
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
          {trips.sort((a,b) => a.start_time - b.start_time).map((t, i) => (
            <TableRow key={i} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{t.origin_id || '--'}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{t.destination_id || '--'}</TableCell>
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
function KpiStrip({ res }: { res: any }) {
  const items = [
    { label: 'Custo Total', value: fmtCurrency(res.total_cost), color: 'primary.main', icon: <IconCurrencyDollar size={20} /> },
    { label: 'Veículos (VSP)', value: res.vehicles ?? '--', color: 'info.main', icon: <IconBus size={20} /> },
    { label: 'Tripulantes (CSP)', value: res.crew ?? '--', color: 'success.main', icon: <IconUsers size={20} /> },
    { label: 'Violações CCT', value: res.cct_violations ?? 0, color: (res.cct_violations ?? 0) > 0 ? 'error.main' : 'success.main', icon: <IconShieldCheck size={20} /> },
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
function TabOverview({ res, viewMode }: { res: any, viewMode: 'table' | 'graphic' }) {
  const duties: any[] = res.duties || [];
  if (!duties.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem jornadas geradas nesta execução.</Typography>;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>{duties.length} Escalas de Trabalho Geradas</Typography>
      <Box sx={{ maxHeight: 600, overflowY: 'auto', pr: 0.5 }}>
        {duties.map((duty: any, idx: number) => <DutyRow key={duty.duty_id ?? idx} duty={duty} viewMode={viewMode} />)}
      </Box>
    </Box>
  );
}

function DutyRow({ duty, viewMode = 'graphic' }: { duty: any, viewMode?: 'table' | 'graphic' }) {
  const [open, setOpen] = useState(false);
  const maxShift = 900;
  const hasViolation = duty.spread_time > maxShift || (duty.cct_penalties_cost ?? 0) > 0 || (duty.rest_violations ?? 0) > 0;
  const hasOvertime = (duty.overtime_cost ?? 0) > 0 || (duty.overtime_minutes ?? 0) > 0;
  const workPct = duty.spread_time > 0 ? Math.min(100, (duty.work_time / duty.spread_time) * 100) : 0;
  const totalDur = duty.spread_time;

  return (
    <Card variant="outlined" sx={{ mb: 1.5, transition: '0.2s', borderColor: hasViolation ? 'error.main' : 'divider', borderRadius: 2, '&:hover': { borderColor: 'primary.main' } }}>
      <Box sx={{ p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => setOpen(!open)}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: hasViolation ? 'error.lighter' : 'primary.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasViolation ? 'error.main' : 'primary.main', mr: 2 }}>
          <IconUsers size={20} />
        </Box>
        <Box flex={1}>
          <Grid container alignItems="center">
            <Grid item xs={12} sm={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle2" fontWeight={700}>Plantão #{duty.duty_id}</Typography>
                {hasViolation && <Chip size="small" color="error" label="Violação" sx={{ height: 18, fontSize: 10 }} />}
                {hasOvertime && <Chip size="small" color="warning" label="HE" sx={{ height: 18, fontSize: 10 }} />}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {minToHHMM(duty.start_time)} → {minToHHMM(duty.end_time)} · {minToDuration(duty.spread_time)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={7}>
               {viewMode === 'graphic' && (
                 <TripTimeline trips={duty.trips || []} start={duty.start_time} end={duty.end_time} totalDuration={totalDur} />
               )}
            </Grid>
          </Grid>
        </Box>
        <Box textAlign="right" mr={1} ml={1}>
          <Typography variant="subtitle2" fontWeight={700} color={hasViolation ? 'error.main' : 'text.primary'}>{fmtCurrency(duty.total_cost || duty.work_cost)}</Typography>
          <Typography variant="caption" color="text.secondary">{duty.trips?.length || 0} viagens</Typography>
        </Box>
        <IconButton size="small">{open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}</IconButton>
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2.5, bgcolor: 'rgba(0,0,0,0.01)' }}>
          <Grid container spacing={3}>
             <Grid item xs={12} md={8}>
               <Typography variant="caption" fontWeight={700} mb={1.5} display="block">Sequência de Atividades</Typography>
               {duty.trips && duty.trips.length > 0 && (
                 <TripDetailTable trips={duty.trips} />
               )}
             </Grid>
             <Grid item xs={12} md={4}>
               <Typography variant="caption" fontWeight={700} mb={1.5} display="block">Composição de Custos e Auditoria</Typography>
               <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Custo Total da Escala</Typography>
                    <Typography variant="h6" fontWeight={800} color="primary.main">{fmtCurrency(duty.total_cost || duty.work_cost)}</Typography>
                  </Box>
                  <Divider />
                  <Grid container spacing={1}>
                    {[
                      { l: 'Custo Trabalho', v: fmtCurrency(duty.work_cost || 0) },
                      { l: 'HE / Adicionais', v: fmtCurrency((duty.overtime_cost || 0) + (duty.nocturnal_extra_cost || 0)) },
                      { l: 'Min. Garantido', v: fmtCurrency(duty.guaranteed_cost || 0) },
                      { l: 'Tempo Ocioso', v: fmtCurrency(duty.waiting_cost || 0) },
                    ].map((c) => (
                      <Grid item xs={6} key={c.l}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{c.l}</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: 13 }}>{c.v}</Typography>
                      </Grid>
                    ))}
                  </Grid>
               </Stack>
               {(duty.warnings?.length > 0 || duty.rest_violations > 0) && (
                 <Box mt={3} p={1.5} sx={{ bgcolor: 'error.lighter', borderRadius: 2, border: '1px solid', borderColor: 'error.light' }}>
                   <Stack direction="row" spacing={1} mb={1}>
                     <IconAlertTriangle size={16} color="red" />
                     <Typography variant="caption" fontWeight={700} color="error.dark">Pendências Regulamentares</Typography>
                   </Stack>
                   {duty.warnings?.map((w: string, i: number) => (
                     <Typography key={i} variant="caption" display="block" color="error.main" sx={{ pl: 3 }}>• {w}</Typography>
                   ))}
                   {duty.rest_violations > 0 && (
                      <Typography variant="caption" display="block" color="error.main" sx={{ pl: 3 }}>• Violação de descanso: {duty.rest_violations} caso(s).</Typography>
                   )}
                 </Box>
               )}
             </Grid>
          </Grid>
        </Box>
      </Collapse>
    </Card>
  );
}

// ─── Tab 1: Visão por Veículo (Blocks / VSP) ───
function TabVehicles({ res, viewMode }: { res: any, viewMode: 'table' | 'graphic' }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const blocks: any[] = res.blocks || [];
  if (!blocks.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem dados de alocação veicular disponíveis.</Typography>;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>{blocks.length} Blocos de Veículo</Typography>
      <Grid container spacing={2}>
        {blocks.map((block: any, idx: number) => {
          const totalDur = block.end_time - block.start_time;
          const isExpanded = expanded === block.block_id;
          
          return (
            <Grid item xs={12} key={block.block_id ?? idx}>
              <Card variant="outlined" sx={{ borderRadius: 2, transition: '0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }}>
                <Box sx={{ p: 2, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : block.block_id)}>
                  <Grid container alignItems="center" spacing={2}>
                    <Grid item xs={12} sm={3}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'info.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'info.main' }}><IconBus size={22} /></Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={800}>Veículo #{block.block_id}</Typography>
                          <Typography variant="caption" color="text.secondary">{block.num_trips || block.trips?.length || '?'} viagens · {fmtCurrency(block.total_cost || block.cost)}</Typography>
                        </Box>
                      </Stack>
                    </Grid>
                    
                    <Grid item xs={12} sm={7}>
                      {viewMode === 'graphic' ? (
                        <TripTimeline trips={block.trips || []} start={block.start_time} end={block.end_time} totalDuration={totalDur} />
                      ) : (
                        <Stack direction="row" spacing={3} divider={<Divider orientation="vertical" flexItem />}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">Saída</Typography>
                            <Typography variant="body2" fontWeight={700} color="primary.main">{minToHHMM(block.start_time)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">Retorno</Typography>
                            <Typography variant="body2" fontWeight={700} color="primary.main">{minToHHMM(block.end_time)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">Duração Total</Typography>
                            <Typography variant="body2" fontWeight={700}>{minToDuration(totalDur)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">KMs</Typography>
                            <Typography variant="body2" fontWeight={700}>{(block.meta?.total_distance_km || 0).toFixed(1)} km</Typography>
                          </Box>
                        </Stack>
                      )}
                    </Grid>

                    <Grid item xs={12} sm={2} sx={{ textAlign: 'right' }}>
                      <IconButton size="small">{isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}</IconButton>
                    </Grid>
                  </Grid>
                </Box>
                
                <Collapse in={isExpanded}>
                  <Divider />
                  <Box sx={{ p: 2.5, bgcolor: 'rgba(0,0,0,0.01)' }}>
                    <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Composição do Bloco</Typography>
                    {block.trips && Array.isArray(block.trips) && block.trips.length > 0 && (
                       <TripDetailTable trips={block.trips} />
                    )}
                    
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      {[
                        { l: 'Custo Ativação', v: fmtCurrency(block.activation_cost) },
                        { l: 'Deadhead', v: fmtCurrency(block.connection_cost || block.deadhead_cost), err: (block.connection_cost || 0) > 100 },
                        { l: 'Tempo Ocioso', v: fmtCurrency(block.idle_cost) },
                        { l: 'Quilometragem', v: fmtCurrency(block.distance_cost) },
                      ].map((c) => (
                        <Grid item xs={6} sm={3} key={c.l}>
                          <Typography variant="caption" color="text.secondary" display="block">{c.l}</Typography>
                          <Typography variant="body2" fontWeight={600} color={c.err ? 'error.main' : 'text.primary'}>{c.v}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Collapse>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

// ─── Tab 2: Alertas e Sanções ───
function TabAlerts({ res }: { res: any }) {
  const warnings: string[] = res.warnings || [];
  const unassigned: any[] = res.unassigned_trips || [];
  const violations = res.cct_violations ?? 0;
  const duties: any[] = res.duties || [];
  const dutyWarnings = duties.flatMap((d: any) => (d.warnings || []).map((w: string) => ({ duty: d.duty_id, msg: w })));

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
              {unassigned.slice(0, 20).map((t: any, i: number) => (
                <Chip key={i} size="small" label={`Trip #${typeof t === 'object' ? t.id : t}`} color="warning" variant="outlined" />
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
function TabTrips({ res }: { res: any }) {
  const blocks: any[] = res.blocks || [];
  const unassigned: any[] = res.unassigned_trips || [];
  
  // Flatten all trips from blocks with their block assignment
  const assignedTrips: { tripId: number; blockId: number; start: number; end: number; origin: number; dest: number }[] = [];
  blocks.forEach((b: any) => {
    const trips = b.trips || [];
    trips.forEach((t: any) => {
      assignedTrips.push({ tripId: t.id ?? t, blockId: b.block_id, start: t.start_time, end: t.end_time, origin: t.origin_id, dest: t.destination_id });
    });
  });

  // Also check duties for trips
  const duties: any[] = res.duties || [];
  if (assignedTrips.length === 0) {
    duties.forEach((d: any) => {
      (d.trip_ids || []).forEach((tid: number) => {
        assignedTrips.push({ tripId: tid, blockId: 0, start: 0, end: 0, origin: 0, dest: 0 });
      });
    });
  }

  const total = assignedTrips.length + unassigned.length;
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const allTrips = [
    ...assignedTrips.map((t) => ({ ...t, status: 'assigned' as const })),
    ...unassigned.map((t: any) => ({
      tripId: typeof t === 'object' ? t.id : t,
      blockId: null,
      start: typeof t === 'object' ? t.start_time : null,
      end: typeof t === 'object' ? t.end_time : null,
      origin: typeof t === 'object' ? t.origin_id : null,
      dest: typeof t === 'object' ? t.destination_id : null,
      status: 'orphan' as const,
    })),
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
            {sliced.map((t, i) => (
              <TableRow key={i} sx={{ bgcolor: t.status === 'orphan' ? 'error.lighter' : 'inherit' }}>
                <TableCell><Typography variant="body2" fontWeight={600}>#{t.tripId}</Typography></TableCell>
                <TableCell align="center">
                  <Chip size="small" color={t.status === 'assigned' ? 'success' : 'error'} label={t.status === 'assigned' ? 'OK' : 'Órfã'} sx={{ height: 20, fontSize: 11 }} />
                </TableCell>
                <TableCell>{t.blockId != null ? `Bloco #${t.blockId}` : '--'}</TableCell>
                <TableCell>{t.start != null ? minToHHMM(t.start) : '--'}</TableCell>
                <TableCell>{t.end != null ? minToHHMM(t.end) : '--'}</TableCell>
                <TableCell>{t.origin ?? '--'}</TableCell>
                <TableCell>{t.dest ?? '--'}</TableCell>
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
function TabAudit({ res, run }: { res: any; run: OptimizationRun }) {
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
  const [viewMode, setViewMode] = useState<'table' | 'graphic'>('graphic');
  const res: any = run.resultSummary || {};
  const warnings: string[] = res.warnings || [];
  const unassigned: any[] = res.unassigned_trips || [];
  const alertCount = (res.cct_violations ?? 0) + warnings.length + unassigned.length;

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
        
        {(tab === 0 || tab === 1) && (
          <Box sx={{ p: 0.5, bgcolor: 'action.hover', borderRadius: 2, display: 'flex' }}>
            <Tooltip title="Visão de Tabela">
              <IconButton size="small" onClick={() => setViewMode('table')} color={viewMode === 'table' ? 'primary' : 'default'} sx={{ bgcolor: viewMode === 'table' ? 'background.paper' : 'transparent', borderRadius: 1.5, boxShadow: viewMode === 'table' ? 1 : 0 }}>
                <IconListDetails size={18} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Visão Gráfica">
              <IconButton size="small" onClick={() => setViewMode('graphic')} color={viewMode === 'graphic' ? 'primary' : 'default'} sx={{ bgcolor: viewMode === 'graphic' ? 'background.paper' : 'transparent', borderRadius: 1.5, boxShadow: viewMode === 'graphic' ? 1 : 0, ml: 0.5 }}>
                <IconChartBar size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Stack>

      {tab === 0 && <TabOverview res={res} viewMode={viewMode} />}
      {tab === 1 && <TabVehicles res={res} viewMode={viewMode} />}
      {tab === 2 && <TabAlerts res={res} />}
      {tab === 3 && <TabTrips res={res} />}
      {tab === 4 && <TabAudit res={res} run={run} />}
    </Box>
  );
}

// ─── Main Page ───
function OptimizationInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [activeSettings, setActiveSettings] = useState<OptimizationSettings | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
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

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleLaunch = async () => {
    if (!selectedLineIds.length) return notify.warning('Selecione ao menos uma linha.');
    setLaunching(true);
    try {
      const payload: any = { companyId: getSessionUser()?.companyId ?? 1, algorithm: 'hybrid_pipeline' };
      if (selectedLineIds.length === 1) payload.lineId = selectedLineIds[0];
      else payload.lineIds = selectedLineIds;
      await optimizationApi.run(payload);
      notify.success('Pipeline inicializado!');
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
              sx={{ mb: 2 }}
            >
              {lines.map((l) => <MenuItem key={l.id} value={l.id}>{l.code} — {l.name}</MenuItem>)}
            </TextField>
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
