'use client';
import React, { useState, useMemo } from 'react';
import {
  Box, Grid, Typography, Stack, Chip, Divider, Paper, Collapse,
  IconButton, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  alpha, useTheme,
} from '@mui/material';
import {
  IconUsers, IconAlertTriangle, IconChevronDown, IconChevronUp, IconCheck,
} from '@tabler/icons-react';
import type {
  Line, Terminal, OptimizationResultSummary, OptimizationDuty, TripDetail,
} from '../../_types';
import {
  asRecord, fmtCurrency, minToHHMM, minToDuration,
  getDutyDisplayWindow,
  type TripIntervalPolicy,
} from '../_helpers/formatters';
import { TripDetailTable } from './TripDetailTable';
import { thSx } from './shared';

export function TabOverview({
  res,
  lines,
  terminals,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  res: OptimizationResultSummary;
  lines: Line[];
  terminals: Terminal[];
  intervalPolicy: TripIntervalPolicy;
  mealBreakIntervalKeys: Set<string>;
}) {
  const duties = res.duties || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
  if (!duties.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem jornadas geradas nesta execução.</Typography>;

  return (
    <Box sx={{ animation: 'fadeIn 0.3s ease-out' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
            {duties.length} Escalas de Trabalho
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            Análise detalhada de jornadas, custos e conformidade CCT
          </Typography>
        </Box>
        <Chip 
          label="Clique para expandir" 
          size="small" 
          variant="outlined" 
          icon={<IconChevronDown size={14} />} 
          sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.8 }} 
        />
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ 
        borderRadius: 4, 
        maxHeight: 650, 
        border: '1px solid', 
        borderColor: 'divider',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>ID</TableCell>
              <TableCell sx={thSx}>Horário</TableCell>
              <TableCell sx={thSx}>Duração</TableCell>
              <TableCell sx={thSx}>Viagens</TableCell>
              <TableCell sx={thSx}>Custo Total</TableCell>
              <TableCell sx={thSx}>Alertas</TableCell>
              <TableCell sx={{ width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {duties.map((duty, idx) => (
              <DutyTableRow
                key={duty.duty_id ?? idx}
                duty={duty}
                linesMap={linesMap}
                terminalsMap={terminalsMap}
                intervalPolicy={intervalPolicy}
                mealBreakIntervalKeys={mealBreakIntervalKeys}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function DutyTableRow({
  duty,
  linesMap,
  terminalsMap,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  duty: OptimizationDuty,
  linesMap: Record<string,string>,
  terminalsMap: Record<string,string>,
  intervalPolicy: TripIntervalPolicy,
  mealBreakIntervalKeys: Set<string>,
}) {
  const [open, setOpen] = useState(false);
  const maxShift = 900;
  const hasViolation = duty.spread_time > maxShift || (duty.cct_penalties_cost ?? 0) > 0 || (duty.rest_violations ?? 0) > 0;
  const hasOvertime = (duty.overtime_cost ?? 0) > 0 || (duty.overtime_minutes ?? 0) > 0;
  const dutyMeta = asRecord(duty.meta);
  const dutyWindow = getDutyDisplayWindow(duty);
  const dutyDuration =
    dutyWindow.start != null && dutyWindow.end != null && dutyWindow.end >= dutyWindow.start
      ? dutyWindow.end - dutyWindow.start
      : duty.spread_time;

  const theme = useTheme();

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen(!open)}
        sx={{
          cursor: 'pointer',
          transition: 'all 0.2s',
          '& > *': { borderBottom: '1px solid !important', borderColor: 'rgba(0,0,0,0.04) !important' },
          bgcolor: hasViolation ? alpha(theme.palette.error.main, 0.04) : 'inherit',
          '&:hover': {
            bgcolor: hasViolation ? alpha(theme.palette.error.main, 0.08) : alpha(theme.palette.primary.main, 0.02),
          }
        }}
      >
        <TableCell sx={{ pl: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ 
              width: 32, height: 32, borderRadius: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: hasViolation ? 'error.main' : 'success.main',
              color: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {hasViolation ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={800} sx={{ color: 'text.primary' }}>
                Plantão #{duty.duty_id}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                {hasViolation ? 'PENDÊNCIAS CCT' : 'CONFORMIDADE TOTAL'}
              </Typography>
            </Box>
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={700} color="text.primary">
            {minToHHMM(dutyWindow.start)} — {minToHHMM(dutyWindow.end)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600} color="text.secondary">
            {minToDuration(dutyDuration)}
          </Typography>
        </TableCell>
        <TableCell>
           <Chip 
            label={`${duty.trips?.length || 0} trips`} 
            size="small" 
            sx={{ fontWeight: 800, fontSize: '0.65rem', bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main', borderRadius: 1 }} 
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={900} sx={{ fontSize: '0.9rem', color: hasViolation ? 'error.main' : 'primary.main' }}>
            {fmtCurrency(duty.total_cost || duty.work_cost)}
          </Typography>
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {hasViolation && (
              <Chip 
                size="small" label="VIOLAÇÃO" 
                sx={{ height: 18, fontSize: 9, fontWeight: 900, bgcolor: 'error.main', color: '#fff', borderRadius: 0.5 }} 
              />
            )}
            {hasOvertime && (
              <Chip 
                size="small" label="HE" 
                sx={{ height: 18, fontSize: 9, fontWeight: 900, bgcolor: 'warning.main', color: '#fff', borderRadius: 0.5 }} 
              />
            )}
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7, alignSelf: 'center' }}>
               {minToDuration(duty.work_time)} prod.
            </Typography>
          </Stack>
        </TableCell>
        <TableCell align="right" sx={{ pr: 3 }}>
          <IconButton size="small" sx={{ bgcolor: open ? 'action.selected' : 'transparent' }}>
            {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell sx={{ p: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 4, bgcolor: alpha(theme.palette.primary.main, 0.01), borderBottom: '1px solid', borderColor: 'divider' }}>
              <Grid container spacing={4}>
                <Grid item xs={12} md={8.5}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                    <IconUsers size={20} color={theme.palette.primary.main} />
                    <Typography variant="subtitle1" fontWeight={900}>Detalhamento do Plantão</Typography>
                  </Stack>
                  {duty.trips && duty.trips.length > 0 && (
                    <TripDetailTable
                      trips={duty.trips as TripDetail[]}
                      dutyId={duty.duty_id}
                      linesMap={linesMap}
                      terminalsMap={terminalsMap}
                      windowStart={dutyWindow.start}
                      windowEnd={dutyWindow.end}
                      intervalPolicy={intervalPolicy}
                      viewScope="crew"
                      defaultAssignment={{
                        dutyId: duty.duty_id,
                        rosterId: dutyMeta?.roster_id ?? null,
                        operatorId: dutyMeta?.operator_id ?? null,
                        operatorName: dutyMeta?.operator_name ?? null,
                      }}
                      mealBreakIntervalKeys={mealBreakIntervalKeys}
                      extraColumnLabel="Veículo"
                      renderExtraColumn={(trip) => {
                        const blockId = trip.block_id;
                        return blockId != null
                          ? <Chip size="small" label={`V${blockId}`} sx={{ height: 20, fontWeight: 800, borderRadius: 1 }} />
                          : <Typography variant="caption" color="text.secondary">--</Typography>;
                      }}
                    />
                  )}
                </Grid>
                <Grid item xs={12} md={3.5}>
                  <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 2, textTransform: 'uppercase', fontSize: '0.7rem', color: 'text.secondary', letterSpacing: 1 }}>Composição de Custos</Typography>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.paper', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
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
