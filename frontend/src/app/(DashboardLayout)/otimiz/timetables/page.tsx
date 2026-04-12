'use client';
import { getErrorMessage } from "@/utils/getErrorMessage";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, Stack, Skeleton, Tooltip,
  IconButton, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, Chip, useTheme, Alert,
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconRefresh, IconCalendarEvent,
  IconPlayerPlay, IconDeviceFloppy,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import { NotifyProvider, useNotify } from '../_components/Notify';
import {
  timetablesApi, tripTimeConfigsApi, passengerConfigsApi,
  linesApi, vehicleTypesApi, tripsApi, terminalsApi, getSessionUser,
} from '@/lib/api';
import type {
  Timetable, TripTimeConfig, PassengerConfig, Line, VehicleType, Trip, Terminal,
} from '../_types';
import { extractArray, numVal } from '../_types';
import { dialogTitleSx } from '../_tokens/design-tokens';

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

interface TimetableForm {
  name: string;
  description: string;
  lineId: string;
  tripTimeConfigId: string;
  passengerConfigId: string;
  vehicleTypeId: string;
  validityStart: string;
  validityEnd: string;
}

interface TripEditForm {
  startTimeMinutes: string;
  endTimeMinutes: string;
  idleAfterMinutes: string;
  midTripReliefPointId: string;
  midTripReliefOffsetMinutes: string;
}

const EMPTY_FORM: TimetableForm = {
  name: '', description: '', lineId: '',
  tripTimeConfigId: '', passengerConfigId: '', vehicleTypeId: '',
  validityStart: '', validityEnd: '',
};

const EMPTY_TRIP_FORM: TripEditForm = {
  startTimeMinutes: '',
  endTimeMinutes: '',
  idleAfterMinutes: '',
  midTripReliefPointId: '',
  midTripReliefOffsetMinutes: '',
};

function TimetablesInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [tripTimeConfigs, setTripTimeConfigs] = useState<TripTimeConfig[]>([]);
  const [passengerConfigs, setPassengerConfigs] = useState<PassengerConfig[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Timetable | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);

  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState<TripEditForm>(EMPTY_TRIP_FORM);
  const [savingTrip, setSavingTrip] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Timetable | null>(null);
  const [form, setForm] = useState<TimetableForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [generating, setGenerating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Timetable | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTripTarget, setDeleteTripTarget] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tt, ln, terminalsData, ttc, pc, vt] = await Promise.allSettled([
        timetablesApi.getAll(),
        linesApi.getAll(),
        terminalsApi.getAll(),
        tripTimeConfigsApi.getAll(),
        passengerConfigsApi.getAll(),
        vehicleTypesApi.getAll(),
      ]);
      if (tt.status === 'fulfilled') setTimetables(extractArray(tt.value));
      if (ln.status === 'fulfilled') setLines(extractArray(ln.value));
      if (terminalsData.status === 'fulfilled') setTerminals(extractArray(terminalsData.value));
      if (ttc.status === 'fulfilled') setTripTimeConfigs(extractArray(ttc.value));
      if (pc.status === 'fulfilled') setPassengerConfigs(extractArray(pc.value));
      if (vt.status === 'fulfilled') setVehicleTypes(extractArray(vt.value));
    } catch {
      notify.error('Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const loadTrips = useCallback(async (tt: Timetable) => {
    setSelected(tt);
    setTripsLoading(true);
    try {
      const data = await timetablesApi.getTrips(tt.id);
      setTrips(extractArray(data));
    } catch {
      notify.error('Falha ao carregar viagens.');
    } finally {
      setTripsLoading(false);
    }
  }, [notify]);

  const lineName = (id: number) => lines.find((l) => l.id === id)?.name ?? String(id);

  const filteredTTC = form.lineId ? tripTimeConfigs.filter((c) => c.lineId === Number(form.lineId)) : tripTimeConfigs;
  const filteredPC = form.lineId ? passengerConfigs.filter((c) => c.lineId === Number(form.lineId)) : passengerConfigs;

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (tt: Timetable) => {
    setEditTarget(tt);
    setForm({
      name: tt.name,
      description: tt.description ?? '',
      lineId: String(tt.lineId),
      tripTimeConfigId: String(tt.tripTimeConfigId),
      passengerConfigId: String(tt.passengerConfigId),
      vehicleTypeId: tt.vehicleTypeId ? String(tt.vehicleTypeId) : '',
      validityStart: tt.validityStart ? tt.validityStart.slice(0, 10) : '',
      validityEnd: tt.validityEnd ? tt.validityEnd.slice(0, 10) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.lineId || !form.tripTimeConfigId || !form.passengerConfigId) {
      notify.warning('Preencha nome, linha, tempo de viagem e passageiros.');
      return;
    }
    setSaving(true);
    try {
      const user = getSessionUser();
      const payload = {
        companyId: user?.companyId ?? 1,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        lineId: Number(form.lineId),
        tripTimeConfigId: Number(form.tripTimeConfigId),
        passengerConfigId: Number(form.passengerConfigId),
        vehicleTypeId: form.vehicleTypeId ? Number(form.vehicleTypeId) : undefined,
        validityStart: form.validityStart || undefined,
        validityEnd: form.validityEnd || undefined,
      };
      if (editTarget) {
        await timetablesApi.update(editTarget.id, payload);
        notify.success('Carta horária atualizada!');
      } else {
        await timetablesApi.create(payload);
        notify.success('Carta horária criada!');
      }
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (tt: Timetable) => {
    setGenerating(true);
    try {
      await timetablesApi.generateTrips(tt.id);
      notify.success('Viagens geradas com sucesso!');
      loadTrips(tt);
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao gerar viagens.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await timetablesApi.delete(deleteTarget.id);
      notify.success('Carta horária excluída!');
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) { setSelected(null); setTrips([]); }
      load();
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao excluir.'));
    } finally {
      setDeleting(false);
    }
  };

  const openEditTrip = (trip: Trip) => {
    setEditTrip(trip);
    setTripForm({
      startTimeMinutes: String(trip.startTimeMinutes),
      endTimeMinutes: String(trip.endTimeMinutes),
      idleAfterMinutes: String(trip.idleAfterMinutes ?? 0),
      midTripReliefPointId: trip.midTripReliefPointId != null ? String(trip.midTripReliefPointId) : '',
      midTripReliefOffsetMinutes: trip.midTripReliefOffsetMinutes != null ? String(trip.midTripReliefOffsetMinutes) : '',
    });
  };

  const handleSaveTrip = async () => {
    if (!editTrip) return;
    const start = Number(tripForm.startTimeMinutes);
    const end = Number(tripForm.endTimeMinutes);
    const duration = end - start;
    const reliefPointId = tripForm.midTripReliefPointId ? Number(tripForm.midTripReliefPointId) : null;
    const reliefOffsetMinutes = tripForm.midTripReliefOffsetMinutes ? Number(tripForm.midTripReliefOffsetMinutes) : null;
    if (end <= start) {
      notify.warning('Horário final deve ser maior que o inicial.');
      return;
    }
    if ((reliefPointId == null) !== (reliefOffsetMinutes == null)) {
      notify.warning('Informe juntos o ponto e o offset da rendição intra-viagem.');
      return;
    }
    if (reliefOffsetMinutes != null && (reliefOffsetMinutes <= 0 || reliefOffsetMinutes >= duration)) {
      notify.warning('O offset da rendição deve cair dentro da viagem.');
      return;
    }
    if (
      reliefPointId != null
      && [editTrip.originTerminalId, editTrip.destinationTerminalId].includes(reliefPointId)
    ) {
      notify.warning('O ponto de rendição deve ser intermediário, não a origem ou o destino.');
      return;
    }
    setSavingTrip(true);
    try {
      await tripsApi.update(editTrip.id, {
        startTimeMinutes: start,
        endTimeMinutes: end,
        durationMinutes: duration,
        idleAfterMinutes: Number(tripForm.idleAfterMinutes),
        midTripReliefPointId: reliefPointId,
        midTripReliefOffsetMinutes: reliefOffsetMinutes,
      });
      notify.success('Viagem atualizada!');
      setEditTrip(null);
      if (selected) loadTrips(selected);
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao salvar viagem.'));
    } finally {
      setSavingTrip(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!deleteTripTarget) return;
    setDeletingTrip(true);
    try {
      await tripsApi.delete(deleteTripTarget.id);
      notify.success('Viagem excluída!');
      setDeleteTripTarget(null);
      if (selected) loadTrips(selected);
    } catch (e: unknown) {
      notify.error(getErrorMessage(e, 'Erro ao excluir viagem.'));
    } finally {
      setDeletingTrip(false);
    }
  };

  const outboundTrips = trips.filter((t) => t.direction === 'outbound').sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);
  const returnTrips = trips.filter((t) => t.direction === 'return').sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);
  const reliefTerminalOptions = terminals.filter((terminal) => (
    terminal.id !== editTrip?.originTerminalId
    && terminal.id !== editTrip?.destinationTerminalId
  ));

  return (
    <PageContainer title="Carta Horária — OTIMIZ" description="Geração e gerenciamento da carta horária">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Carta Horária</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Vincule tempo de viagem + passageiros para gerar a carta horária
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar">
            <IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>
            Nova Carta
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <DashboardCard title="Cartas Horárias">
            {loading ? (
              <Box>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="rectangular" height={70} sx={{ mb: 1, borderRadius: 1 }} />)}</Box>
            ) : timetables.length === 0 ? (
              <Box textAlign="center" py={4}>
                <IconCalendarEvent size={40} color={theme.palette.grey[400]} />
                <Typography variant="body2" color="text.secondary" mt={1}>Nenhuma carta horária criada.</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {timetables.map((tt) => (
                  <Paper
                    key={tt.id}
                    elevation={0}
                    onClick={() => loadTrips(tt)}
                    sx={{
                      p: 1.5, cursor: 'pointer', border: '1px solid',
                      borderColor: selected?.id === tt.id ? 'primary.main' : 'divider',
                      bgcolor: selected?.id === tt.id ? 'primary.lighter' : 'background.paper',
                      borderRadius: 2, '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{tt.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lineName(tt.lineId)}
                        </Typography>
                        {tt.validityStart && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Vigência: {tt.validityStart.slice(0, 10)} — {tt.validityEnd?.slice(0, 10) ?? '∞'}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" gap={0.5} alignItems="center">
                        <Chip label={tt.status} size="small" color={tt.status === 'active' ? 'success' : 'default'} variant="outlined" />
                        <Tooltip title="Gerar Viagens">
                          <IconButton size="small" color="primary" disabled={generating}
                            onClick={(e) => { e.stopPropagation(); handleGenerate(tt); }}>
                            <IconPlayerPlay size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(tt); }}>
                            <IconEdit size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(tt); }}>
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

        <Grid item xs={12} md={8}>
          {!selected ? (
            <DashboardCard title="Selecione uma carta horária">
              <Box textAlign="center" py={6}>
                <Typography variant="body2" color="text.secondary">
                  Selecione uma carta horária para visualizar as viagens geradas.
                </Typography>
              </Box>
            </DashboardCard>
          ) : tripsLoading ? (
            <DashboardCard title="Carregando...">
              <Box>{[...Array(6)].map((_, i) => <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box>
            </DashboardCard>
          ) : trips.length === 0 ? (
            <DashboardCard title={`Viagens — ${selected.name}`}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Nenhuma viagem gerada. Clique no botão ▶ na carta horária para gerar.
              </Alert>
            </DashboardCard>
          ) : (
            <Stack spacing={2}>
              <DashboardCard title={`Viagens — ${selected.name}`}>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Total: {trips.length} viagens ({outboundTrips.length} ida + {returnTrips.length} volta)
                </Typography>
              </DashboardCard>

              <DashboardCard title="Ida (Outbound)">
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Partida</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Chegada</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>Duração</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>Ocioso</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outboundTrips.map((trip, idx) => (
                        <TableRow key={trip.id} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell><Chip label={fmtMin(trip.startTimeMinutes)} size="small" /></TableCell>
                          <TableCell>{fmtMin(trip.endTimeMinutes)}</TableCell>
                          <TableCell align="center">{trip.durationMinutes}min</TableCell>
                          <TableCell align="center">{trip.idleAfterMinutes ?? 0}min</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Editar"><IconButton size="small" onClick={() => openEditTrip(trip)}><IconEdit size={14} /></IconButton></Tooltip>
                            <Tooltip title="Excluir"><IconButton size="small" color="error" onClick={() => setDeleteTripTarget(trip)}><IconTrash size={14} /></IconButton></Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DashboardCard>

              <DashboardCard title="Volta (Return)">
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Partida</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Chegada</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>Duração</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>Ocioso</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {returnTrips.map((trip, idx) => (
                        <TableRow key={trip.id} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell><Chip label={fmtMin(trip.startTimeMinutes)} size="small" /></TableCell>
                          <TableCell>{fmtMin(trip.endTimeMinutes)}</TableCell>
                          <TableCell align="center">{trip.durationMinutes}min</TableCell>
                          <TableCell align="center">{trip.idleAfterMinutes ?? 0}min</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Editar"><IconButton size="small" onClick={() => openEditTrip(trip)}><IconEdit size={14} /></IconButton></Tooltip>
                            <Tooltip title="Excluir"><IconButton size="small" color="error" onClick={() => setDeleteTripTarget(trip)}><IconTrash size={14} /></IconButton></Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DashboardCard>
            </Stack>
          )}
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogTitleSx}>{editTarget ? 'Editar Carta Horária' : 'Nova Carta Horária'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField label="Nome" required fullWidth value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Dias Úteis - Linha 001" />
            <TextField label="Descrição" fullWidth value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <FormControl fullWidth size="small">
              <InputLabel required>Linha</InputLabel>
              <Select label="Linha *" value={form.lineId}
                onChange={(e) => setForm((p) => ({ ...p, lineId: e.target.value as string, tripTimeConfigId: '', passengerConfigId: '' }))}>
                {lines.map((l) => <MenuItem key={l.id} value={String(l.id)}>{l.code} — {l.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel required>Tempo de Viagem</InputLabel>
              <Select label="Tempo de Viagem *" value={form.tripTimeConfigId}
                onChange={(e) => setForm((p) => ({ ...p, tripTimeConfigId: e.target.value as string }))}>
                {filteredTTC.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.description}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel required>Passageiros</InputLabel>
              <Select label="Passageiros *" value={form.passengerConfigId}
                onChange={(e) => setForm((p) => ({ ...p, passengerConfigId: e.target.value as string }))}>
                {filteredPC.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.description}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Veículo</InputLabel>
              <Select label="Tipo de Veículo" value={form.vehicleTypeId}
                onChange={(e) => setForm((p) => ({ ...p, vehicleTypeId: e.target.value as string }))}>
                <MenuItem value="">Padrão (80 passageiros)</MenuItem>
                {vehicleTypes.map((v) => <MenuItem key={v.id} value={String(v.id)}>{v.name} ({v.passengerCapacity} pass.)</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField label="Início Vigência" type="date" fullWidth
                InputLabelProps={{ shrink: true }} value={form.validityStart}
                onChange={(e) => setForm((p) => ({ ...p, validityStart: e.target.value }))} />
              <TextField label="Fim Vigência" type="date" fullWidth
                InputLabelProps={{ shrink: true }} value={form.validityEnd}
                onChange={(e) => setForm((p) => ({ ...p, validityEnd: e.target.value }))} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.lineId || !form.tripTimeConfigId || !form.passengerConfigId}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editTrip} onClose={() => !savingTrip && setEditTrip(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogTitleSx}>Editar Viagem</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField label="Partida (minutos desde 00:00)" type="number" fullWidth
              value={numVal(tripForm.startTimeMinutes)}
              onChange={(e) => setTripForm((p) => ({ ...p, startTimeMinutes: e.target.value }))}
              helperText={tripForm.startTimeMinutes ? `= ${fmtMin(Number(tripForm.startTimeMinutes))}` : ''} />
            <TextField label="Chegada (minutos desde 00:00)" type="number" fullWidth
              value={numVal(tripForm.endTimeMinutes)}
              onChange={(e) => setTripForm((p) => ({ ...p, endTimeMinutes: e.target.value }))}
              helperText={tripForm.endTimeMinutes ? `= ${fmtMin(Number(tripForm.endTimeMinutes))}` : ''} />
            <TextField label="Tempo Ocioso (min)" type="number" fullWidth
              value={numVal(tripForm.idleAfterMinutes)}
              onChange={(e) => setTripForm((p) => ({ ...p, idleAfterMinutes: e.target.value }))} />
            <FormControl fullWidth size="small">
              <InputLabel>Ponto de Rendição Intra-viagem</InputLabel>
              <Select
                label="Ponto de Rendição Intra-viagem"
                value={tripForm.midTripReliefPointId}
                onChange={(e) => setTripForm((p) => ({ ...p, midTripReliefPointId: e.target.value as string }))}
              >
                <MenuItem value="">Sem rendição intra-viagem</MenuItem>
                {reliefTerminalOptions.map((terminal) => (
                  <MenuItem key={terminal.id} value={String(terminal.id)}>
                    {terminal.id} — {terminal.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Offset da Rendição (min)"
              type="number"
              fullWidth
              value={numVal(tripForm.midTripReliefOffsetMinutes)}
              onChange={(e) => setTripForm((p) => ({ ...p, midTripReliefOffsetMinutes: e.target.value }))}
              helperText={
                tripForm.midTripReliefOffsetMinutes && tripForm.startTimeMinutes
                  ? `Troca estimada em ${fmtMin(Number(tripForm.startTimeMinutes) + Number(tripForm.midTripReliefOffsetMinutes))}`
                  : 'Minutos após o início da viagem em que a rendição pode ocorrer.'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditTrip(null)} disabled={savingTrip}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveTrip} disabled={savingTrip}>
            {savingTrip ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Carta Horária"
        message={`Deseja excluir "${deleteTarget?.name}"? As viagens vinculadas serão desassociadas.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTripTarget}
        title="Excluir Viagem"
        message={`Deseja excluir a viagem ${deleteTripTarget ? fmtMin(deleteTripTarget.startTimeMinutes) + ' → ' + fmtMin(deleteTripTarget.endTimeMinutes) : ''}?`}
        confirmLabel="Excluir"
        loading={deletingTrip}
        onConfirm={handleDeleteTrip}
        onCancel={() => setDeleteTripTarget(null)}
      />
    </PageContainer>
  );
}

export default function TimetablesPage() {
  return <NotifyProvider><TimetablesInner /></NotifyProvider>;
}
