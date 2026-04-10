'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, InputAdornment, useTheme, Card, CardContent, Divider
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconBus,
  IconCurrencyDollar, IconUsers
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { vehicleTypesApi, getSessionUser } from '@/lib/api';
import type { VehicleType } from '../_types';
import { extractArray, numVal } from '../_types';

interface VehicleForm {
  name: string; code: string; passengerCapacity: string; costPerKm: string;
  costPerHour: string; fixedCost: string; isActive: boolean;
}
const EMPTY: VehicleForm = { name: '', code: '', passengerCapacity: '', costPerKm: '', costPerHour: '', fixedCost: '', isActive: true };
const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

function VehiclesInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [items, setItems] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VehicleType | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(extractArray(await vehicleTypesApi.getAll()));
    } catch { notify.error('Falha ao carregar tipos de veículo.'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || (t.code?.toLowerCase() || '').includes(search.toLowerCase()));

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (t: VehicleType) => {
    setEditTarget(t);
    setForm({ name: t.name, code: t.code ?? '', passengerCapacity: String(t.passengerCapacity), costPerKm: String(t.costPerKm),
      costPerHour: String(t.costPerHour), fixedCost: String(t.fixedCost), isActive: t.isActive });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.passengerCapacity) return notify.warning('Nome e capacidade são obrigatórios.');
    setSaving(true);
    try {
      const payload = {
        companyId: getSessionUser()?.companyId ?? 1,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase() || undefined,
        passengerCapacity: parseInt(form.passengerCapacity) || 0,
        costPerKm: parseFloat(form.costPerKm) || 0,
        costPerHour: parseFloat(form.costPerHour) || 0,
        fixedCost: parseFloat(form.fixedCost) || 0,
        isActive: form.isActive,
      };
      if (editTarget) { await vehicleTypesApi.update(editTarget.id, payload); notify.success('Tipo atualizado!'); }
      else { await vehicleTypesApi.create(payload); notify.success('Tipo criado!'); }
      setDialogOpen(false); load();
    } catch { notify.error('Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try {
      await vehicleTypesApi.delete(deleteTarget.id);
      notify.success('Tipo de veículo excluído!'); setDeleteTarget(null); load();
    } catch { notify.error('Erro ao excluir.'); }
    finally { setDeleting(false); }
  };

  const vf = (key: keyof VehicleForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const active = items.filter((i) => i.isActive);
  const avgCapacity = items.length ? Math.round(items.reduce((s, i) => s + i.passengerCapacity, 0) / items.length) : 0;
  
  return (
    <PageContainer title="Frota Enterprise — OTIMIZ" description="Catálogo de frotas operacionais">
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={4} pt={2}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 1.6, color: 'primary.main', fontWeight: 800 }}>
            FLEET ASSETS
          </Typography>
          <Typography variant="h3" fontWeight={800} mt={0.5}>Frotas e Costing</Typography>
          <Typography variant="body1" color="text.secondary" mt={1}>Gerenciamento dos chassis e perfis de custo para otimização.</Typography>
        </Box>
        <Stack direction="row" gap={2}>
          <Tooltip title="Recarregar">
            <IconButton onClick={load} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <IconRefresh size={20} color={theme.palette.primary.main} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="large" startIcon={<IconPlus />} onClick={openCreate} sx={{ borderRadius: 2 }}>
            Novo Chassi
          </Button>
        </Stack>
      </Stack>

      {!loading && items.length > 0 && (
         <Grid container spacing={3} mb={4}>
           {[
             { title: 'Catálogo de Frota', value: items.length, color: 'primary.main' },
             { title: 'Chassis Ativos', value: active.length, color: 'success.main' },
             { title: 'Lotação Média', value: avgCapacity, color: 'warning.main' },
           ].map((c) => (
             <Grid item xs={12} md={4} key={c.title}>
               <Card variant="outlined" sx={{ borderRadius: 3, borderLeft: `6px solid`, borderLeftColor: c.color }}>
                 <CardContent>
                   <Typography variant="caption" color="text.secondary">{c.title}</Typography>
                   <Typography variant="h4" fontWeight={800} mt={1}>{c.value}</Typography>
                 </CardContent>
               </Card>
             </Grid>
           ))}
         </Grid>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, mb: 4 }}>
        <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" placeholder="Localizar modelo ou código..." value={search} onChange={(e) => setSearch(e.target.value)} fullWidth sx={{ maxWidth: { md: 400 } }} InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" ml="auto">{filtered.length} chassis cadastrados</Typography>
        </Stack>
      </Paper>

      {loading ? (
        <Grid container spacing={2}>
           {[...Array(6)].map((_, i) => <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={160} /></Grid>)}
        </Grid>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={12} bgcolor="grey.50" borderRadius={3} border="1px dashed" borderColor="divider">
          <IconBus size={64} color="#BDBDBD" />
          <Typography variant="h6" color="text.secondary" mt={2}>Nenhum chassi encontrado nesse filtro.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
           {filtered.map((t) => (
             <Grid item xs={12} sm={6} md={4} key={t.id}>
                <Card variant="outlined" sx={{ borderRadius: 3, transition: '0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 16px rgba(0,0,0,0.05)' }}}>
                   <CardContent sx={{ p: '20px !important' }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                         <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'primary.lighter', color: 'primary.dark' }}>
                            <IconBus size={24} />
                         </Box>
                         <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" onClick={() => openEdit(t)} sx={{ bgcolor: 'grey.50'}}><IconEdit size={16} /></IconButton>
                            <IconButton size="small" onClick={() => setDeleteTarget(t)} sx={{ bgcolor: 'error.lighter', color: 'error.main' }}><IconTrash size={16} /></IconButton>
                         </Stack>
                      </Stack>
                      <Typography variant="caption" fontFamily="monospace" fontWeight={700} color="text.secondary">{t.code ?? 'S/N'}</Typography>
                      <Typography variant="h6" fontWeight={800} noWrap>{t.name}</Typography>
                      
                      <Stack direction="row" gap={3} mt={2} mb={2}>
                         <Box>
                           <Typography variant="caption" color="text.secondary" display="block">Capacidade</Typography>
                           <Stack direction="row" alignItems="center" gap={0.5}>
                             <IconUsers size={14} color={theme.palette.text.disabled}/>
                             <Typography variant="body2" fontWeight={700}>{t.passengerCapacity}</Typography>
                           </Stack>
                         </Box>
                         <Box>
                           <Typography variant="caption" color="text.secondary" display="block">Custo Diário</Typography>
                           <Stack direction="row" alignItems="center" gap={0.5}>
                             <IconCurrencyDollar size={14} color={theme.palette.text.disabled}/>
                             <Typography variant="body2" fontWeight={700}>{fmtR(t.fixedCost)}</Typography>
                           </Stack>
                         </Box>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                         <Typography variant="caption" color="text.secondary">Rodagem: {fmtR(t.costPerKm)}/km</Typography>
                         <StatusChip type="status" value={t.isActive ? 'active' : 'inactive'} />
                      </Stack>
                   </CardContent>
                </Card>
             </Grid>
           ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editTarget ? 'Editar Chassi' : 'Novo Chassi Operacional'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField label="Modelo do Veículo" required fullWidth placeholder="Ex: Ônibus Articulado" value={form.name} onChange={vf('name')} />
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <TextField label="Código Frota" sx={{ flex: 1, minWidth: 140 }} value={form.code} onChange={vf('code')} inputProps={{ maxLength: 20, style: { textTransform: 'uppercase' } }} />
              <TextField label="Capacidade Física" required type="number" sx={{ flex: 1, minWidth: 140 }} value={numVal(form.passengerCapacity)} onChange={vf('passengerCapacity')} InputProps={{ endAdornment: <InputAdornment position="end">pass.</InputAdornment> }} />
            </Stack>
            
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mt={2}>Matriz de Custos para Otimização</Typography>
            <Stack direction="row" spacing={2} bgcolor="grey.50" p={2} borderRadius={2}>
              <TextField label="Variável (por km)" fullWidth type="number" value={numVal(form.costPerKm)} onChange={vf('costPerKm')} InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} inputProps={{ step: 0.01 }} />
              <TextField label="Variável (por hora)" fullWidth type="number" value={numVal(form.costPerHour)} onChange={vf('costPerHour')} InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} inputProps={{ step: 0.01 }} />
            </Stack>
            <TextField label="Custo Fixo (Diário base)" fullWidth type="number" value={numVal(form.fixedCost)} onChange={vf('fixedCost')} InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} inputProps={{ step: 0.01 }} />
            
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} color="primary" />} label="Habilitado para uso no Solver" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} color="inherit">Ignorar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.passengerCapacity} sx={{ borderRadius: 2 }}>{saving ? 'Registrando...' : 'Gravar na Base'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Desativar Frota" message={`Atenção: remover "${deleteTarget?.name}" pode invalidar resultados de otimização antigos que usaram este chassi.`}
        confirmLabel="Remover" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </PageContainer>
  );
}

export default function VehiclesPage() { return <NotifyProvider><VehiclesInner /></NotifyProvider>; }
