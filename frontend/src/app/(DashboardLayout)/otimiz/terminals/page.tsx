'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, InputAdornment, useTheme, Card, CardContent, Grid, Divider, Chip
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
      setItems(extractArray(await terminalsApi.getAll()));
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
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={4} pt={2}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 1.6, color: 'primary.main', fontWeight: 800 }}>
            GEOSPATIAL ASSETS
          </Typography>
          <Typography variant="h3" fontWeight={800} mt={0.5}>Terminais & Garagens</Typography>
          <Typography variant="body1" color="text.secondary" mt={1}>Gerenciamento geolocalizado dos nós da rede de transporte.</Typography>
        </Box>
        <Stack direction="row" gap={2}>
          <Tooltip title="Sincronizar">
            <IconButton onClick={load} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <IconRefresh size={20} color={theme.palette.primary.main} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="large" startIcon={<IconPlus />} onClick={openCreate} sx={{ borderRadius: 2 }}>
            Cadastrar Nó
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, mb: 4 }}>
        <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" placeholder="Filtrar por nome ou sigla..." value={search} onChange={(e) => setSearch(e.target.value)} fullWidth sx={{ maxWidth: { md: 400 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" ml="auto">{filtered.length} locais de infraestrutura</Typography>
        </Stack>
      </Paper>

      {loading ? (
        <Grid container spacing={2}>
          {[...Array(6)].map((_, i) => <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={160} /></Grid>)}
        </Grid>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={12} bgcolor="grey.50" borderRadius={3} border="1px dashed" borderColor="divider">
          <IconMapPin size={64} color="#BDBDBD" />
          <Typography variant="h6" color="text.secondary" mt={2}>Nenhuma infraestrutura cadastrada nesse filtro.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((t) => (
             <Grid item xs={12} sm={6} md={4} key={t.id}>
                <Card variant="outlined" sx={{ borderRadius: 3, transition: '0.2s', '&:hover': { borderColor: t.isGarage ? 'warning.main' : 'primary.main', boxShadow: '0 8px 16px rgba(0,0,0,0.05)' }}}>
                   <CardContent sx={{ p: '20px !important' }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                         <Box sx={{ p: 1, borderRadius: 2, bgcolor: t.isGarage ? 'warning.lighter' : 'primary.lighter', color: t.isGarage ? 'warning.dark' : 'primary.dark' }}>
                            {t.isGarage ? <IconBuildingWarehouse size={24} /> : <IconMapPin size={24} />}
                         </Box>
                         <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" onClick={() => openEdit(t)} sx={{ bgcolor: 'grey.50'}}><IconEdit size={16} /></IconButton>
                            <IconButton size="small" onClick={() => setDeleteTarget(t)} sx={{ bgcolor: 'error.lighter', color: 'error.main' }}><IconTrash size={16} /></IconButton>
                         </Stack>
                      </Stack>
                      <Typography variant="caption" fontFamily="monospace" fontWeight={700} color="text.secondary">{t.shortName ?? 'S/N'}</Typography>
                      <Typography variant="h6" fontWeight={700} noWrap>{t.name}</Typography>
                      <Stack direction="row" alignItems="center" gap={0.5} mt={1} mb={2}>
                         <IconLocation size={14} color={theme.palette.text.disabled} />
                         <Typography variant="body2" color="text.secondary" noWrap>{t.address || 'Sem endereço'}</Typography>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                         <Chip size="small" label={t.isGarage ? 'Garagem' : 'Terminal'} color={t.isGarage ? 'warning' : 'default'} variant="outlined" />
                         <StatusChip type="status" value={t.isActive ? 'active' : 'inactive'} />
                      </Stack>
                   </CardContent>
                </Card>
             </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
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
