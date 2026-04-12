'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, InputAdornment, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconMapPin,
  IconBuildingWarehouse, IconLocation
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { terminalsApi, getSessionUser } from '@/lib/api';
import type { Terminal } from '../_types';
import { extractArray } from '../_types';
import { useDebounce } from '@/utils/useDebounce';

interface TerminalForm {
  name: string; shortName: string; address: string;
  latitude: string; longitude: string; isGarage: boolean; isActive: boolean;
}
const EMPTY: TerminalForm = { name: '', shortName: '', address: '', latitude: '', longitude: '', isGarage: false, isActive: true };

function TerminalsInner() {
  const notify = useNotify();
  const [items, setItems] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Terminal | null>(null);
  const [form, setForm] = useState<TerminalForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Terminal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(extractArray(await terminalsApi.getAll()));
    } catch { notify.error('Falha ao carregar terminais.'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(
    (t) => t.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || (t.shortName ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()),
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
    if (!form.name.trim()) return notify.warning('Nome é obrigatório.');
    const lat = form.latitude ? parseFloat(form.latitude) : undefined;
    const lng = form.longitude ? parseFloat(form.longitude) : undefined;
    if (lat != null && (lat < -90 || lat > 90)) return notify.warning('Latitude inválida.');
    if (lng != null && (lng < -180 || lng > 180)) return notify.warning('Longitude inválida.');
    
    setSaving(true);
    try {
      const payload = {
        companyId: getSessionUser()?.companyId ?? 1,
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
    } catch { notify.error('Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try {
      await terminalsApi.delete(deleteTarget.id);
      notify.success('Terminal excluído!'); setDeleteTarget(null); load();
    } catch { notify.error('Erro ao excluir.'); }
    finally { setDeleting(false); }
  };

  const tf = (key: keyof TerminalForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <PageContainer title="Terminais e Garagens — OTIMIZ" description="Gerenciar terminais da rede de transporte">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Terminais & Garagens</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={16} />} onClick={openCreate}>Novo Terminal</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <TextField size="small" placeholder="Buscar terminal..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
        <Typography variant="body2" color="text.secondary">{filtered.length} registros</Typography>
      </Stack>

      {loading ? (
        <Box>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={52} sx={{ mb: 0.5, borderRadius: 1 }} />
          ))}
        </Box>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary">Nenhum terminal encontrado.</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Sigla</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nome</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Endereço</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: t.isGarage ? 'warning.lighter' : 'primary.lighter', color: t.isGarage ? 'warning.dark' : 'primary.dark', display: 'flex' }}>
                        {t.isGarage ? <IconBuildingWarehouse size={16} /> : <IconMapPin size={16} />}
                      </Box>
                      <Chip size="small" label={t.isGarage ? 'Garagem' : 'Terminal'} color={t.isGarage ? 'warning' : 'default'} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace" fontWeight={700}>{t.shortName ?? '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>{t.address || '—'}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip type="status" value={t.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(t)} sx={{ bgcolor: 'grey.50' }}><IconEdit size={15} /></IconButton></Tooltip>
                      <Tooltip title="Excluir"><IconButton size="small" onClick={() => setDeleteTarget(t)} sx={{ bgcolor: 'error.lighter', color: 'error.main' }}><IconTrash size={15} /></IconButton></Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth >
        <DialogTitle sx={{ fontWeight: 800 }}>{editTarget ? 'Editar Local' : 'Cadastrar Local'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Nome da Instalação" required fullWidth value={form.name} onChange={tf('name')} />
              <TextField label="Cód/Sigla" sx={{ width: { sm: 140 } }} value={form.shortName} onChange={tf('shortName')} inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }} />
            </Stack>
            <TextField label="Endereço Completo" fullWidth value={form.address} onChange={tf('address')} />
            <Stack direction="row" spacing={2} bgcolor="grey.50" p={2} borderRadius={2}>
              <TextField label="Latitude" type="number" fullWidth value={form.latitude} onChange={tf('latitude')} inputProps={{ step: 0.0001 }} />
              <TextField label="Longitude" type="number" fullWidth value={form.longitude} onChange={tf('longitude')} inputProps={{ step: 0.0001 }} />
            </Stack>
            <Stack direction="row" gap={4}>
              <FormControlLabel control={<Switch checked={form.isGarage} onChange={(e) => setForm((p) => ({ ...p, isGarage: e.target.checked }))} color="warning" />} label="Sede/Garagem" />
              <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />} label="Nó Operante" />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name} sx={{ borderRadius: 2 }}>{saving ? 'Gravando...' : 'Salvar Registro'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Excluir Infraestrutura" message={`Remover "${deleteTarget?.name}"? Esta ação não pode ser desfeita e pode afetar jornadas e trips dependentes.`}
        confirmLabel="Deletar" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </PageContainer>
  );
}

export default function TerminalsPage() { return <NotifyProvider><TerminalsInner /></NotifyProvider>; }
