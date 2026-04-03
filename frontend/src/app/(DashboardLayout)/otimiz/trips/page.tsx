'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, Stack, Skeleton, Tooltip,
  IconButton, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, InputAdornment, Chip, useTheme,
  TablePagination, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconClock,
  IconArrowRight, IconArrowLeft,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { tripsApi, linesApi, getSessionUser } from '@/lib/api';
import type { Trip, Line } from '../_types';
import { extractArray } from '../_types';

const toHHMM = (minutes: number): string => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const fromHHMM = (v: string): number => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

interface TripForm {
  lineId: string;
  direction: 'outbound' | 'return';
  startTime: string;
  endTime: string;
  tripGroupId: string;
  originTerminalId: string;
  destinationTerminalId: string;
}

const EMPTY_FORM: TripForm = {
  lineId: '', direction: 'outbound', startTime: '', endTime: '',
  tripGroupId: '', originTerminalId: '', destinationTerminalId: '',
};

// Agrupa viagens por tripGroupId para exibição lado a lado
interface TripPair {
  groupId: number | null;
  outbound?: Trip;
  return?: Trip;
}

function groupTripPairs(trips: Trip[]): TripPair[] {
  const groups = new Map<string, TripPair>();
  const ungrouped: TripPair[] = [];

  trips.forEach((t) => {
    if (t.tripGroupId != null) {
      const key = `${t.lineId}-${t.tripGroupId}`;
      if (!groups.has(key)) groups.set(key, { groupId: t.tripGroupId });
      const g = groups.get(key)!;
      if (t.direction === 'outbound') g.outbound = t;
      else g.return = t;
    } else {
      ungrouped.push({ groupId: null, [t.direction]: t } as TripPair);
    }
  });
  return [...Array.from(groups.values()), ...ungrouped].sort((a, b) => {
    const ma = a.outbound?.startTimeMinutes ?? a.return?.startTimeMinutes ?? 0;
    const mb = b.outbound?.startTimeMinutes ?? b.return?.startTimeMinutes ?? 0;
    return ma - mb;
  });
}

function TripsInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLine, setFilterLine] = useState<string>('');
  const [filterDir, setFilterDir] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Trip | null>(null);
  const [form, setForm] = useState<TripForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'pairs' | 'individual'>('pairs');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tripsData, linesData] = await Promise.allSettled([
        tripsApi.getAll(),
        linesApi.getAll(),
      ]);
      if (tripsData.status === 'fulfilled') setTrips(extractArray(tripsData.value));
      if (linesData.status === 'fulfilled') setLines(extractArray(linesData.value));
    } catch {
      notify.error('Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = trips.filter((t) => {
    const matchLine = filterLine ? t.lineId === Number(filterLine) : true;
    const matchDir = filterDir === 'all' ? true : t.direction === filterDir;
    const matchSearch = search
      ? toHHMM(t.startTimeMinutes).includes(search) || toHHMM(t.endTimeMinutes).includes(search)
      : true;
    return matchLine && matchDir && matchSearch;
  });

  const pairs = groupTripPairs(filtered);
  const pagedPairs = pairs.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const lineLabel = (id: number) => lines.find((l) => l.id === id)?.name ?? `Linha ${id}`;
  const lineCode = (id: number) => lines.find((l) => l.id === id)?.code ?? String(id);
  const lineColor = (id: number) => lines.find((l) => l.id === id)?.colorHex ?? '#5D87FF';

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, lineId: filterLine || '' });
    setDialogOpen(true);
  };
  const openEdit = (t: Trip) => {
    setEditTarget(t);
    setForm({
      lineId: String(t.lineId),
      direction: t.direction,
      startTime: toHHMM(t.startTimeMinutes),
      endTime: toHHMM(t.endTimeMinutes),
      tripGroupId: t.tripGroupId != null ? String(t.tripGroupId) : '',
      originTerminalId: t.originTerminalId != null ? String(t.originTerminalId) : '',
      destinationTerminalId: t.destinationTerminalId != null ? String(t.destinationTerminalId) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.lineId || !form.startTime || !form.endTime) {
      notify.warning('Preencha todos os campos obrigatórios.');
      return;
    }
    const start = fromHHMM(form.startTime);
    const end = fromHHMM(form.endTime);
    if (end <= start) {
      notify.warning('Horário de chegada deve ser após o de saída.');
      return;
    }
    setSaving(true);
    try {
      const user = getSessionUser();
      const payload = {
        companyId: user?.companyId ?? 1,
        lineId: Number(form.lineId),
        direction: form.direction,
        startTimeMinutes: start,
        endTimeMinutes: end,
        durationMinutes: end - start,
        tripGroupId: form.tripGroupId ? Number(form.tripGroupId) : undefined,
        originTerminalId: form.originTerminalId ? Number(form.originTerminalId) : undefined,
        destinationTerminalId: form.destinationTerminalId ? Number(form.destinationTerminalId) : undefined,
        isActive: true,
      };
      if (editTarget) {
        await tripsApi.update(editTarget.id, payload);
        notify.success('Viagem atualizada!');
      } else {
        await tripsApi.create(payload);
        notify.success('Viagem criada!');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? 'Erro ao salvar viagem.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tripsApi.delete(deleteTarget.id);
      notify.success('Viagem excluída!');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? 'Erro ao excluir viagem.');
    } finally {
      setDeleting(false);
    }
  };

  const renderTimeCell = (trip?: Trip, dir?: 'outbound' | 'return') => {
    if (!trip) return <Typography variant="caption" color="text.disabled">—</Typography>;
    return (
      <Stack direction="row" alignItems="center" gap={0.5}>
        {dir === 'outbound' ? <IconArrowRight size={14} color={theme.palette.primary.main} /> : <IconArrowLeft size={14} color={theme.palette.secondary.main} />}
        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
          {toHHMM(trip.startTimeMinutes)}
        </Typography>
        <Typography variant="caption" color="text.secondary">→</Typography>
        <Typography variant="body2" fontFamily="monospace">
          {toHHMM(trip.endTimeMinutes)}
        </Typography>
        <Chip
          label={`${trip.durationMinutes}min`}
          size="small"
          sx={{ fontSize: 10, height: 18, bgcolor: 'action.hover' }}
        />
      </Stack>
    );
  };

  return (
    <PageContainer title="Viagens — OTIMIZ" description="Tabela de viagens por linha">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Viagens</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Tabela horária: IDA e VOLTA por linha
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar">
            <IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>
            Nova Viagem
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Buscar horário (ex: 07:30)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ width: 240 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Linha</InputLabel>
            <Select label="Linha" value={filterLine} onChange={(e) => { setFilterLine(e.target.value); setPage(0); }}>
              <MenuItem value="">Todas as linhas</MenuItem>
              {lines.map((l) => (
                <MenuItem key={l.id} value={String(l.id)}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.colorHex ?? '#5D87FF' }} />
                    {l.code} — {l.name}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_, v) => v && setViewMode(v)}
          >
            <ToggleButton value="pairs">IDA/VOLTA</ToggleButton>
            <ToggleButton value="individual">Individual</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" ml="auto">
            {filtered.length} viagem{filtered.length !== 1 ? 's' : ''} (
            {filtered.filter((t) => t.direction === 'outbound').length} IDA / {filtered.filter((t) => t.direction === 'return').length} VOLTA)
          </Typography>
        </Stack>
      </Paper>

      <DashboardCard title="">
        {loading ? (
          <Box>{[...Array(8)].map((_, i) => <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box>
        ) : viewMode === 'pairs' ? (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 50 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Linha</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <IconArrowRight size={14} color={theme.palette.primary.main} />
                        IDA (Saída → Chegada)
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <IconArrowLeft size={14} color={theme.palette.secondary.main} />
                        VOLTA (Saída → Chegada)
                      </Stack>
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Grupo</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedPairs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <IconClock size={40} color={theme.palette.grey[400]} />
                        <Typography variant="body2" color="text.secondary" mt={1}>
                          {search || filterLine ? 'Nenhuma viagem encontrada.' : 'Nenhuma viagem cadastrada. Crie a primeira!'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedPairs.map((pair, idx) => {
                      const sample = pair.outbound ?? pair.return!;
                      return (
                        <TableRow key={`${pair.groupId}-${idx}`} hover>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {page * rowsPerPage + idx + 1}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" gap={1}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: lineColor(sample.lineId) }} />
                              <Typography variant="body2" fontWeight={500}>{lineCode(sample.lineId)}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{renderTimeCell(pair.outbound, 'outbound')}</TableCell>
                          <TableCell>{renderTimeCell(pair.return, 'return')}</TableCell>
                          <TableCell align="center">
                            {pair.groupId != null && (
                              <Chip label={pair.groupId} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {pair.outbound && (
                              <>
                                <Tooltip title="Editar IDA">
                                  <IconButton size="small" onClick={() => openEdit(pair.outbound!)}><IconEdit size={15} /></IconButton>
                                </Tooltip>
                                <Tooltip title="Excluir IDA">
                                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(pair.outbound!)}><IconTrash size={15} /></IconButton>
                                </Tooltip>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[25, 50, 100, 200]}
              component="div"
              count={pairs.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
              labelRowsPerPage="Por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Linha</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Sentido</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Saída</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Chegada</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Duração</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Grupo</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((t) => (
                    <TableRow key={t.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: lineColor(t.lineId) }} />
                          <Typography variant="body2">{lineCode(t.lineId)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={t.direction === 'outbound' ? <IconArrowRight size={12} /> : <IconArrowLeft size={12} />}
                          label={t.direction === 'outbound' ? 'IDA' : 'VOLTA'}
                          size="small"
                          color={t.direction === 'outbound' ? 'primary' : 'secondary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                          {toHHMM(t.startTimeMinutes)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {toHHMM(t.endTimeMinutes)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{t.durationMinutes}min</Typography>
                      </TableCell>
                      <TableCell align="center">
                        {t.tripGroupId != null && <Chip label={t.tripGroupId} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(t)}><IconEdit size={15} /></IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}><IconTrash size={15} /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[25, 50, 100, 200]}
              component="div"
              count={filtered.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
              labelRowsPerPage="Por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        )}
      </DashboardCard>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editTarget ? 'Editar Viagem' : 'Nova Viagem'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Linha</InputLabel>
              <Select
                label="Linha"
                value={form.lineId}
                onChange={(e) => setForm((p) => ({ ...p, lineId: e.target.value }))}
              >
                {lines.map((l) => (
                  <MenuItem key={l.id} value={String(l.id)}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.colorHex ?? '#5D87FF' }} />
                      {l.code} — {l.name}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Sentido</InputLabel>
              <Select
                label="Sentido"
                value={form.direction}
                onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value as 'outbound' | 'return' }))}
              >
                <MenuItem value="outbound">
                  <Stack direction="row" alignItems="center" gap={1}>
                    <IconArrowRight size={16} /> IDA (outbound)
                  </Stack>
                </MenuItem>
                <MenuItem value="return">
                  <Stack direction="row" alignItems="center" gap={1}>
                    <IconArrowLeft size={16} /> VOLTA (return)
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Horário de Saída"
                type="time"
                required
                fullWidth
                size="small"
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Horário de Chegada"
                type="time"
                required
                fullWidth
                size="small"
                value={form.endTime}
                onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            {form.startTime && form.endTime && (
              <Typography variant="caption" color="text.secondary">
                Duração: {fromHHMM(form.endTime) - fromHHMM(form.startTime)} min
              </Typography>
            )}

            <TextField
              label="ID do Grupo (par IDA/VOLTA)"
              type="number"
              size="small"
              value={form.tripGroupId}
              onChange={(e) => setForm((p) => ({ ...p, tripGroupId: e.target.value }))}
              helperText="Viagens com o mesmo grupo são exibidas lado a lado"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Viagem"
        message={deleteTarget ? `Remover viagem ${deleteTarget.direction === 'outbound' ? 'IDA' : 'VOLTA'} das ${toHHMM(deleteTarget.startTimeMinutes)}→${toHHMM(deleteTarget.endTimeMinutes)}?` : ''}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}

export default function TripsPage() {
  return (
    <NotifyProvider>
      <TripsInner />
    </NotifyProvider>
  );
}