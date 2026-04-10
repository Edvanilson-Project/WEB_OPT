'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, InputAdornment, useTheme,
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconMapPin,
  IconBuildingWarehouse,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { terminalsApi, getSessionUser } from '@/lib/api';
import type { Terminal } from '../_types';
import { extractArray } from '../_types';

interface TerminalForm {
  name: string; shortName: string; address: string;
  latitude: string; longitude: string; isGarage: boolean; isActive: boolean;
}
const EMPTY: TerminalForm = { name: '', shortName: '', address: '', latitude: '', longitude: '', isGarage: false, isActive: true };

function TerminalsInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [items, setItems] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Terminal | null>(null);
  const [form, setForm] = useState<TerminalForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Terminal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await terminalsApi.getAll();
      setItems(extractArray(data));
    } catch { notify.error('Falha ao carregar terminais.'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()) || (t.shortName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (t: Terminal) => {
    setEditTarget(t);
    setForm({
      name: t.name, shortName: t.shortName ?? '', address: t.address ?? '',
      latitude: t.latitude != null ? String(t.latitude) : '',
      longitude: t.longitude != null ? String(t.longitude) : '',
      isGarage: t.isGarage, isActive: t.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify.warning('Nome é obrigatório.'); return; }
    const lat = form.latitude ? parseFloat(form.latitude) : undefined;
    const lng = form.longitude ? parseFloat(form.longitude) : undefined;
    if (lat != null && (lat < -90 || lat > 90)) { notify.warning('Latitude deve estar entre -90 e 90.'); return; }
    if (lng != null && (lng < -180 || lng > 180)) { notify.warning('Longitude deve estar entre -180 e 180.'); return; }
    setSaving(true);
    try {
      const user = getSessionUser();
      const payload = {
        companyId: user?.companyId ?? 1,
        name: form.name.trim(),
        shortName: form.shortName.trim().toUpperCase() || undefined,
        address: form.address.trim() || undefined,
        latitude: lat,
        longitude: lng,
        isGarage: form.isGarage, isActive: form.isActive,
      };
      if (editTarget) { await terminalsApi.update(editTarget.id, payload); notify.success('Terminal atualizado!'); }
      else { await terminalsApi.create(payload); notify.success('Terminal criado!'); }
      setDialogOpen(false); load();
    } catch (e: any) { notify.error(e?.response?.data?.message ?? 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try {
      await terminalsApi.delete(deleteTarget.id);
      notify.success('Terminal excluído!'); setDeleteTarget(null); load();
    } catch (e: any) { notify.error(e?.response?.data?.message ?? 'Erro ao excluir.'); }
    finally { setDeleting(false); }
  };

  const tf = (key: keyof TerminalForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <PageContainer title="Terminais — OTIMIZ" description="Gerenciar terminais e garagens">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Terminais</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Pontos terminais e garagens da rede de transporte</Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>Novo Terminal</Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField size="small" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          <Typography variant="caption" color="text.secondary" ml="auto">{filtered.length} terminal{filtered.length !== 1 ? 'is' : ''}</Typography>
        </Stack>
      </Paper>

      <DashboardCard title="">
        {loading ? <Box>{[...Array(6)].map((_, i) => <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Endereço</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Garagem</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <IconMapPin size={40} color={theme.palette.grey[400]} />
                    <Typography variant="body2" color="text.secondary" mt={1}>Nenhum terminal encontrado.</Typography>
                  </TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={600} fontFamily="monospace">{t.shortName ?? '—'}</Typography></TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1}>
                        {t.isGarage && <IconBuildingWarehouse size={15} color="#FFAE1F" />}
                        <Typography variant="body2">{t.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>{t.address ?? '—'}</Typography></TableCell>
                    <TableCell align="center"><StatusChip type="status" value={t.isGarage ? 'active' : 'inactive'} /></TableCell>
                    <TableCell align="center"><StatusChip type="status" value={t.isActive ? 'active' : 'inactive'} /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(t)}><IconEdit size={16} /></IconButton></Tooltip>
                      <Tooltip title="Excluir"><IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}><IconTrash size={16} /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DashboardCard>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editTarget ? 'Editar Terminal' : 'Novo Terminal'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="Nome" required fullWidth value={form.name} onChange={tf('name')} />
              <TextField label="Sigla" sx={{ width: 130 }} value={form.shortName} onChange={tf('shortName')} inputProps={{ maxLength: 20, style: { textTransform: 'uppercase' } }} />
            </Stack>
            <TextField label="Endereço" fullWidth value={form.address} onChange={tf('address')} />
            <Stack direction="row" spacing={2}>
              <TextField label="Latitude" type="number" fullWidth value={form.latitude} onChange={tf('latitude')} inputProps={{ step: 0.0001 }} />
              <TextField label="Longitude" type="number" fullWidth value={form.longitude} onChange={tf('longitude')} inputProps={{ step: 0.0001 }} />
            </Stack>
            <Stack direction="row" gap={4}>
              <FormControlLabel control={<Switch checked={form.isGarage} onChange={(e) => setForm((p) => ({ ...p, isGarage: e.target.checked }))} />} label="É Garagem" />
              <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />} label="Ativo" />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Excluir Terminal" message={`Excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </PageContainer>
  );
}

export default function TerminalsPage() { return <NotifyProvider><TerminalsInner /></NotifyProvider>; }
