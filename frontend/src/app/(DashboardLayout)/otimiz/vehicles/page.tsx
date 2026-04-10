'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, InputAdornment, useTheme,
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconBus,
  IconCurrencyDollar,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import KpiCard from '../_components/KpiCard';
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
      const data = await vehicleTypesApi.getAll();
      setItems(extractArray(data));
    } catch { notify.error('Falha ao carregar tipos de veículo.'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (t: VehicleType) => {
    setEditTarget(t);
    setForm({ name: t.name, code: t.code ?? '', passengerCapacity: String(t.passengerCapacity), costPerKm: String(t.costPerKm),
      costPerHour: String(t.costPerHour), fixedCost: String(t.fixedCost), isActive: t.isActive });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.passengerCapacity) { notify.warning('Nome e capacidade são obrigatórios.'); return; }
    setSaving(true);
    try {
      const user = getSessionUser();
      const payload = {
        companyId: user?.companyId ?? 1,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase() || undefined,
        passengerCapacity: parseInt(form.passengerCapacity),
        costPerKm: parseFloat(form.costPerKm) || 0,
        costPerHour: parseFloat(form.costPerHour) || 0,
        fixedCost: parseFloat(form.fixedCost) || 0,
        isActive: form.isActive,
      };
      if (editTarget) { await vehicleTypesApi.update(editTarget.id, payload); notify.success('Tipo atualizado!'); }
      else { await vehicleTypesApi.create(payload); notify.success('Tipo criado!'); }
      setDialogOpen(false); load();
    } catch (e: any) { notify.error(e?.response?.data?.message ?? 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try {
      await vehicleTypesApi.delete(deleteTarget.id);
      notify.success('Tipo de veículo excluído!'); setDeleteTarget(null); load();
    } catch (e: any) { notify.error(e?.response?.data?.message ?? 'Erro ao excluir.'); }
    finally { setDeleting(false); }
  };

  const vf = (key: keyof VehicleForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const active = items.filter((i) => i.isActive);
  const avgCapacity = items.length ? Math.round(items.reduce((s, i) => s + i.passengerCapacity, 0) / items.length) : 0;
  const avgCost = items.length ? items.reduce((s, i) => s + i.costPerKm, 0) / items.length : 0;

  return (
    <PageContainer title="Frota — OTIMIZ" description="Tipos de veículos">
      <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Frota</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Tipos de veículos, capacidades e estrutura de custos</Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>Novo Tipo</Button>
        </Stack>
      </Stack>

      {!loading && items.length > 0 && (
        <Grid container spacing={3} mb={3}>
          {[
            { title: 'Total de Tipos', value: items.length, subtitle: 'cadastrados', icon: <IconBus size={26} />, color: theme.palette.primary.main },
            { title: 'Tipos Ativos', value: active.length, subtitle: `${items.length - active.length} inativos`, icon: <IconBus size={26} />, color: '#13DEB9' },
            { title: 'Capacidade Média', value: `${avgCapacity}`, subtitle: 'passageiros', icon: <IconBus size={26} />, color: '#FFAE1F' },
            { title: 'Custo Médio/km', value: fmtR(avgCost), subtitle: 'por quilômetro', icon: <IconCurrencyDollar size={26} />, color: '#FA896B' },
          ].map((c) => (
            <Grid item xs={12} sm={6} md={3} key={c.title}>
              <KpiCard {...c} />
            </Grid>
          ))}
        </Grid>
      )}

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField size="small" placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          <Typography variant="caption" color="text.secondary" ml="auto">{filtered.length} tipo{filtered.length !== 1 ? 's' : ''}</Typography>
        </Stack>
      </Paper>

      <DashboardCard title="">
        {loading ? <Box>{[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Capacidade</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Custo/km</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Custo/hora</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Custo Fixo/dia</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <IconBus size={40} color={theme.palette.grey[400]} />
                    <Typography variant="body2" color="text.secondary" mt={1}>Nenhum tipo de veículo encontrado.</Typography>
                  </TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={500}>{t.name}</Typography></TableCell>
                    <TableCell align="center"><Typography variant="body2">{t.passengerCapacity} pass.</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{fmtR(t.costPerKm)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{fmtR(t.costPerHour)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{fmtR(t.fixedCost)}</Typography></TableCell>
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
        <DialogTitle sx={{ fontWeight: 700 }}>{editTarget ? 'Editar Tipo de Veículo' : 'Novo Tipo de Veículo'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField label="Nome do Tipo" required fullWidth placeholder="Ex: Ônibus Padrão, Articulado" value={form.name} onChange={vf('name')} />
            <Stack direction="row" spacing={2}>
              <TextField label="Código" sx={{ width: 140 }} value={form.code} onChange={vf('code')} inputProps={{ maxLength: 20, style: { textTransform: 'uppercase' } }} />
              <TextField label="Capacidade de Passageiros" required fullWidth type="number" value={numVal(form.passengerCapacity)} onChange={vf('passengerCapacity')}
                InputProps={{ endAdornment: <InputAdornment position="end">pass.</InputAdornment> }} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Custo por km" fullWidth type="number" value={numVal(form.costPerKm)} onChange={vf('costPerKm')}
                InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} inputProps={{ step: 0.01 }} />
              <TextField label="Custo por hora" fullWidth type="number" value={numVal(form.costPerHour)} onChange={vf('costPerHour')}
                InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} inputProps={{ step: 0.01 }} />
            </Stack>
            <TextField label="Custo Fixo Diário" fullWidth type="number" value={numVal(form.fixedCost)} onChange={vf('fixedCost')}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} inputProps={{ step: 0.01 }} />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />} label="Tipo ativo" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.passengerCapacity}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Excluir Tipo de Veículo" message={`Excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      </Box>
    </PageContainer>
  );
}

export default function VehiclesPage() { return <NotifyProvider><VehiclesInner /></NotifyProvider>; }
