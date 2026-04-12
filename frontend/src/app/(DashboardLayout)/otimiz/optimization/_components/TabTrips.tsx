'use client';
import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Stack, Chip, Button,
  Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import type {
  Line, Terminal, OptimizationResultSummary, TripDetail,
} from '../../_types';
import {
  minToHHMM, directionLabel,
} from '../_helpers/formatters';
import { thSx } from './shared';

export function TabTrips({ res, lines, terminals }: { res: OptimizationResultSummary, lines: Line[], terminals: Terminal[] }) {
  const blocks = res.blocks || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
  const unassigned = res.unassigned_trips || [];
  
  const duties = res.duties || [];
  
  // Maps trip ID to duty ID and block ID
  const tripToDuty: Record<number, number | string> = {};
  duties.forEach(d => {
    (d.trips || []).forEach(t => {
      const tripId = typeof t === 'object' ? t.id : t;
      tripToDuty[tripId as number] = d.duty_id;
    });
  });

  const tripToBlock: Record<number, number | string> = {};
  blocks.forEach(b => {
    (b.trips || []).forEach(t => {
      const tripId = typeof t === 'object' ? t.id : t;
      tripToBlock[tripId as number] = b.block_id;
    });
  });

  const allTripObjects = new Map<number, any>();
  
  // Collect from blocks
  blocks.forEach(b => {
    (b.trips || []).forEach(t => {
      if (typeof t !== 'number') allTripObjects.set(t.id, t);
    });
  });
  // Collect from duties
  duties.forEach(d => {
    (d.trips || []).forEach(t => {
      if (typeof t !== 'number') allTripObjects.set(t.id, t);
    });
  });

  const assignedTrips = Array.from(allTripObjects.values()).map(t => ({
    ...t,
    status: 'assigned',
    duty_id: tripToDuty[t.id] ?? t.duty_id,
    block_id: tripToBlock[t.id] ?? t.block_id,
  }));

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
              <TableCell sx={thSx}>ID</TableCell>
              <TableCell sx={thSx} align="center">Status</TableCell>
              <TableCell sx={thSx}>Veículo</TableCell>
              <TableCell sx={thSx}>Início</TableCell>
              <TableCell sx={thSx}>Fim</TableCell>
              <TableCell sx={thSx}>Linha</TableCell>
              <TableCell sx={thSx}>Sentido</TableCell>
              <TableCell sx={thSx}>Origem</TableCell>
              <TableCell sx={thSx}>Destino</TableCell>
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
                <TableCell>{linesMap[t.line_id] || t.line_id || '--'}</TableCell>
                <TableCell>{t.direction === 'outbound' ? 'Ida' : t.direction === 'inbound' ? 'Volta' : (t.direction as string) || '--'}</TableCell>
                <TableCell>{terminalsMap[t.origin_id] || t.origin_name || t.origin_id || '--'}</TableCell>
                <TableCell>{terminalsMap[t.destination_id] || t.destination_name || t.destination_id || '--'}</TableCell>
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
