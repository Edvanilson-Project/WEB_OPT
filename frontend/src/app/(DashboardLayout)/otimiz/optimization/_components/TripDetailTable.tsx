'use client';
import React from 'react';
import {
  Box, Typography, Chip, Paper,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import type { TripDetail } from '../../_types';
import {
  minToHHMM, minToDuration, directionLabel,
  getTripIntervalClassificationLabel, getTripIntervalClassificationColor,
  getTerminalDisplayName, getTripPublicId,
  type TripIntervalPolicy, type TripIntervalViewScope,
} from '../_helpers/formatters';
import {
  buildTripIntervalDisplayRow,
  type DutyTripAssignment,
  type TripIntervalDisplayRow,
} from '../_helpers/trip-intervals';
import { thSx, tdCompactSx } from './shared';

export function TripDetailTable({
  trips,
  dutyId,
  linesMap = {},
  terminalsMap = {},
  windowStart,
  windowEnd,
  intervalPolicy,
  viewScope,
  defaultAssignment,
  dutyAssignmentsByPublicTripId,
  mealBreakIntervalKeys,
  extraColumnLabel,
  renderExtraColumn,
}: {
  trips: TripDetail[];
  dutyId?: string | number;
  linesMap?: Record<string, string>;
  terminalsMap?: Record<string, string>;
  windowStart?: number | null;
  windowEnd?: number | null;
  intervalPolicy: TripIntervalPolicy;
  viewScope: TripIntervalViewScope;
  defaultAssignment?: DutyTripAssignment | null;
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>;
  mealBreakIntervalKeys?: Set<string>;
  extraColumnLabel?: string;
  renderExtraColumn?: (trip: TripDetail) => React.ReactNode;
}) {
  const sorted = trips.slice().sort((a,b) => (a.start_time ?? 0) - (b.start_time ?? 0));
  const firstTrip = sorted[0];
  const lastTrip = sorted[sorted.length - 1];
  const initialGap =
    windowStart != null && firstTrip?.start_time != null ? Math.max(0, firstTrip.start_time - windowStart) : 0;
  const finalGap =
    windowEnd != null && lastTrip?.end_time != null ? Math.max(0, windowEnd - lastTrip.end_time) : 0;

  const rows: Array<
    | { key: string; kind: 'interval'; interval: TripIntervalDisplayRow }
    | { key: string; kind: 'trip'; trip: TripDetail }
  > = [];

  if (initialGap > 0 && firstTrip && windowStart != null) {
    const initialInterval = buildTripIntervalDisplayRow({
      start: windowStart,
      end: firstTrip.start_time,
      nextTrip: firstTrip,
      boundaryKind: 'initial',
      policy: intervalPolicy,
      viewScope,
      defaultAssignment,
      dutyAssignmentsByPublicTripId,
      mealBreakIntervalKeys,
    });
    if (initialInterval) {
      rows.push({
        key: `interval-initial-${dutyId ?? 'window'}-${getTripPublicId(firstTrip) ?? firstTrip.id}`,
        kind: 'interval',
        interval: initialInterval,
      });
    }
  }

  sorted.forEach((trip, index) => {
    if (index > 0) {
      const previousTrip = sorted[index - 1];
      const internalInterval = buildTripIntervalDisplayRow({
        start: previousTrip.end_time,
        end: trip.start_time,
        previousTrip,
        nextTrip: trip,
        policy: intervalPolicy,
        viewScope,
        defaultAssignment,
        dutyAssignmentsByPublicTripId,
        mealBreakIntervalKeys,
      });
      if (internalInterval) {
        rows.push({
          key: `interval-${previousTrip.id}-${trip.id}-${index}`,
          kind: 'interval',
          interval: internalInterval,
        });
      }
    }

    rows.push({
      key: `trip-${trip.id}-${index}`,
      kind: 'trip',
      trip,
    });
  });

  if (finalGap > 0 && lastTrip && windowEnd != null) {
    const finalInterval = buildTripIntervalDisplayRow({
      start: lastTrip.end_time,
      end: windowEnd,
      previousTrip: lastTrip,
      boundaryKind: 'final',
      policy: intervalPolicy,
      viewScope,
      defaultAssignment,
      dutyAssignmentsByPublicTripId,
      mealBreakIntervalKeys,
    });
    if (finalInterval) {
      rows.push({
        key: `interval-final-${dutyId ?? 'window'}-${getTripPublicId(lastTrip) ?? lastTrip.id}`,
        kind: 'interval',
        interval: finalInterval,
      });
    }
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 1, maxHeight: 300 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Tipo</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Duração</TableCell>
            {renderExtraColumn && <TableCell sx={{ py: 1, fontWeight: 700 }}>{extraColumnLabel || 'Alocação'}</TableCell>}
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Registro</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            if (row.kind === 'interval') {
              const { interval } = row;
              return (
                <TableRow key={row.key} sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={tdCompactSx}>
                    <Chip
                      size="small"
                      color={getTripIntervalClassificationColor(interval.classification)}
                      variant="outlined"
                      label={getTripIntervalClassificationLabel(interval.classification)}
                      sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 10, fontWeight: 700 } }}
                    />
                  </TableCell>
                  <TableCell sx={tdCompactSx}>{minToHHMM(interval.start)}</TableCell>
                  <TableCell sx={tdCompactSx}>{minToHHMM(interval.end)}</TableCell>
                  <TableCell sx={tdCompactSx}>
                    <Typography variant="caption" display="block">
                      {getTerminalDisplayName(interval.originId, interval.originName, terminalsMap)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tdCompactSx}>
                    <Typography variant="caption" display="block">
                      {getTerminalDisplayName(interval.destinationId, interval.destinationName, terminalsMap)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tdCompactSx}>{minToDuration(interval.duration)}</TableCell>
                  {renderExtraColumn && (
                    <TableCell sx={tdCompactSx}>
                      <Typography variant="caption" color="text.secondary">--</Typography>
                    </TableCell>
                  )}
                  <TableCell sx={tdCompactSx}>
                    <Typography variant="caption" fontWeight={700} display="block">{interval.recordLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">{interval.recordHint}</Typography>
                  </TableCell>
                </TableRow>
              );
            }

            const t = row.trip;
            const publicTripId = getTripPublicId(t) ?? t.id;
            const isSegmented = (t.segment_count ?? 1) > 1;

            return (
              <TableRow key={row.key} sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell sx={tdCompactSx}>
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label="Viagem"
                    sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 10, fontWeight: 700 } }}
                  />
                </TableCell>
                <TableCell sx={tdCompactSx}>{minToHHMM(t.start_time)}</TableCell>
                <TableCell sx={tdCompactSx}>{minToHHMM(t.end_time)}</TableCell>
                <TableCell sx={tdCompactSx}>
                  <Typography variant="caption" display="block">{getTerminalDisplayName(t.origin_id, t.origin_name, terminalsMap)}</Typography>
                  {t.line_id && <Chip size="small" label={linesMap[t.line_id] || String(t.line_id)} sx={{ height: 16, fontSize: 9 }} />}
                  {t.direction && <Typography variant="caption" color="text.secondary" ml={0.5}>{directionLabel(t.direction)}</Typography>}
                </TableCell>
                <TableCell sx={tdCompactSx}>
                  <Typography variant="caption" display="block">{getTerminalDisplayName(t.destination_id, t.destination_name, terminalsMap)}</Typography>
                </TableCell>
                <TableCell sx={tdCompactSx}>{minToDuration(t.duration)}</TableCell>
                {renderExtraColumn && <TableCell sx={tdCompactSx}>{renderExtraColumn(t)}</TableCell>}
                <TableCell sx={tdCompactSx}>
                  <Typography variant="caption" fontWeight={700} display="block">#{publicTripId}</Typography>
                  {isSegmented && (
                    <Typography variant="caption" color="text.secondary">
                      Segmento {(t.segment_index ?? 0) + 1}/{t.segment_count}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
