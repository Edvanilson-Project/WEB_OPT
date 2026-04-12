'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, InputAdornment, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconBus,
  IconCurrencyDollar, IconUsers, 
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Frota</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={16} />} onClick={openCreate}>Novo Veículo</Button>
        </Stack>
      </Stack>



      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <TextField size="small" placeholder="Buscar veículo..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 300 }}
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
        <Box textAlign="center" py={12} bgcolor="grey.50" borderRadius={3} border="1px dashed" borderColor="divider">
          <IconBus size={64} color="#BDBDBD" />
          <Typography variant="h6" color="text.secondary" mt={2}>Nenhum modelo encontrado nesse filtro.</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>Modelo</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Capacidade</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Custo/km</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Custo/h</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Fixo Diário</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: 'primary.lighter', color: 'primary.dark', display: 'flex' }}>
                        <IconBus size={16} />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{t.name}</Typography>
                        {t.code && <Typography variant="caption" fontFamily="monospace" color="text.secondary">{t.code}</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={`${t.passengerCapacity} pass.`} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{fmtR(t.costPerKm)}/km</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{fmtR(t.costPerHour)}/h</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>{fmtR(t.fixedCost)}</Typography>
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

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
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
