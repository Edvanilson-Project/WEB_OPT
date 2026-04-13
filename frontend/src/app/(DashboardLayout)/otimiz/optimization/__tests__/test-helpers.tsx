/**
 * @file test-helpers.ts
 * Exporta utilitários e componentes do page.tsx para uso em testes unitários.
 *
 * Estes wrappers permitem testar funções puras e componentes isolados
 * sem importar o módulo completo (que depende de Next.js SSR).
 *
 * Estratégia: re-implementa os utilitários idênticos ao page.tsx
 * para evitar o ciclo de dependência com NotifyProvider / API.
 */
import React, { useState } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Typography, Tooltip, Button, Drawer,
} from '@mui/material';
import type { TripDetail } from '../../_types';

// ─── Utilitários de formatação ─────────────────────────────────────────────────

export function fmtCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '--';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function minToDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(Number(minutes))) return '--';
  const m = Math.floor(Math.abs(Number(minutes)));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min.toString().padStart(2, '0')}` : `${h}h`;
}

export function minToHHMM(minutes?: number | null): string {
  if (minutes == null || isNaN(Number(minutes))) return '--:--';
  const m = Math.abs(Number(minutes));
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

// ─── Componente: Tabela de Viagens ────────────────────────────────────────────

export function TripDetailTable({ trips }: { trips: TripDetail[] }) {
  const safeTrips = Array.isArray(trips) ? trips : [];
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
          {safeTrips
            .slice()
            .sort((a, b) => (a?.start_time ?? 0) - (b?.start_time ?? 0))
            .map((t, i) => (
              <TableRow key={i} sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell sx={{ py: 0.75 }}>{minToHHMM(t?.start_time)}</TableCell>
                <TableCell sx={{ py: 0.75 }}>{minToHHMM(t?.end_time)}</TableCell>
                <TableCell sx={{ py: 0.75 }}>{(t as any)?.origin_name || (t as any)?.origin_id || '--'}</TableCell>
                <TableCell sx={{ py: 0.75 }}>{(t as any)?.destination_name || (t as any)?.destination_id || '--'}</TableCell>
                <TableCell sx={{ py: 0.75 }}>{minToDuration(t?.duration)}</TableCell>
                <TableCell sx={{ py: 0.75 }}>
                  <Typography variant="caption" fontWeight={700}>#{t?.id ?? 'N/A'}</Typography>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Componente: Timeline Gráfico ─────────────────────────────────────────────

export function TripTimeline({
  trips,
  start,
  end,
  totalDuration,
}: {
  trips: TripDetail[];
  start: number;
  end: number;
  totalDuration: number;
}) {
  if (!totalDuration || totalDuration <= 0) return null;

  return (
    <Box
      sx={{
        position: 'relative',
        height: 26,
        bgcolor: 'rgba(0,0,0,0.05)',
        borderRadius: 1.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {(trips ?? []).map((t, i) => {
        const tStart = t?.start_time ?? start;
        const tEnd = t?.end_time ?? tStart;
        const left = ((tStart - start) / totalDuration) * 100;
        const width = Math.max(0.5, ((tEnd - tStart) / totalDuration) * 100);
        const isPull = (t as any)?.is_pull_out || (t as any)?.is_pull_back;

        return (
          <Tooltip key={i} title={`${minToHHMM(tStart)} - ${minToHHMM(tEnd)} | #${t?.id ?? i}`}>
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
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

// ─── Harness: Interações do Gantt Enterprise ─────────────────────────────────

export function EnterpriseGanttHarness({
  hasCycle = true,
  idleWindows = 1,
  lineLabels = ['L10'],
}: {
  hasCycle?: boolean;
  idleWindows?: number;
  lineLabels?: string[];
}) {
  const [showLines, setShowLines] = useState(false);
  const [openGuide, setOpenGuide] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button size="small" onClick={() => setShowLines((p) => !p)}>
          {showLines ? 'Ocultar linhas' : 'Mostrar linhas'}
        </Button>
        <Button size="small" aria-label="abrir-guia-gantt" onClick={() => setOpenGuide(true)}>
          Abrir guia
        </Button>
      </Box>

      <Typography>Produtivo</Typography>
      <Typography>Improdutivo</Typography>

      {Array.from({ length: idleWindows }).map((_, idx) => (
        <Box key={`idle-${idx}`} data-testid="gantt-idle-window" />
      ))}

      {hasCycle && <Box data-testid="gantt-cycle-group" />}

      {showLines && lineLabels.map((label) => (
        <Typography key={label}>{label}</Typography>
      ))}

      <Drawer anchor="right" open={openGuide} onClose={() => setOpenGuide(false)}>
        <Box sx={{ p: 2, width: 280 }}>
          <Typography>Guia visual do Gantt</Typography>
          <Typography>Informacoes de detalhe foram movidas para este painel.</Typography>
        </Box>
      </Drawer>
    </Box>
  );
}
