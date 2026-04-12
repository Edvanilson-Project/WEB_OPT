'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Avatar, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, TableContainer
} from '@mui/material';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconUsers, IconEye, IconEyeOff } from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { usersApi } from '@/lib/api';
import type { User, UserRole } from '../_types';
import { extractArray } from '../_types';
import { useDebounce } from '@/utils/useDebounce';

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
  const notify = useNotify();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
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
    const q = debouncedSearch.toLowerCase();
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
    if (!form.name.trim() || !form.email.trim()) return notify.warning('Nome e e-mail são obrigatórios.');
    if (!editTarget && !form.password) return notify.warning('Senha é obrigatória para novo usuário.');
    setSaving(true);
    try {
      const p: any = { name: form.name.trim(), email: form.email.trim(), role: form.role, status: form.status };
      if (form.password) p.password = form.password;
      if (editTarget) { await usersApi.update(editTarget.id, p); notify.success('Usuário atualizado!'); }
      else { await usersApi.create(p); notify.success('Usuário criado!'); }
      setDialogOpen(false); load();
    } catch { notify.error('Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try { await usersApi.delete(deleteTarget.id); notify.success('Usuário excluído!'); setDeleteTarget(null); load(); }
    catch { notify.error('Erro ao excluir.'); }
    finally { setDeleting(false); }
  };

  const uf = (k: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <PageContainer title="Usuários — OTIMIZ" description="Controle de Acesso Enterprise">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Usuários</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Recarregar"><IconButton onClick={load} size="small"><IconRefresh size={18} /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={16} />} onClick={openCreate}>Novo Usuário</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <TextField size="small" placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
        <TextField size="small" select label="Perfil" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | '')} sx={{ minWidth: 160 }}>
          <MenuItem value="">Todos</MenuItem>
          {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
        </TextField>
        <Typography variant="body2" color="text.secondary">{filtered.length} registros</Typography>
      </Stack>

      {loading ? (
        <Box>{[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 0.5, borderRadius: 1 }} />)}</Box>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={6}><Typography color="text.secondary">Nenhum usuário encontrado.</Typography></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Usuário</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>E-mail</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Perfil</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, bgcolor: stringToColor(u.name), fontSize: 14, fontWeight: 700 }}>{u.name[0].toUpperCase()}</Avatar>
                      <Typography variant="body2" fontWeight={600}>{u.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{u.email}</Typography></TableCell>
                  <TableCell><StatusChip type="role" value={u.role} /></TableCell>
                  <TableCell align="center"><StatusChip type="status" value={u.status} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(u)}><IconEdit size={15} /></IconButton></Tooltip>
                      <Tooltip title="Excluir"><IconButton size="small" onClick={() => setDeleteTarget(u)} color="error"><IconTrash size={15} /></IconButton></Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{editTarget ? 'Editar Credenciais' : 'Nova Credencial'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField label="Nome Completo" required fullWidth value={form.name} onChange={uf('name')} />
            <TextField label="E-mail Operacional" required fullWidth type="email" value={form.email} onChange={uf('email')} />
            <TextField
              label={editTarget ? 'Redefinir Senha' : 'Senha de Acesso'}
              required={!editTarget}
              fullWidth
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={uf('password')}
              helperText={editTarget ? 'Deixe em branco para manter a senha atual inviolável.' : undefined}
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
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <TextField label="Perfil de Acesso" select fullWidth value={form.role} onChange={uf('role')} sx={{ flex: 1, minWidth: 200 }}>
                {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
              <TextField label="Acesso" select fullWidth value={form.status} onChange={uf('status')} sx={{ flex: 1, minWidth: 200 }}>
                <MenuItem value="active">Permitido</MenuItem>
                <MenuItem value="inactive">Bloqueado</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.email} sx={{ borderRadius: 2 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Remover Acesso" message={`Remover bloqueia "${deleteTarget?.name}" permanentemente. Continuar?`}
        confirmLabel="Remover" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </PageContainer>
  );
}

export default function UsersPage() { return <NotifyProvider><UsersInner /></NotifyProvider>; }
