'use client';
import { getErrorMessage } from "@/utils/getErrorMessage";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, Stack, Skeleton, Tooltip,
  IconButton, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, Chip, useTheme,
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconRefresh, IconClock, IconDeviceFloppy,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { tripTimeConfigsApi, linesApi, getSessionUser } from '@/lib/api';
import type { TripTimeConfig, TripTimeBand, Line } from '../_types';
import { extractArray, numVal } from '../_types';
import { dialogTitleSx } from '../_tokens/design-tokens';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const INTERVALS = [10, 15, 20, 30, 60];

// ─── Main ───────────────────────────────────────────────────────────────────
function TripTimesInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [configs, setConfigs] = useState<TripTimeConfig[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);

  // detail panel
  const [selected, setSelected] = useState<TripTimeConfig | null>(null);
  const [bands, setBands] = useState<TripTimeBand[]>([]);
  const [bandsLoading, setBandsLoading] = useState(false);
  const [bandsDirty, setBandsDirty] = useState(false);
  const [savingBands, setSavingBands] = useState(false);

  // create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TripTimeConfig | null>(null);
  const [form, setForm] = useState({ lineId: '', description: '', bandIntervalMinutes: '30', startHourMinutes: '240', endHourMinutes: '1440' });
  const [saving, setSaving] = useState(false);

  // delete
  const [deleteTarget, setDeleteTarget] = useState<TripTimeConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgData, lnData] = await Promise.allSettled([
        tripTimeConfigsApi.getAll(),
        linesApi.getAll(),
      ]);
      if (cfgData.status === 'fulfilled') setConfigs(extractArray(cfgData.value));
      if (lnData.status === 'fulfilled') setLines(extractArray(lnData.value));
    } catch {
      notify.error('Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const loadBands = useCallback(async (cfg: TripTimeConfig) => {
    setSelected(cfg);
    setBandsLoading(true);
    setBandsDirty(false);
    try {
      const data = await tripTimeConfigsApi.getBands(cfg.id);
      setBands(extractArray(data));
    } catch {
      notify.error('Falha ao carregar faixas.');
    } finally {
      setBandsLoading(false);
    }
  }, [notify]);

  const lineName = (id: number) => lines.find((l) => l.id === id)?.name ?? String(id);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ lineId: '', description: '', bandIntervalMinutes: '30', startHourMinutes: '240', endHourMinutes: '1440' });
    setDialogOpen(true);
  };
  const openEdit = (cfg: TripTimeConfig) => {
    setEditTarget(cfg);
    setForm({
      lineId: String(cfg.lineId),
      description: cfg.description,
      bandIntervalMinutes: String(cfg.bandIntervalMinutes),
      startHourMinutes: String(cfg.startHourMinutes ?? 240),
      endHourMinutes: String(cfg.endHourMinutes ?? 1440),
    });
    setDialogOpen(true);
  };

  // ─── Create / Edit ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.lineId || !form.description.trim()) {
      notify.warning('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const user = getSessionUser();
      const payload = {
        companyId: user?.companyId ?? 1,
        lineId: Number(form.lineId),
        description: form.description.trim(),
        bandIntervalMinutes: Number(form.bandIntervalMinutes),
        startHourMinutes: Number(form.startHourMinutes),
        endHourMinutes: Number(form.endHourMinutes),
      };
      if (editTarget) {
        await tripTimeConfigsApi.update(editTarget.id, {
          description: payload.description,
          lineId: payload.lineId,
          bandIntervalMinutes: payload.bandIntervalMinutes,
          startHourMinutes: payload.startHourMinutes,
          endHourMinutes: payload.endHourMinutes,
        });
        notify.success('Configuração atualizada!');
      } else {
        const created = await tripTimeConfigsApi.create(payload);
        notify.success('Configuração criada com sucesso!');
        if (created?.id) loadBands(created);
      }
      setDialogOpen(false);
      setForm({ lineId: '', description: '', bandIntervalMinutes: '30', startHourMinutes: '240', endHourMinutes: '1440' });
      setEditTarget(null);
      await load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao salvar configuração.'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tripTimeConfigsApi.delete(deleteTarget.id);
      notify.success('Configuração excluída!');
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) { setSelected(null); setBands([]); }
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao excluir.'));
    } finally {
      setDeleting(false);
    }
  };

  // ─── Band editing ─────────────────────────────────────────────────────────
  const updateBand = (idx: number, field: keyof TripTimeBand, value: string) => {
    setBands((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, [field]: value === '' ? 0 : Number(value) } : b)),
    );
    setBandsDirty(true);
  };

  const saveBands = async () => {
    if (!selected) return;
    setSavingBands(true);
    try {
      await tripTimeConfigsApi.saveBands(
        selected.id,
        bands.map((b) => ({
          startMinutes: b.startMinutes,
          endMinutes: b.endMinutes,
          tripDurationOutbound: b.tripDurationOutbound ?? 0,
          tripDurationReturn: b.tripDurationReturn ?? 0,
          idleMinutesOutbound: b.idleMinutesOutbound ?? 0,
          idleMinutesReturn: b.idleMinutesReturn ?? 0,
        })),
      );
      notify.success('Faixas salvas com sucesso!');
      setBandsDirty(false);
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao salvar faixas.'));
    } finally {
      setSavingBands(false);
    }
  };

  return (
    <PageContainer title="Tempo de Viagem — OTIMIZ" description="Configuração de tempo de viagem por faixa">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Tempo de Viagem</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Configure a duração de viagem (ida/volta) e tempo ocioso por faixa horária
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar">
            <IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>
            Nova Configuração
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* ─── List ─────────────────────────────────────────────────────── */}
        <Grid item xs={12} md={4}>
          <DashboardCard title="Configurações">
            {loading ? (
              <Box>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="rectangular" height={56} sx={{ mb: 1, borderRadius: 1 }} />)}</Box>
            ) : configs.length === 0 ? (
              <Box textAlign="center" py={4}>
                <IconClock size={40} color={theme.palette.grey[400]} />
                <Typography variant="body2" color="text.secondary" mt={1}>Nenhuma configuração criada.</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {configs.map((cfg) => (
                  <Paper
                    key={cfg.id}
                    elevation={0}
                    onClick={() => loadBands(cfg)}
                    sx={{
                      p: 1.5, cursor: 'pointer', border: '1px solid',
                      borderColor: selected?.id === cfg.id ? 'primary.main' : 'divider',
                      bgcolor: selected?.id === cfg.id ? 'primary.lighter' : 'background.paper',
                      borderRadius: 2, '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{cfg.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lineName(cfg.lineId)} · Faixas de {cfg.bandIntervalMinutes}min
                        </Typography>
                      </Box>
                      <Stack direction="row" gap={0.5}>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(cfg); }}>
                            <IconEdit size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(cfg); }}>
                            <IconTrash size={16} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </DashboardCard>
        </Grid>

        {/* ─── Detail: Time Bands ───────────────────────────────────────── */}
        <Grid item xs={12} md={8}>
          <DashboardCard
            title={selected ? `Faixas — ${selected.description}` : 'Selecione uma configuração'}
            action={
              selected && bandsDirty ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<IconDeviceFloppy size={16} />}
                  onClick={saveBands}
                  disabled={savingBands}
                >
                  {savingBands ? 'Salvando...' : 'Salvar Faixas'}
                </Button>
              ) : undefined
            }
          >
            {!selected ? (
              <Box textAlign="center" py={6}>
                <Typography variant="body2" color="text.secondary">
                  Selecione uma configuração à esquerda para visualizar as faixas.
                </Typography>
              </Box>
            ) : bandsLoading ? (
              <Box>{[...Array(6)].map((_, i) => <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box>
            ) : (
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>Faixa</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, minWidth: 120 }}>Dur. Ida (min)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, minWidth: 120 }}>Dur. Volta (min)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, minWidth: 120 }}>Ocioso Ida (min)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, minWidth: 120 }}>Ocioso Volta (min)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bands.map((band, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>
                          <Chip label={`${fmtMin(band.startMinutes)} – ${fmtMin(band.endMinutes)}`} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number"
                            size="small"
                            sx={{ width: 80 }}
                            value={numVal(band.tripDurationOutbound ?? 0)}
                            onChange={(e) => updateBand(idx, 'tripDurationOutbound', e.target.value)}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number"
                            size="small"
                            sx={{ width: 80 }}
                            value={numVal(band.tripDurationReturn ?? 0)}
                            onChange={(e) => updateBand(idx, 'tripDurationReturn', e.target.value)}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number"
                            size="small"
                            sx={{ width: 80 }}
                            value={numVal(band.idleMinutesOutbound ?? 0)}
                            onChange={(e) => updateBand(idx, 'idleMinutesOutbound', e.target.value)}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number"
                            size="small"
                            sx={{ width: 80 }}
                            value={numVal(band.idleMinutesReturn ?? 0)}
                            onChange={(e) => updateBand(idx, 'idleMinutesReturn', e.target.value)}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DashboardCard>
        </Grid>
      </Grid>

      {/* ─── Create Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={dialogTitleSx}>{editTarget ? 'Editar Configuração de Tempo' : 'Nova Configuração de Tempo'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel required>Linha</InputLabel>
              <Select label="Linha *" value={form.lineId}
                onChange={(e) => setForm((p) => ({ ...p, lineId: e.target.value as string }))}>
                {lines.map((l) => <MenuItem key={l.id} value={String(l.id)}>{l.code} — {l.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Descrição" required fullWidth value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Ex: Dias Úteis - Verão 2025" />
            <FormControl fullWidth size="small">
              <InputLabel>Intervalo da Faixa</InputLabel>
              <Select label="Intervalo da Faixa" value={form.bandIntervalMinutes}
                onChange={(e) => setForm((p) => ({ ...p, bandIntervalMinutes: e.target.value as string }))}>
                {INTERVALS.map((v) => <MenuItem key={v} value={String(v)}>{v} minutos</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField label="Hora Início (min)" type="number" fullWidth size="small"
                value={form.startHourMinutes}
                onChange={(e) => setForm((p) => ({ ...p, startHourMinutes: e.target.value }))}
                helperText={`= ${fmtMin(Number(form.startHourMinutes) || 0)}`}
                inputProps={{ min: 0, max: 1800 }} />
              <TextField label="Hora Fim (min)" type="number" fullWidth size="small"
                value={form.endHourMinutes}
                onChange={(e) => setForm((p) => ({ ...p, endHourMinutes: e.target.value }))}
                helperText={`= ${fmtMin(Number(form.endHourMinutes) || 0)}`}
                inputProps={{ min: 60, max: 1800 }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.lineId || !form.description.trim()}>
            {saving ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Configuração"
        message={`Deseja excluir "${deleteTarget?.description}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}

export default function TripTimesPage() {
  return <NotifyProvider><TripTimesInner /></NotifyProvider>;
}
