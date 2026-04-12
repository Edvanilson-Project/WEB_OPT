'use client';
import { getErrorMessage } from "@/utils/getErrorMessage";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Avatar, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, InputAdornment, useTheme,
} from '@mui/material';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconBuilding } from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { companiesApi } from '@/lib/api';
import type { Company } from '../_types';
import { extractArray } from '../_types';
import { useDebounce } from '@/utils/useDebounce';
import { dialogTitleSx } from '../_tokens/design-tokens';

interface CompanyForm { name: string; tradeName: string; cnpj: string; phone: string; address: string; city: string; state: string; status: string; }
const EMPTY: CompanyForm = { name: '', tradeName: '', cnpj: '', phone: '', address: '', city: '', state: '', status: 'active' };

const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

function stringToColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) { h = s.charCodeAt(i) + ((h << 5) - h); }
  return `hsl(${h % 360},55%,55%)`;
}

function CompaniesInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [items, setItems] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(extractArray(await companiesApi.getAll())); }
    catch { notify.error('Falha ao carregar empresas.'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((c) =>
    c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (c.tradeName ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (c.cnpj ?? '').includes(debouncedSearch),
  );

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c: Company) => {
    setEditTarget(c); setForm({ name: c.name, tradeName: c.tradeName ?? '', cnpj: c.cnpj ? formatCNPJ(c.cnpj) : '', phone: c.phone ?? '', address: c.address ?? '', city: c.city ?? '', state: c.state ?? '', status: c.status }); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.cnpj.trim()) { notify.warning('Razão social e CNPJ são obrigatórios.'); return; }
    setSaving(true);
    try {
      const p = { name: form.name.trim(), tradeName: form.tradeName.trim() || undefined, cnpj: form.cnpj.replace(/\D/g, ''), phone: form.phone.trim() || undefined, address: form.address.trim() || undefined, city: form.city.trim() || undefined, state: form.state.trim() || undefined, status: form.status };
      if (editTarget) { await companiesApi.update(editTarget.id, p); notify.success('Empresa atualizada!'); }
      else { await companiesApi.create(p); notify.success('Empresa criada!'); }
      setDialogOpen(false); load();
    } catch (e: unknown) { notify.error(getErrorMessage(e, 'Erro ao salvar.')); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try { await companiesApi.delete(deleteTarget.id); notify.success('Empresa excluída!'); setDeleteTarget(null); load(); }
    catch (e: unknown) { notify.error(getErrorMessage(e, 'Erro ao excluir.')); }
    finally { setDeleting(false); }
  };

  const cf = (k: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: k === 'cnpj' ? formatCNPJ(e.target.value) : e.target.value }));

  return (
    <PageContainer title="Empresas — OTIMIZ" description="Cadastro de operadoras de transporte">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Empresas</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Operadoras e concessionárias de transporte público</Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>Nova Empresa</Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField size="small" placeholder="Buscar por nome, CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 340 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          <Typography variant="caption" color="text.secondary" ml="auto">{filtered.length} empresa{filtered.length !== 1 ? 's' : ''}</Typography>
        </Stack>
      </Paper>

      <DashboardCard title="">
        {loading ? <Box>{[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={52} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Empresa</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>CNPJ</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Localidade</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <IconBuilding size={40} color={theme.palette.grey[400]} />
                    <Typography variant="body2" color="text.secondary" mt={1}>Nenhuma empresa encontrada.</Typography>
                  </TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: stringToColor(c.name), fontSize: 14 }}>{c.name[0].toUpperCase()}</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                          {c.tradeName && <Typography variant="caption" color="text.secondary">{c.tradeName}</Typography>}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2" fontFamily="monospace">{c.cnpj ? formatCNPJ(c.cnpj) : '—'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.city ? `${c.city}${c.state ? `/${c.state}` : ''}` : '—'}</Typography>
                      {c.phone && <Typography variant="caption" color="text.secondary">{c.phone}</Typography>}
                    </TableCell>
                    <TableCell align="center"><StatusChip type="status" value={c.status} /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(c)}><IconEdit size={16} /></IconButton></Tooltip>
                      <Tooltip title="Excluir"><IconButton size="small" color="error" onClick={() => setDeleteTarget(c)}><IconTrash size={16} /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DashboardCard>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogTitleSx}>{editTarget ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField label="Razão Social" required fullWidth value={form.name} onChange={cf('name')} />
            <TextField label="Nome Fantasia" fullWidth value={form.tradeName} onChange={cf('tradeName')} />
            <TextField label="CNPJ" required fullWidth value={form.cnpj} onChange={cf('cnpj')} placeholder="00.000.000/0000-00" inputProps={{ maxLength: 18 }} />
            <Stack direction="row" spacing={2}>
              <TextField label="Telefone" fullWidth value={form.phone} onChange={cf('phone')} />
              <TextField label="Status" select sx={{ minWidth: 140 }} value={form.status} onChange={cf('status')}>
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </TextField>
            </Stack>
            <TextField label="Endereço" fullWidth value={form.address} onChange={cf('address')} />
            <Stack direction="row" spacing={2}>
              <TextField label="Cidade" fullWidth value={form.city} onChange={cf('city')} />
              <TextField label="UF" sx={{ width: 90 }} value={form.state} onChange={cf('state')} inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.cnpj}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Excluir Empresa" message={`Excluir "${deleteTarget?.name}"? Todos os dados associados serão removidos.`}
        confirmLabel="Excluir" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </PageContainer>
  );
}

export default function CompaniesPage() { return <NotifyProvider><CompaniesInner /></NotifyProvider>; }
