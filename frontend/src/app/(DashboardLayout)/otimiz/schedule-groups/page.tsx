'use client';
import { getErrorMessage } from "@/utils/getErrorMessage";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, Stack, Skeleton, Tooltip, Alert,
  IconButton, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, InputAdornment, Chip, Checkbox,
  ListItemText, OutlinedInput, Tabs, Tab, Divider, CircularProgress, useTheme,
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconLayoutGrid,
  IconPlayerPlay, IconArrowsShuffle, IconCheck, IconEye,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import {
  scheduleGroupsApi, schedulesApi, optimizationApi, tripsApi,
  getSessionUser,
} from '@/lib/api';
import type { ScheduleGroup, Schedule, Trip } from '../_types';
import { extractArray, numVal } from '../_types';
import { dialogTitleSx } from '../_tokens/design-tokens';

// ─── helpers ─────────────────────────────────────────────────────────────────
const minutesToHHMM = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success'> = {
  draft: 'default', ready: 'info', optimized: 'success',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', ready: 'Pronto', optimized: 'Otimizado',
};

interface GroupForm {
  name: string;
  description: string;
  scheduleIds: number[];
}
const EMPTY_FORM: GroupForm = { name: '', description: '', scheduleIds: [] };

// ═══════════════════════════════════════════════════════════════════════════════
function ScheduleGroupsInner() {
  const theme = useTheme();
  const notify = useNotify();

  // ─── data ────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ─── group dialog ────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduleGroup | null>(null);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── detail panel (trips) ────────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState<ScheduleGroup | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // ─── trip editing ────────────────────────────────────────────────────────
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState({ startH: '', startM: '', endH: '', endM: '' });
  const [savingTrip, setSavingTrip] = useState(false);
  const [deleteTripTarget, setDeleteTripTarget] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState(false);

  // ─── load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gData, sData] = await Promise.allSettled([
        scheduleGroupsApi.getAll(), schedulesApi.getAll(),
      ]);
      if (gData.status === 'fulfilled') setGroups(extractArray(gData.value));
      if (sData.status === 'fulfilled') setSchedules(extractArray(sData.value));
    } catch {
      notify.error('Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = groups.filter(
    (g) => g.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ─── CRUD ───────────────────────────────────────────────────────────────
  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (g: ScheduleGroup) => {
    setEditTarget(g);
    setForm({
      name: g.name,
      description: g.description ?? '',
      scheduleIds: g.items?.map((i) => i.scheduleId) ?? [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.scheduleIds.length === 0) {
      notify.warning('Preencha o nome e selecione ao menos um quadro.');
      return;
    }
    setSaving(true);
    try {
      const user = getSessionUser();
      const payload = {
        companyId: user?.companyId ?? 1,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        scheduleIds: form.scheduleIds,
      };
      if (editTarget) {
        await scheduleGroupsApi.update(editTarget.id, payload);
        notify.success('Grupo atualizado!');
      } else {
        await scheduleGroupsApi.create(payload);
        notify.success('Grupo criado!');
      }
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await scheduleGroupsApi.delete(deleteTarget.id);
      notify.success('Grupo excluído!');
      setDeleteTarget(null);
      if (selectedGroup?.id === deleteTarget.id) { setSelectedGroup(null); setTrips([]); }
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao excluir.'));
    } finally {
      setDeleting(false);
    }
  };

  // ─── select group → load trips ─────────────────────────────────────────
  const selectGroup = useCallback(async (group: ScheduleGroup) => {
    setSelectedGroup(group);
    setLoadingTrips(true);
    try {
      const data = await scheduleGroupsApi.getTrips(group.id);
      setTrips(extractArray(data));
    } catch {
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  // ─── generate trips ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedGroup) return;
    setGenerating(true);
    try {
      const res = await scheduleGroupsApi.generateTrips(selectedGroup.id);
      const count = res?.count ?? res?.length ?? '?';
      notify.success(`${count} viagens geradas com sucesso!`);
      selectGroup(selectedGroup);
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao gerar viagens.'));
    } finally {
      setGenerating(false);
    }
  };

  // ─── optimize ──────────────────────────────────────────────────────────
  const handleOptimize = async () => {
    if (!selectedGroup || trips.length === 0) return;
    setOptimizing(true);
    try {
      const user = getSessionUser();
      const lineIds = Array.from(new Set(trips.map((t) => t.lineId)));
      await optimizationApi.run({
        companyId: user?.companyId ?? 1,
        lineIds,
        scheduleGroupId: selectedGroup.id,
        algorithm: 'full_pipeline',
      });
      notify.success('Otimização iniciada! Acompanhe em Motor de Otimização.');
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao iniciar otimização.'));
    } finally {
      setOptimizing(false);
    }
  };

  // ─── edit trip ─────────────────────────────────────────────────────────
  const openTripEdit = (trip: Trip) => {
    setEditingTrip(trip);
    const sH = Math.floor(trip.startTimeMinutes / 60);
    const sM = trip.startTimeMinutes % 60;
    const eH = Math.floor(trip.endTimeMinutes / 60);
    const eM = trip.endTimeMinutes % 60;
    setTripForm({
      startH: String(sH), startM: String(sM),
      endH: String(eH), endM: String(eM),
    });
  };

  const handleSaveTrip = async () => {
    if (!editingTrip) return;
    const startTimeMinutes = Number(tripForm.startH) * 60 + Number(tripForm.startM);
    const endTimeMinutes = Number(tripForm.endH) * 60 + Number(tripForm.endM);
    if (endTimeMinutes <= startTimeMinutes) {
      notify.warning('Horário final deve ser maior que o inicial.');
      return;
    }
    const durationMinutes = endTimeMinutes - startTimeMinutes;
    setSavingTrip(true);
    try {
      await tripsApi.update(editingTrip.id, { startTimeMinutes, endTimeMinutes, durationMinutes });
      notify.success('Viagem atualizada!');
      setEditingTrip(null);
      if (selectedGroup) selectGroup(selectedGroup);
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao salvar viagem.'));
    } finally {
      setSavingTrip(false);
    }
  };

  const scheduleLabel = (id: number) => schedules.find((s) => s.id === id)?.name ?? `#${id}`;

  const handleDeleteTrip = async () => {
    if (!deleteTripTarget) return;
    setDeletingTrip(true);
    try {
      await tripsApi.delete(deleteTripTarget.id);
      notify.success('Viagem excluída!');
      setDeleteTripTarget(null);
      if (selectedGroup) selectGroup(selectedGroup);
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao excluir viagem.'));
    } finally {
      setDeletingTrip(false);
    }
  };

  // Aggregate trip stats
  const tripStats = {
    total: trips.length,
    outbound: trips.filter((t) => t.direction === 'outbound').length,
    returnTrips: trips.filter((t) => t.direction === 'return').length,
    lines: Array.from(new Set(trips.map((t) => t.lineId))).length,
    pullOut: trips.filter((t) => t.isPullOut).length,
    pullBack: trips.filter((t) => t.isPullBack).length,
  };

  return (
    <PageContainer title="Programação — OTIMIZ" description="Grupos de programação e geração de viagens">
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Programação</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Crie grupos de quadros, gere viagens e otimize
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>Novo Grupo</Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* ─── LEFT: list ──────────────────────────────────────────────── */}
        <Grid item xs={12} md={selectedGroup ? 4 : 12}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
            <TextField size="small" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          </Paper>
          <DashboardCard title="">
            {loading ? (
              <Box>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="rectangular" height={52} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box>
            ) : (
              <Stack spacing={1}>
                {filtered.length === 0 ? (
                  <Box textAlign="center" py={6}>
                    <IconLayoutGrid size={40} color={theme.palette.grey[400]} />
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      {search ? 'Nenhum grupo encontrado.' : 'Nenhum grupo criado.'}
                    </Typography>
                  </Box>
                ) : (
                  filtered.map((g) => (
                    <Paper key={g.id} variant="outlined" sx={{
                      p: 2, cursor: 'pointer',
                      borderColor: selectedGroup?.id === g.id ? 'primary.main' : 'divider',
                      borderWidth: selectedGroup?.id === g.id ? 2 : 1,
                    }}
                      onClick={() => selectGroup(g)}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body1" fontWeight={600}>{g.name}</Typography>
                          {g.description && <Typography variant="caption" color="text.secondary">{g.description}</Typography>}
                          <Stack direction="row" gap={0.5} mt={0.5}>
                            <Chip label={STATUS_LABELS[g.status] ?? g.status} size="small" color={STATUS_COLORS[g.status] ?? 'default'} />
                            {g.items && <Chip label={`${g.items.length} quadro(s)`} size="small" variant="outlined" />}
                          </Stack>
                        </Box>
                        <Stack direction="row">
                          <Tooltip title="Editar"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(g); }}><IconEdit size={16} /></IconButton></Tooltip>
                          <Tooltip title="Excluir"><IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }}><IconTrash size={16} /></IconButton></Tooltip>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            )}
          </DashboardCard>
        </Grid>

        {/* ─── RIGHT: detail panel ─────────────────────────────────────── */}
        {selectedGroup && (
          <Grid item xs={12} md={8}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              {/* Group header */}
              <Box sx={{ px: 3, pt: 2, pb: 2, bgcolor: theme.palette.grey[50] }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{selectedGroup.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Quadros: {selectedGroup.items?.map((i) => scheduleLabel(i.scheduleId)).join(', ') ?? 'nenhum'}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={1}>
                    <Button variant="outlined" startIcon={generating ? <CircularProgress size={16} /> : <IconArrowsShuffle size={16} />}
                      onClick={handleGenerate} disabled={generating}>
                      {generating ? 'Gerando...' : 'Gerar Viagens'}
                    </Button>
                    <Button variant="contained" color="success"
                      startIcon={optimizing ? <CircularProgress size={16} color="inherit" /> : <IconPlayerPlay size={16} />}
                      onClick={handleOptimize} disabled={optimizing || trips.length === 0}>
                      {optimizing ? 'Otimizando...' : 'Otimizar'}
                    </Button>
                    <IconButton size="small" onClick={() => { setSelectedGroup(null); setTrips([]); }}>✕</IconButton>
                  </Stack>
                </Stack>
              </Box>
              <Divider />

              {/* Trip stats */}
              {trips.length > 0 && (
                <Box sx={{ px: 3, py: 1.5 }}>
                  <Stack direction="row" gap={3} flexWrap="wrap">
                    <Typography variant="body2"><strong>{tripStats.total}</strong> viagens</Typography>
                    <Typography variant="body2" color="primary.main">{tripStats.outbound} ida</Typography>
                    <Typography variant="body2" color="secondary.main">{tripStats.returnTrips} volta</Typography>
                    <Typography variant="body2">{tripStats.lines} linha(s)</Typography>
                    <Typography variant="body2" color="text.secondary">{tripStats.pullOut} solturas • {tripStats.pullBack} recolhimentos</Typography>
                  </Stack>
                </Box>
              )}
              <Divider />

              {/* Trips table */}
              <Box sx={{ maxHeight: 520, overflow: 'auto' }}>
                {loadingTrips ? (
                  <Box p={3}>{[...Array(8)].map((_, i) => <Skeleton key={i} variant="rectangular" height={36} sx={{ mb: 0.5 }} />)}</Box>
                ) : trips.length === 0 ? (
                  <Box textAlign="center" py={6}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma viagem gerada. Clique em &quot;Gerar Viagens&quot; para criar automaticamente.
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, width: 40 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Linha</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Sentido</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Início</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Fim</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Dur.</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Ocioso</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Flags</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Ação</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {trips.map((trip, idx) => (
                          <TableRow key={trip.id} hover>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">{idx + 1}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {trip.line?.code ?? `L${trip.lineId}`}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={trip.direction === 'outbound' ? 'Ida' : 'Volta'} size="small"
                                color={trip.direction === 'outbound' ? 'primary' : 'secondary'} variant="outlined" />
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" fontFamily="monospace">{minutesToHHMM(trip.startTimeMinutes)}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" fontFamily="monospace">{minutesToHHMM(trip.endTimeMinutes)}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">{trip.durationMinutes}min</Typography>
                            </TableCell>
                            <TableCell align="center">
                              {(trip.idleBeforeMinutes ?? 0) > 0 && (
                                <Chip label={`${trip.idleBeforeMinutes}min`} size="small" color="warning" variant="outlined" />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" gap={0.5} justifyContent="center">
                                {trip.isPullOut && <Chip label="Soltura" size="small" color="info" />}
                                {trip.isPullBack && <Chip label="Recolhe" size="small" color="default" />}
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Editar viagem">
                                <IconButton size="small" onClick={() => openTripEdit(trip)}><IconEdit size={14} /></IconButton>
                              </Tooltip>
                              <Tooltip title="Excluir viagem">
                                <IconButton size="small" color="error" onClick={() => setDeleteTripTarget(trip)}><IconTrash size={14} /></IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Dialog Criar/Editar Grupo */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogTitleSx}>{editTarget ? 'Editar Grupo' : 'Nova Programação'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField label="Nome" required fullWidth value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Programação Dia Útil - Set/2025" />
            <TextField label="Descrição" fullWidth multiline rows={2} value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <FormControl fullWidth size="small">
              <InputLabel required>Quadros Horários</InputLabel>
              <Select
                multiple
                label="Quadros Horários *"
                value={form.scheduleIds}
                onChange={(e) => setForm((p) => ({ ...p, scheduleIds: e.target.value as number[] }))}
                input={<OutlinedInput label="Quadros Horários *" />}
                renderValue={(selected) =>
                  (selected as number[]).map((id) => scheduleLabel(id)).join(', ')
                }
              >
                {schedules.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Checkbox checked={form.scheduleIds.includes(s.id)} />
                    <ListItemText primary={s.name} secondary={`Linha: ${s.line?.name ?? s.lineId}`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {form.scheduleIds.length > 0 && (
              <Alert severity="info" variant="outlined">
                {form.scheduleIds.length} quadro(s) selecionado(s).
                As viagens serão geradas para todas as linhas envolvidas.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={saving || !form.name || form.scheduleIds.length === 0}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Editar Viagem */}
      <Dialog open={!!editingTrip} onClose={() => !savingTrip && setEditingTrip(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={dialogTitleSx}>Editar Viagem #{editingTrip?.id}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Linha: {editingTrip?.line?.code ?? `L${editingTrip?.lineId}`} —{' '}
              {editingTrip?.direction === 'outbound' ? 'Ida' : 'Volta'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField label="Hora" type="number" value={numVal(tripForm.startH)}
                sx={{ width: 70 }} inputProps={{ min: 0, max: 28 }}
                onChange={(e) => setTripForm((p) => ({ ...p, startH: e.target.value }))} />
              <Typography>:</Typography>
              <TextField label="Min" type="number" value={numVal(tripForm.startM)}
                sx={{ width: 70 }} inputProps={{ min: 0, max: 59 }}
                onChange={(e) => setTripForm((p) => ({ ...p, startM: e.target.value }))} />
              <Typography sx={{ mx: 1 }}>→</Typography>
              <TextField label="Hora" type="number" value={numVal(tripForm.endH)}
                sx={{ width: 70 }} inputProps={{ min: 0, max: 28 }}
                onChange={(e) => setTripForm((p) => ({ ...p, endH: e.target.value }))} />
              <Typography>:</Typography>
              <TextField label="Min" type="number" value={numVal(tripForm.endM)}
                sx={{ width: 70 }} inputProps={{ min: 0, max: 59 }}
                onChange={(e) => setTripForm((p) => ({ ...p, endM: e.target.value }))} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditingTrip(null)} disabled={savingTrip}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveTrip} disabled={savingTrip}>
            {savingTrip ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} title="Excluir Grupo"
        message={`Deseja excluir o grupo "${deleteTarget?.name}"? Viagens geradas também serão removidas.`}
        confirmLabel="Excluir" loading={deleting}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTripTarget} title="Excluir Viagem"
        message={`Excluir viagem ${deleteTripTarget ? minutesToHHMM(deleteTripTarget.startTimeMinutes) + ' → ' + minutesToHHMM(deleteTripTarget.endTimeMinutes) : ''}?`}
        confirmLabel="Excluir" loading={deletingTrip}
        onConfirm={handleDeleteTrip} onCancel={() => setDeleteTripTarget(null)}
      />
    </PageContainer>
  );
}

export default function ScheduleGroupsPage() {
  return <NotifyProvider><ScheduleGroupsInner /></NotifyProvider>;
}
