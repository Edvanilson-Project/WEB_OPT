'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Grid, Typography, Stack, Chip, Divider, LinearProgress, Alert,
  TextField, MenuItem, Paper,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import type {
  OptimizationRun, OptimizationResultSummary,
  OptimizationRunAudit, OptimizationRunComparison,
  OptimizationPerformance, OptimizationReproducibility,
} from '../../_types';
import { optimizationApi } from '@/lib/api';
import {
  fmtNumber, labelizeKey, formatComparisonValue, readReproValue,
} from '../_helpers/formatters';
import { ComparisonDeltaCell, thSx } from './shared';

export function TabAudit({ run, allRuns }: { run: OptimizationRun; allRuns: OptimizationRun[] }) {
  const [audit, setAudit] = useState<OptimizationRunAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string>('');
  const [comparison, setComparison] = useState<OptimizationRunComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const comparableRuns = useMemo(
    () =>
      allRuns
        .filter((candidate) => candidate.id !== run.id && candidate.status === 'completed')
        .slice(0, 20),
    [allRuns, run.id],
  );

  useEffect(() => {
    let active = true;
    setAuditLoading(true);
    setAuditError(null);

    optimizationApi
      .getAudit(run.id)
      .then((data) => {
        if (active) setAudit(data as OptimizationRunAudit);
      })
      .catch(() => {
        if (active) {
          setAudit(null);
          setAuditError('Nao foi possivel carregar a auditoria detalhada desta execucao.');
        }
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });

    return () => {
      active = false;
    };
  }, [run.id]);

  useEffect(() => {
    if (!comparableRuns.length || run.status !== 'completed') {
      setCompareTargetId('');
      return;
    }

    setCompareTargetId((current) =>
      current && comparableRuns.some((candidate) => String(candidate.id) === current)
        ? current
        : String(comparableRuns[0].id),
    );
  }, [comparableRuns, run.status]);

  useEffect(() => {
    if (!compareTargetId || run.status !== 'completed') {
      setComparison(null);
      setCompareError(null);
      return;
    }

    let active = true;
    setCompareLoading(true);
    setCompareError(null);

    optimizationApi
      .compare(run.id, Number(compareTargetId))
      .then((data) => {
        if (active) setComparison(data as OptimizationRunComparison);
      })
      .catch(() => {
        if (active) {
          setComparison(null);
          setCompareError('Nao foi possivel comparar as execucoes selecionadas.');
        }
      })
      .finally(() => {
        if (active) setCompareLoading(false);
      });

    return () => {
      active = false;
    };
  }, [compareTargetId, run.id, run.status]);

  const auditResult = audit?.result ?? (run.resultSummary as OptimizationResultSummary | null) ?? null;
  const performance = (auditResult?.performance ?? null) as OptimizationPerformance | null;
  const reproducibility = (auditResult?.reproducibility ?? null) as OptimizationReproducibility | null;
  const phaseTimings = Object.entries(performance?.phase_timings_ms ?? {}).sort((left, right) => left[0].localeCompare(right[0]));
  const versioning = (audit?.versioning ?? null) as Record<string, unknown> | null;
  const metricsEntries = Object.entries(comparison?.metrics ?? {});
  const performanceEntries = Object.entries(comparison?.performance?.phaseTimings ?? {});
  const raw = JSON.stringify({ audit: audit ?? null, comparison: comparison ?? null }, null, 2);

  return (
    <Box>
      {auditLoading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}
      {auditError && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{auditError}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={800} mb={1.5}>Replay e Versionamento</Typography>
            <Stack spacing={1.25}>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Hash do input do replay</Typography>
                <Typography variant="body2" fontWeight={700}>{readReproValue<string>(reproducibility, 'input_hash', 'inputHash') ?? '--'}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Hash dos parametros do replay</Typography>
                <Typography variant="body2" fontWeight={700}>{readReproValue<string>(reproducibility, 'params_hash', 'paramsHash') ?? '--'}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Budget auditado</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(readReproValue<number>(reproducibility, 'time_budget_s', 'timeBudgetS'), 's')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Random seed</Typography>
                <Typography variant="body2" fontWeight={700}>{readReproValue<number>(reproducibility, 'random_seed', 'randomSeed') ?? '--'}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Replay deterministico</Typography>
                <Chip
                  size="small"
                  color={readReproValue<boolean>(reproducibility, 'deterministic_replay_possible', 'deterministicReplayPossible') ? 'success' : 'warning'}
                  label={readReproValue<boolean>(reproducibility, 'deterministic_replay_possible', 'deterministicReplayPossible') ? 'Sim' : 'Nao'}
                />
              </Box>
              <Divider />
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">settingsVersion</Typography>
                <Typography variant="body2" fontWeight={700}>{String(versioning?.settingsVersion ?? '--')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">ruleHash do snapshot</Typography>
                <Typography variant="body2" fontWeight={700}>{String(versioning?.ruleHash ?? '--')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">inputHash do snapshot</Typography>
                <Typography variant="body2" fontWeight={700}>{String(versioning?.inputHash ?? '--')}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={800} mb={1.5}>Performance do Solver</Typography>
            <Stack spacing={1.25} mb={2}>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Tempo total</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(performance?.total_elapsed_ms ?? run.durationMs, 'ms')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Trips auditadas</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(performance?.trip_count)}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary">Tipos de veiculo</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtNumber(performance?.vehicle_type_count)}</Typography>
              </Box>
            </Stack>

            {phaseTimings.length ? (
              <TableContainer component={Box}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={thSx}>Fase</TableCell>
                      <TableCell sx={thSx} align="right">Tempo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {phaseTimings.map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell>{labelizeKey(key)}</TableCell>
                        <TableCell align="right">{fmtNumber(value, 'ms')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">Sem timings detalhados nesta execucao.</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={2}>
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Auditoria Comparativa</Typography>
                <Typography variant="caption" color="text.secondary">Compare custo, performance e fingerprints de replay entre duas execucoes.</Typography>
              </Box>
              <TextField
                select
                size="small"
                label="Comparar com"
                value={compareTargetId}
                onChange={(event) => setCompareTargetId(event.target.value)}
                sx={{ minWidth: 220 }}
                disabled={!comparableRuns.length || run.status !== 'completed'}
              >
                {!comparableRuns.length && <MenuItem value="">Nenhuma execucao comparavel</MenuItem>}
                {comparableRuns.map((candidate) => (
                  <MenuItem key={candidate.id} value={String(candidate.id)}>
                    #{candidate.id} · {new Date(candidate.createdAt || '').toLocaleString('pt-BR')}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {compareLoading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}
            {compareError && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{compareError}</Alert>}

            {comparison ? (
              <Stack spacing={2}>
                <Alert severity={comparison.summary?.betterRunId === run.id ? 'success' : 'info'} sx={{ borderRadius: 2 }}>
                  {comparison.summary?.headline ?? 'Comparacao carregada.'}
                </Alert>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={7}>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={thSx}>Indicador</TableCell>
                            <TableCell sx={thSx} align="right">Base</TableCell>
                            <TableCell sx={thSx} align="right">Comparada</TableCell>
                            <TableCell sx={thSx} align="right">Delta</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {metricsEntries.map(([key, metric]) => (
                            <TableRow key={key}>
                              <TableCell>{labelizeKey(key)}</TableCell>
                              <TableCell align="right">{formatComparisonValue(key, metric.base)}</TableCell>
                              <TableCell align="right">{formatComparisonValue(key, metric.other)}</TableCell>
                              <TableCell align="right"><ComparisonDeltaCell metric={metric} metricKey={key} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  <Grid item xs={12} md={5}>
                    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Replay entre execucoes</Typography>
                      <Stack spacing={1.25}>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Mesmo input hash</Typography>
                          <Chip size="small" color={comparison.reproducibility?.sameInputHash ? 'success' : 'warning'} label={comparison.reproducibility?.sameInputHash ? 'Sim' : 'Nao'} />
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Mesmo params hash</Typography>
                          <Chip size="small" color={comparison.reproducibility?.sameParamsHash ? 'success' : 'warning'} label={comparison.reproducibility?.sameParamsHash ? 'Sim' : 'Nao'} />
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Mesmo budget</Typography>
                          <Chip size="small" color={comparison.reproducibility?.sameTimeBudget ? 'success' : 'warning'} label={comparison.reproducibility?.sameTimeBudget ? 'Sim' : 'Nao'} />
                        </Box>
                        <Divider />
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Input hash base</Typography>
                          <Typography variant="body2" fontWeight={700}>{comparison.reproducibility?.base?.inputHash ?? '--'}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Input hash comparada</Typography>
                          <Typography variant="body2" fontWeight={700}>{comparison.reproducibility?.other?.inputHash ?? '--'}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Budget base</Typography>
                          <Typography variant="body2" fontWeight={700}>{fmtNumber(comparison.reproducibility?.base?.timeBudgetS, 's')}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary">Budget comparada</Typography>
                          <Typography variant="body2" fontWeight={700}>{fmtNumber(comparison.reproducibility?.other?.timeBudgetS, 's')}</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>

                {!!performanceEntries.length && (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={thSx}>Timing</TableCell>
                          <TableCell sx={thSx} align="right">Base</TableCell>
                          <TableCell sx={thSx} align="right">Comparada</TableCell>
                          <TableCell sx={thSx} align="right">Delta</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {performanceEntries.map(([key, metric]) => (
                          <TableRow key={key}>
                            <TableCell>{labelizeKey(key)}</TableCell>
                            <TableCell align="right">{formatComparisonValue(key, metric.base, 'performance')}</TableCell>
                            <TableCell align="right">{formatComparisonValue(key, metric.other, 'performance')}</TableCell>
                            <TableCell align="right"><ComparisonDeltaCell metric={metric} metricKey={key} category="performance" /></TableCell>
                          </TableRow>
                        ))}
                        {comparison.performance?.totalElapsedMs && (
                          <TableRow>
                            <TableCell>Tempo Total</TableCell>
                            <TableCell align="right">{formatComparisonValue('totalElapsedMs', comparison.performance.totalElapsedMs.base, 'performance')}</TableCell>
                            <TableCell align="right">{formatComparisonValue('totalElapsedMs', comparison.performance.totalElapsedMs.other, 'performance')}</TableCell>
                            <TableCell align="right"><ComparisonDeltaCell metric={comparison.performance.totalElapsedMs} metricKey="totalElapsedMs" category="performance" /></TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {!!comparison.paramsDiff?.length && (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={thSx}>Parametro</TableCell>
                          <TableCell sx={thSx}>Base</TableCell>
                          <TableCell sx={thSx}>Comparada</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparison.paramsDiff.slice(0, 12).map((diff) => (
                          <TableRow key={diff.path}>
                            <TableCell>{diff.path}</TableCell>
                            <TableCell>{diff.base}</TableCell>
                            <TableCell>{diff.other}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {run.status !== 'completed'
                  ? 'Comparacao disponivel apenas para execucoes concluidas.'
                  : 'Selecione uma execucao para carregar o comparativo.'}
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, maxHeight: 500, overflowY: 'auto', bgcolor: 'grey.900' }}>
            <Typography variant="subtitle2" fontWeight={800} color="white" mb={1}>Envelope bruto de auditoria</Typography>
            <pre style={{ margin: 0, fontSize: 12, color: '#4FC3F7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>{raw}</pre>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
