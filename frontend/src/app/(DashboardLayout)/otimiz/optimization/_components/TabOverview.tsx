'use client';
import React, { useState, useMemo } from 'react';
import {
  Box, Grid, Typography, Stack, Chip, Divider, Paper, Collapse,
  IconButton, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
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
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="subtitle1" fontWeight={700}>{duties.length} Escalas de Trabalho Geradas</Typography>
        <Typography variant="caption" color="text.secondary">Clique em uma linha para detalhes</Typography>
      </Stack>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 600 }}>
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
            <Chip
              size="small"
              icon={<IconUsers size={14} />}
              label={hasViolation ? 'Risco' : 'OK'}
              color={hasViolation ? 'error' : 'success'}
              variant="outlined"
              sx={{ height: 22 }}
            />
            <Typography variant="body2" fontWeight={700}>Plantão #{duty.duty_id}</Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600}>{minToHHMM(dutyWindow.start)} → {minToHHMM(dutyWindow.end)}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{minToDuration(dutyDuration)}</Typography>
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
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {hasViolation && <Chip size="small" color="error" label="Violação" sx={{ height: 18, fontSize: 10 }} />}
            {hasOvertime && <Chip size="small" color="warning" label="HE" sx={{ height: 18, fontSize: 10 }} />}
            {!hasViolation && !hasOvertime && <IconCheck size={16} color="green" />}
            <Chip size="small" variant="outlined" label={`${minToDuration(duty.work_time)} úteis`} sx={{ height: 18, fontSize: 10 }} />
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
                      extraColumnLabel="Ônibus"
                      renderExtraColumn={(trip) => {
                        const blockId = trip.block_id;
                        return blockId != null
                          ? <Chip size="small" label={`Ônibus #${blockId}`} sx={{ height: 20 }} />
                          : <Typography variant="caption" color="text.secondary">--</Typography>;
                      }}
                    />
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
