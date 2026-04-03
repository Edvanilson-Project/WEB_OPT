'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Avatar, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, InputAdornment, useTheme,
} from '@mui/material';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconUsers, IconEye, IconEyeOff } from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { usersApi } from '@/lib/api';
import type { User, UserRole } from '../_types';
import { extractArray } from '../_types';

interface UserForm { name: string; email: string; password: string; role: UserRole; status: string; }
const EMPTY: UserForm = { name: '', email: '', password: '', role: 'analyst', status: 'active' };

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin',   label: 'Super Administrador' },
  { value: 'company_admin', label: 'Admin da Empresa' },
  { value: 'analyst',       label: 'Analista' },
  { value: 'operator',      label: 'Operador' },
];

function stringToColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) { h = s.charCodeAt(i) + ((h << 5) - h); }
  return `hsl(${h % 360},55%,50%)`;
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function UsersInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(extractArray(await usersApi.getAll())); }
    catch { notify.error('Falha ao carregar usuários.'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((u) => {
    const q = search.toLowerCase();
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchR = !roleFilter || u.role === roleFilter;
    return matchQ && matchR;
  });

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setShowPwd(false); setDialogOpen(true); };
  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, status: u.status });
    setShowPwd(false); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { notify.warning('Nome e e-mail são obrigatórios.'); return; }
    if (!editTarget && !form.password) { notify.warning('Senha é obrigatória para novo usuário.'); return; }
    setSaving(true);
    try {
      const p: any = { name: form.name.trim(), email: form.email.trim(), role: form.role, status: form.status };
      if (form.password) p.password = form.password;
      if (editTarget) { await usersApi.update(editTarget.id, p); notify.success('Usuário atualizado!'); }
      else { await usersApi.create(p); notify.success('Usuário criado!'); }
      setDialogOpen(false); load();
    } catch (e: any) { notify.error(e?.response?.data?.message ?? 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try { await usersApi.delete(deleteTarget.id); notify.success('Usuário excluído!'); setDeleteTarget(null); load(); }
    catch (e: any) { notify.error(e?.response?.data?.message ?? 'Erro ao excluir.'); }
    finally { setDeleting(false); }
  };

  const uf = (k: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <PageContainer title="Usuários — OTIMIZ" description="Gestão de usuários do sistema">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Usuários</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Gerencie o acesso e perfis dos usuários do sistema</Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>Novo Usuário</Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          <TextField size="small" select label="Perfil" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | '')} sx={{ width: 160 }}>
            <MenuItem value="">Todos os perfis</MenuItem>
            {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <Typography variant="caption" color="text.secondary" ml="auto">{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</Typography>
        </Stack>
      </Paper>

      <DashboardCard title="">
        {loading ? <Box>{[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={52} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Usuário</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>E-mail</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Perfil</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Último Acesso</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <IconUsers size={40} color={theme.palette.grey[400]} />
                    <Typography variant="body2" color="text.secondary" mt={1}>Nenhum usuário encontrado.</Typography>
                  </TableCell></TableRow>
                ) : filtered.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: stringToColor(u.name), fontSize: 14 }}>{u.name[0].toUpperCase()}</Avatar>
                        <Typography variant="body2" fontWeight={600}>{u.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2">{u.email}</Typography></TableCell>
                    <TableCell align="center"><StatusChip type="role" value={u.role} /></TableCell>
                    <TableCell align="center"><StatusChip type="status" value={u.status} /></TableCell>
                    <TableCell align="center"><Typography variant="body2" color="text.secondary">{fmtDate(u.lastLoginAt)}</Typography></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(u)}><IconEdit size={16} /></IconButton></Tooltip>
                      <Tooltip title="Excluir"><IconButton size="small" color="error" onClick={() => setDeleteTarget(u)}><IconTrash size={16} /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DashboardCard>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editTarget ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField label="Nome Completo" required fullWidth value={form.name} onChange={uf('name')} />
            <TextField label="E-mail" required fullWidth type="email" value={form.email} onChange={uf('email')} />
            <TextField
              label={editTarget ? 'Nova Senha' : 'Senha'}
              required={!editTarget}
              fullWidth
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={uf('password')}
              helperText={editTarget ? 'Deixe em branco para manter a senha atual.' : undefined}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPwd((p) => !p)}>
                      {showPwd ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={2}>
              <TextField label="Perfil" select fullWidth value={form.role} onChange={uf('role')}>
                {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
              <TextField label="Status" select fullWidth value={form.status} onChange={uf('status')}>
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.email}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Excluir Usuário" message={`Excluir "${deleteTarget?.name}"? O acesso ao sistema será removido imediatamente.`}
        confirmLabel="Excluir" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </PageContainer>
  );
}

export default function UsersPage() { return <NotifyProvider><UsersInner /></NotifyProvider>; }
