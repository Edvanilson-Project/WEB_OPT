'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import type { OptimizationRun, Line, OptimizationSettings } from '../_types';
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
const CCT_MAX_SHIFT_MIN = 480;
const CCT_MAX_OVERTIME_MIN = 120;
const CCT_HARD_LIMIT_MIN = CCT_MAX_SHIFT_MIN + CCT_MAX_OVERTIME_MIN;
const CCT_MAX_DRIVING_MIN = 270;
const CCT_MIN_BREAK_MIN = 30;

// ── Tipos internos ───────────────────────────────────────────────────────────
interface BlockResult {
  block_id: number;
  trips: number[];
  num_trips: number;
  start_time: number;
  end_time: number;
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
  isActive?: boolean;
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
  block, duty, tripMap, lines,
}: {
  block: BlockResult;
  duty: DutyResult | undefined;
  tripMap: Map<number, TripDetail>;
  lines: Line[];
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const dur = block.end_time - block.start_time;
  const isLong = dur > CCT_HARD_LIMIT_MIN;
  const isMed  = dur > CCT_MAX_SHIFT_MIN && !isLong;
  const trips  = (block.trips ?? []).map((tid) => tripMap.get(tid)).filter(Boolean) as TripDetail[];
  const sortedTrips = [...trips].sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: 'pointer',
          bgcolor: isLong ? 'error.lighter' : isMed ? 'warning.lighter' : undefined,
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
            {minToHHMM(block.start_time)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
            {minToHHMM(block.end_time)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2"
            color={isLong ? 'error.main' : isMed ? 'warning.dark' : 'text.primary'}
            fontWeight={isLong || isMed ? 700 : 400}>
            {minToDuration(dur)}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip size="small" label={block.num_trips} />
        </TableCell>
        <TableCell>
          {duty ? (
            <Chip size="small" label={`Plantao P${duty.duty_id}`} color="success" variant="outlined"
              sx={{ fontFamily: 'monospace' }} />
          ) : (
            <Chip size="small" label="Sem tripulante" color="warning" variant="outlined" />
          )}
        </TableCell>
        <TableCell>
          {isLong ? (
            <Chip size="small" color="error" label="Uso > 10h" icon={<IconAlertTriangle size={12} />} />
          ) : isMed ? (
            <Chip size="small" color="warning" label="Hora extra" />
          ) : (
            <Chip size="small" color="success" label="Normal" variant="outlined" icon={<IconCheck size={12} />} />
          )}
        </TableCell>
      </TableRow>

      {/* Linha expandida: tabela de viagens do bloco */}
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0, border: 'none', bgcolor: theme.palette.grey[50] }}>
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
                      <TableCell sx={{ fontWeight: 600 }}>Intervalo antes prox.</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedTrips.map((trip, idx) => {
                      const nextTrip = sortedTrips[idx + 1];
                      const gap = nextTrip ? nextTrip.startTimeMinutes - trip.endTimeMinutes : null;
                      const lineName = lines.find((l) => l.id === trip.lineId)?.code ?? `L${trip.lineId}`;
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
                            {gap != null ? (
                              <Chip
                                size="small"
                                label={minToDuration(gap)}
                                color={gap < CCT_MIN_BREAK_MIN ? 'error' : gap < 60 ? 'warning' : 'default'}
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
              {/* Nota de soltura e recolhimento */}
              {sortedTrips.length > 0 && (
                <Alert severity="info" icon={<IconBus size={14} />} sx={{ py: 0.5, mt: 0.5 }}>
                  <Typography variant="caption">
                    <strong>Soltura:</strong> saida do garagem antes da primeira viagem (
                    {minToHHMM(sortedTrips[0]?.startTimeMinutes)}) nao computada.
                    {' '}<strong>Recolhimento:</strong> retorno ao garagem apos a ultima viagem (
                    {minToHHMM(sortedTrips[sortedTrips.length - 1]?.endTimeMinutes)}) nao computado.
                    Acrescente ~15-40min na jornada real.
                  </Typography>
                </Alert>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ── Componente: linha colapsavel de plantao (Tab Por Tripulante) ─────────────
function DutyRow({
  duty, blocksMap, tripMap, lines,
}: {
  duty: DutyResult;
  blocksMap: Map<number, BlockResult>;
  tripMap: Map<number, TripDetail>;
  lines: Line[];
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const overHard = duty.spread_time > CCT_HARD_LIMIT_MIN;
  const overSoft = duty.spread_time > CCT_MAX_SHIFT_MIN;
  const cctColor: 'error' | 'warning' | 'success' = overHard ? 'error' : overSoft ? 'warning' : 'success';

  const myBlocks = duty.blocks.map((bid) => blocksMap.get(bid)).filter(Boolean) as BlockResult[];
  const allTripIds = duty.trip_ids ?? myBlocks.flatMap((b) => b.trips ?? []);
  const allTrips = allTripIds.map((tid) => tripMap.get(tid)).filter(Boolean) as TripDetail[];
  const sortedTrips = [...allTrips].sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);
  const startsAt = sortedTrips.length > 0 ? sortedTrips[0].startTimeMinutes : (myBlocks.length > 0 ? Math.min(...myBlocks.map((b) => b.start_time)) : null);
  const endsAt   = sortedTrips.length > 0 ? sortedTrips[sortedTrips.length - 1].endTimeMinutes : (myBlocks.length > 0 ? Math.max(...myBlocks.map((b) => b.end_time)) : null);

  // Indicador de horas trabalhadas
  const overtimeMin = duty.spread_time > CCT_MAX_SHIFT_MIN
    ? duty.spread_time - CCT_MAX_SHIFT_MIN : 0;

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
          <Chip size="small" label={`Tripulante P${duty.duty_id}`} color={cctColor} variant="filled"
            sx={{ fontWeight: 700, fontFamily: 'monospace' }} />
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
              {minToHHMM(startsAt)} -- {minToHHMM(endsAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Spread: {minToDuration(duty.spread_time)}
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
          </Box>
        </TableCell>
        <TableCell>
          <Chip size="small" label={
            overHard ? `VIOLACAO CCT (${minToDuration(duty.spread_time)})` :
            overSoft ? `Hora extra (${minToDuration(duty.spread_time)})` : 'Dentro do limite'
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
      </TableRow>

      {/* Linha expandida: blocos e viagens */}
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0, border: 'none', bgcolor: theme.palette.grey[50] }}>
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
                          color={gap < CCT_MIN_BREAK_MIN ? 'error' : 'default'}
                          variant="outlined" sx={{ fontSize: 10, mt: 0.25 }} />
                      )}
                    </Box>
                  );
                })}
              </Box>

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
                                color={gap < CCT_MIN_BREAK_MIN ? 'error' : gap < 60 ? 'warning' : 'default'}
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
                  <strong>Nota CCT:</strong> Spread calculado do inicio do primeiro bloco
                  ao fim do ultimo. Soltura (~15-40min) e recolhimento (~15-40min) NAO estao incluidos.
                  Na pratica a jornada real pode ser {minToDuration(30)} a {minToDuration(80)} maior.
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
  run, lines, fetchedTrips, open, onClose,
}: {
  run: OptimizationRun | null;
  lines: Line[];
  fetchedTrips: TripDetail[];
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  if (!run) return null;

  const res = run.resultSummary as unknown as OptResult | undefined;
  const failureDiagnostics = (run.resultSummary as any)?.diagnostics as
    | { summary?: string; hints?: string[]; currentSettings?: Record<string, any> }
    | undefined;
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
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconAlertTriangle color={theme.palette.error.main} />
            <Typography fontWeight={700}>Execucao #{run.id} -- Falhou</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 1 }}>
            <AlertTitle>Erro na otimizacao</AlertTitle>
            <Box sx={{ whiteSpace: 'pre-line' }}>
              {run.errorMessage ?? 'Erro desconhecido no processamento.'}
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
          {failureDiagnostics?.currentSettings ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <AlertTitle>Configuração usada nesta tentativa</AlertTitle>
              <Typography variant="body2">
                Algoritmo: {String(failureDiagnostics.currentSettings.algorithm ?? '--')} ·
                Linhas: {Array.isArray(failureDiagnostics.currentSettings.lineIds) ? failureDiagnostics.currentSettings.lineIds.join(', ') : '--'} ·
                Refeição: {failureDiagnostics.currentSettings.mealBreakMinutes ?? '--'} min ·
                Relief: {failureDiagnostics.currentSettings.allowReliefPoints ? 'ligado' : 'desligado'} ·
                Pairing: {failureDiagnostics.currentSettings.preservePreferredPairs ? 'ligado' : 'desligado'}
              </Typography>
            </Alert>
          ) : null}
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
  const dutyViolationsSpread = duties.filter((d) => d.spread_time > CCT_HARD_LIMIT_MIN);
  const dutyViolationsSoft   = duties.filter((d) => d.spread_time > CCT_MAX_SHIFT_MIN && d.spread_time <= CCT_HARD_LIMIT_MIN);
  const dutyViolationsRest   = duties.filter((d) => d.rest_violations > 0);
  const assignedBlockIds     = new Set(duties.flatMap((d) => d.blocks));
  const orphanBlocks         = blocks.filter((b) => !assignedBlockIds.has(b.block_id));

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
      PaperProps={{ sx: { height: '94vh', display: 'flex', flexDirection: 'column' } }}>
      <DialogTitle sx={{ pb: 0 }}>
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

      <DialogContent dividers sx={{ flex: 1, overflow: 'auto', pt: 2 }}>

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <Grid container spacing={2} mb={2}>
          {[
            { label: 'Veiculos (Blocos VSP)', value: res.vehicles, sub: `${blocks.length} blocos`, color: theme.palette.primary.main, icon: <IconBus size={18} /> },
            { label: 'Tripulantes (Plantoes CSP)', value: res.crew, sub: `${duties.length} plantoes`, color: theme.palette.success.main, icon: <IconUsers size={18} /> },
            { label: 'Viagens Otimizadas', value: allKnownTripIds.size, sub: `${fetchedTrips.length} carregadas`, color: theme.palette.info.main, icon: <IconRoute size={18} /> },
            { label: 'Custo Total', value: res.total_cost != null ? `R$ ${Number(res.total_cost).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '--', sub: 'estimado pelo algoritmo', color: theme.palette.warning.main, icon: <IconCurrencyDollar size={18} /> },
            { label: 'Tempo Processamento', value: res.elapsed_ms != null ? `${Math.round(res.elapsed_ms)}ms` : '--', sub: `VSP: ${res.vsp_algorithm} | CSP: ${res.csp_algorithm}`, color: theme.palette.grey[600], icon: <IconClock size={18} /> },
            { label: 'Violacoes CCT', value: dutyViolationsSpread.length + dutyViolationsSoft.length, sub: `${dutyViolationsSpread.length} graves, ${dutyViolationsSoft.length} hora extra`, color: (dutyViolationsSpread.length > 0 ? theme.palette.error.main : dutyViolationsSoft.length > 0 ? theme.palette.warning.main : theme.palette.success.main), icon: <IconAlertTriangle size={18} /> },
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
                    Plantao P{d.duty_id}: JORNADA EXCEDE LIMITE MAXIMO CCT ({minToDuration(d.spread_time)} {'>'} 10h)
                  </AlertTitle>
                  Spread: {minToDuration(d.spread_time)} | Trabalho efetivo: {minToDuration(d.work_time)} |
                  Excesso: {minToDuration(d.spread_time - CCT_HARD_LIMIT_MIN)}.
                  Blocos cobertos: {d.blocks.map((bid) => `B${bid}`).join(', ')}.
                  Nota: soltura e recolhimento nao incluidos -- jornada real ainda maior.
                </Alert>
              ))}
              {dutyViolationsSoft.map((d) => (
                <Alert key={d.duty_id} severity="warning" icon={<IconAlertTriangle size={16} />}>
                  <AlertTitle sx={{ fontWeight: 700 }}>
                    Plantao P{d.duty_id}: em hora extra ({minToDuration(d.spread_time)} entre 8h e 10h)
                  </AlertTitle>
                  Extra acima das 8h regulares: {minToDuration(d.spread_time - CCT_MAX_SHIFT_MIN)}.
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
              { label: 'Jornada maxima', value: `${CCT_MAX_SHIFT_MIN}min (8h)`, warn: false },
              { label: 'Hora extra maxima', value: `${CCT_MAX_OVERTIME_MIN}min (2h)`, warn: false },
              { label: 'Limite total jornada+extra', value: `${CCT_HARD_LIMIT_MIN}min (10h)`, warn: true },
              { label: 'Direcao continua maxima', value: `${CCT_MAX_DRIVING_MIN}min (4h30)`, warn: true },
              { label: 'Intervalo minimo entre blocos', value: `${CCT_MIN_BREAK_MIN}min`, warn: false },
              { label: 'Soltura/Recolhimento', value: 'NAO modelado (+15-40min)', warn: true },
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
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconBus size={14} /><span>Por Veiculo ({blocks.length} blocos)</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconUsers size={14} /><span>Por Tripulante ({duties.length} plantoes)</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconRoute size={14} /><span>Todas as Viagens ({allKnownTripIds.size})</span></Stack>} />
            <Tab label={<Stack direction="row" alignItems="center" gap={0.5}><IconChartBar size={14} /><span>Resumo Jornadas</span></Stack>} />
          </Tabs>
        </Box>

        {/* ── Tab 0: Por Veiculo ────────────────────────────────────────── */}
        {tab === 0 && (
          <Box>
            <Alert severity="info" icon={<IconBus size={16} />} sx={{ mb: 1.5, py: 0.5 }}>
              <Typography variant="body2">
                Cada linha e um <strong>veiculo/onibus</strong> (bloco VSP). Clique para expandir
                e ver <strong>todas as viagens</strong> que esse onibus realizara no dia, em ordem cronologica.
                A coluna &ldquo;Tripulante&rdquo; mostra qual plantao CSP cobre aquele bloco.
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
                    <TableCell sx={{ fontWeight: 700 }}>Status CCT</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {blocks.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
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
                          lines={lines}
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {duties.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
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
                { label: 'Dentro do limite (ate 8h)', count: duties.filter((d) => d.spread_time <= CCT_MAX_SHIFT_MIN).length, color: theme.palette.success.main },
                { label: 'Em hora extra (8h-10h)', count: duties.filter((d) => d.spread_time > CCT_MAX_SHIFT_MIN && d.spread_time <= CCT_HARD_LIMIT_MIN).length, color: theme.palette.warning.main },
                { label: 'Violacao grave (>10h)', count: duties.filter((d) => d.spread_time > CCT_HARD_LIMIT_MIN).length, color: theme.palette.error.main },
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
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Blocos</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Viagens</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>CCT</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Viol. Desc.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...duties].sort((a, b) => a.duty_id - b.duty_id).map((d) => {
                    const overHard = d.spread_time > CCT_HARD_LIMIT_MIN;
                    const overSoft = d.spread_time > CCT_MAX_SHIFT_MIN;
                    const myB = d.blocks.map((bid) => blocksMap.get(bid)).filter(Boolean) as BlockResult[];
                    const startsAt = myB.length > 0 ? Math.min(...myB.map((b) => b.start_time)) : null;
                    const endsAt   = myB.length > 0 ? Math.max(...myB.map((b) => b.end_time))   : null;
                    const totalTrips = myB.reduce((sum, b) => sum + (b.trips?.length ?? b.num_trips), 0);
                    const extraMin = d.spread_time > CCT_MAX_SHIFT_MIN ? d.spread_time - CCT_MAX_SHIFT_MIN : 0;
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
                        <TableCell align="center">
                          <Chip size="small" label={d.blocks.length} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={totalTrips} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small"
                            label={overHard ? 'VIOLACAO' : overSoft ? 'Hora extra' : 'OK'}
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
  const [launching, setLaunching] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [detailRun, setDetailRun] = useState<OptimizationRun | null>(null);
  const [fetchedTrips, setFetchedTrips] = useState<TripDetail[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
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
    setFetchedTrips([]);
    if (run.status !== 'completed') return;
    setLoadingTrips(true);
    try {
      const ids: number[] = (run as any).lineIds ?? (run.lineId ? [run.lineId] : []);
      if (!ids.length) return;
      const results = await Promise.all(
        ids.map((lid) => tripsApi.getAll({ lineId: lid }))
      );
      const all = results.flatMap((r) => extractArray(r)) as TripDetail[];
      setFetchedTrips(all);
    } catch {
      // silently -- trips nao carregados
    } finally {
      setLoadingTrips(false);
    }
  };

  const handleLaunch = async () => {
    if (!selectedLineIds.length) {
      notify.warning('Selecione pelo menos uma linha para otimizar.');
      return;
    }
    setLaunching(true);
    try {
      const user = getSessionUser();
      const payload: any = {
        companyId: user?.companyId ?? 1,
        algorithm,
        ...(maxVehicles ? { vspParams: { maxVehicles: parseInt(maxVehicles) } } : {}),
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

  return (
    <PageContainer title="Otimizacao -- OTIMIZ" description="Engine de otimizacao VSP/CSP">
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={700} lineHeight={1}>Motor de Otimizacao</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Programacao de veiculos (VSP) e tripulantes (CSP) -- suporte a multiplas linhas
            </Typography>
          </Box>
          <Tooltip title="Recarregar">
            <IconButton onClick={loadRuns} size="small"><IconRefresh size={18} /></IconButton>
          </Tooltip>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.08) 100%)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2}>
            <Box>
              <Stack direction="row" alignItems="center" gap={1} mb={0.75}>
                <IconSettings size={18} color={theme.palette.primary.main} />
                <Typography variant="subtitle1" fontWeight={800}>Configuração ativa da execução</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={1.25}>
                {activeSettings?.name
                  ? `${activeSettings.name} · ${activeSettings.description || 'perfil principal para solver e regras operacionais.'}`
                  : 'Nenhum perfil ativo encontrado. Configure um preset para usar todas as regras avançadas.'}
              </Typography>
              {activeSettings ? <OptimizationSettingsHighlights settings={activeSettings} /> : null}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button variant="outlined" startIcon={<IconSettings size={16} />} onClick={openOptimizationSettingsDrawer}>
                Configuração rápida
              </Button>
              <Button variant="contained" href="/otimiz/settings">
                Gerenciar perfis
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* KPIs */}
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Execucoes', value: stats.total,     color: theme.palette.primary.main },
            { label: 'Concluidas', value: stats.completed, color: theme.palette.success.main },
            { label: 'Erros',      value: stats.failed,    color: theme.palette.error.main },
            {
              label: 'Melhor custo',
              value: stats.bestCost != null
                ? `R$ ${stats.bestCost.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                : '--',
              color: theme.palette.warning.main,
            },
          ].map(({ label, value, color }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color }}>{value}</Typography>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
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
            <DashboardCard title="Nova Execucao" action={<IconPlayerPlay size={20} />}>
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
                  helperText="Deixe em branco para o sistema calcular"
                  inputProps={{ min: 1 }}
                />

                <Divider />

                {activeSettings && (
                  <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    <Typography variant="caption">
                      Esta execução usará o perfil ativo <strong>{activeSettings.name || `#${activeSettings.id}`}</strong> no backend,
                      incluindo regras CCT, set covering, pricing e parâmetros de energia. O campo abaixo apenas limita a frota desta execução.
                    </Typography>
                  </Alert>
                )}

                <Button
                  variant="contained" size="large" fullWidth
                  startIcon={<IconPlayerPlay size={18} />}
                  onClick={handleLaunch}
                  disabled={launching || !selectedLineIds.length || !!activeRun}
                  sx={{ fontWeight: 700 }}
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
            <DashboardCard title={`Historico de Execucoes (${runs.length})`}>
              <>
                {loading ? (
                  <Box>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
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
                            sx={r.status === 'running' ? { bgcolor: 'warning.lighter' } : undefined}>
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
                                    <IconButton size="small" color="primary" onClick={() => openDetail(r)}>
                                      <IconEye size={16} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {(r.status === 'running' || r.status === 'pending') && (
                                  <Tooltip title="Cancelar">
                                    <IconButton size="small" color="error" disabled={cancelling === r.id}
                                      onClick={() => handleCancel(r.id)}>
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
        open={!!detailRun}
        onClose={() => { setDetailRun(null); setFetchedTrips([]); }}
      />
    </PageContainer>
  );
}

export default function OptimizationPage() {
  return <NotifyProvider><OptimizationInner /></NotifyProvider>;
}
