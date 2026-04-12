'use client';
import React, { useMemo } from 'react';
import {
  Box, Typography, Stack, Chip, Alert, AlertTitle,
  Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import {
  IconShieldCheck, IconAlertTriangle,
} from '@tabler/icons-react';
import type {
  Line, Terminal, OptimizationResultSummary, OptimizationStructuredIssue, TripDetail,
} from '../../_types';
import { thSx } from './shared';

export function TabAlerts({ res, lines, terminals }: { res: OptimizationResultSummary; lines: Line[]; terminals: Terminal[] }) {
  const warningsRaw = res.warnings || [];
  const warnings = Array.isArray(warningsRaw) ? (warningsRaw as (string | OptimizationStructuredIssue)[]).map(w => typeof w === 'string' ? w : w.message) : [];
  const unassigned = res.unassigned_trips || [];
  const violations = res.cct_violations ?? res.cctViolations ?? 0;
  const duties = res.duties || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);
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
                  <TableCell sx={thSx}>Detalhe</TableCell>
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
