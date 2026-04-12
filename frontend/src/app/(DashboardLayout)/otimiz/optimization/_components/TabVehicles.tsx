'use client';
import React, { useState, useMemo } from 'react';
import {
  Box, Grid, Typography, Stack, Chip, Paper, Collapse,
  IconButton, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import {
  IconBus, IconChevronDown, IconChevronUp,
} from '@tabler/icons-react';
import type {
  Line, Terminal, OptimizationResultSummary, OptimizationBlock, TripDetail,
} from '../../_types';
import {
  fmtCurrency, minToHHMM, minToDuration,
  getBlockDisplayWindow, getTripPublicId,
  type TripIntervalPolicy,
} from '../_helpers/formatters';
import {
  type DutyTripAssignment,
} from '../_helpers/trip-intervals';
import { TripDetailTable } from './TripDetailTable';
import { thSx } from './shared';

export function TabVehicles({
  res,
  lines,
  terminals,
  dutyAssignmentsByPublicTripId,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  res: OptimizationResultSummary;
  lines: Line[];
  terminals: Terminal[];
  dutyAssignmentsByPublicTripId: Record<number, DutyTripAssignment[]>;
  intervalPolicy: TripIntervalPolicy;
  mealBreakIntervalKeys: Set<string>;
}) {
  const blocks = res.blocks || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
  if (!blocks.length) return <Typography color="text.secondary" py={4} textAlign="center">Sem dados de alocação veicular disponíveis.</Typography>;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>{blocks.length} Blocos de Veículo</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>Veículo</TableCell>
              <TableCell sx={thSx}>Saída / Retorno</TableCell>
              <TableCell sx={thSx}>Viagens</TableCell>
              <TableCell sx={thSx}>Duração</TableCell>
              <TableCell sx={thSx}>Distância</TableCell>
              <TableCell sx={thSx}>Custo</TableCell>
              <TableCell sx={{ width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {blocks.map((block, idx) => (
              <VehicleTableRow
                key={block.block_id ?? idx}
                block={block}
                linesMap={linesMap}
                terminalsMap={terminalsMap}
                dutyAssignmentsByPublicTripId={dutyAssignmentsByPublicTripId}
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

function VehicleTableRow({
  block,
  linesMap,
  terminalsMap,
  dutyAssignmentsByPublicTripId,
  intervalPolicy,
  mealBreakIntervalKeys,
}: {
  block: OptimizationBlock | Record<string, any>,
  linesMap: Record<string,string>,
  terminalsMap: Record<string,string>,
  dutyAssignmentsByPublicTripId: Record<number, DutyTripAssignment[]>,
  intervalPolicy: TripIntervalPolicy,
  mealBreakIntervalKeys: Set<string>,
}) {
  const [open, setOpen] = useState(false);
  const blockWindow = getBlockDisplayWindow(block);
  const totalDur =
    blockWindow.start != null && blockWindow.end != null
      ? Math.max(0, blockWindow.end - blockWindow.start)
      : (block.end_time ?? 0) - (block.start_time ?? 0);

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
          <Typography variant="body2" fontWeight={600}>{minToHHMM(blockWindow.start)} → {minToHHMM(blockWindow.end)}</Typography>
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
                  <TripDetailTable
                   trips={block.trips as TripDetail[]}
                   linesMap={linesMap}
                   terminalsMap={terminalsMap}
                   windowStart={blockWindow.start}
                   windowEnd={blockWindow.end}
                   intervalPolicy={intervalPolicy}
                   viewScope="vehicle"
                   dutyAssignmentsByPublicTripId={dutyAssignmentsByPublicTripId}
                   mealBreakIntervalKeys={mealBreakIntervalKeys}
                   extraColumnLabel="Tripulante"
                   renderExtraColumn={(trip) => {
                     const assignments = dutyAssignmentsByPublicTripId[getTripPublicId(trip) ?? -1] ?? [];
                     if (!assignments.length) {
                       return <Typography variant="caption" color="text.secondary">--</Typography>;
                     }

                     return (
                       <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                         {assignments.map((assignment, index) => {
                           const primaryLabel = assignment.operatorId != null
                             ? `Trip. #${assignment.operatorId}`
                             : assignment.dutyId != null
                               ? `Plantão #${assignment.dutyId}`
                               : 'Sem escala';
                           const rosterLabel = assignment.rosterId != null ? `Escala #${assignment.rosterId}` : null;
                           return (
                             <React.Fragment key={`${assignment.dutyId ?? 'd'}-${assignment.rosterId ?? 'r'}-${index}`}>
                               <Chip size="small" color="success" variant="outlined" label={primaryLabel} sx={{ height: 20 }} />
                               {rosterLabel && <Chip size="small" variant="outlined" label={rosterLabel} sx={{ height: 20 }} />}
                               {assignment.operatorName && (
                                 <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                   {assignment.operatorName}
                                 </Typography>
                               )}
                             </React.Fragment>
                           );
                         })}
                       </Stack>
                     );
                   }}
                  />
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
