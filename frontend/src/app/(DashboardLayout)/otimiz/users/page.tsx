'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { alpha } from '@mui/material/styles';
import {
  Box, Avatar, Typography, Button, Paper, Stack, Skeleton, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, InputAdornment, useTheme, Card, CardContent, Grid, Divider
} from '@mui/material';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconUsers, IconEye, IconEyeOff } from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
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
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={4} pt={2}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 1.6, color: 'primary.main', fontWeight: 800 }}>
            ACCESS CONTROL
          </Typography>
          <Typography variant="h3" fontWeight={800} mt={0.5}>Usuários e Credenciais</Typography>
          <Typography variant="body1" color="text.secondary" mt={1}>Visão simplificada do organograma de acesso da sua plataforma operatória OTIMIZ.</Typography>
        </Box>
        <Stack direction="row" gap={2}>
          <Tooltip title="Recarregar">
            <IconButton onClick={load} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <IconRefresh size={20} color={theme.palette.primary.main} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="large" startIcon={<IconPlus />} onClick={openCreate} sx={{ borderRadius: 2 }}>
            Convidar Usuário
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, mb: 4, background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.light, 0.05)} 100%)` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <TextField size="small" placeholder="Localizar credenciais (nome ou e-mail)..." value={search} onChange={(e) => setSearch(e.target.value)} fullWidth sx={{ maxWidth: { md: 400 } }} InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
          <TextField size="small" select label="Filtro de Perfil" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | '')} sx={{ minWidth: 200 }}>
            <MenuItem value="">Todos os perfis</MenuItem>
            {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <Box display="flex" alignItems="center" ml="auto">
            <Typography variant="subtitle2" fontWeight={700} color="primary.main">{filtered.length} credenciais ativas</Typography>
          </Box>
        </Stack>
      </Paper>

      {loading ? (
        <Grid container spacing={2}>
          {[...Array(6)].map((_, i) => <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={140} /></Grid>)}
        </Grid>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={12} bgcolor="grey.50" borderRadius={3} border="1px dashed" borderColor="divider">
          <IconUsers size={64} color="#BDBDBD" />
          <Typography variant="h6" color="text.secondary" mt={2}>Nenhum usuário encontrado na busca.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((u) => (
            <Grid item xs={12} sm={6} md={4} key={u.id}>
              <Card variant="outlined" sx={{ borderRadius: 3, transition: '0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' } }}>
                <CardContent sx={{ p: '24px !important' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Avatar sx={{ width: 56, height: 56, bgcolor: stringToColor(u.name), fontSize: 22, fontWeight: 700 }}>{u.name[0].toUpperCase()}</Avatar>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => openEdit(u)} sx={{ bgcolor: 'grey.50' }}><IconEdit size={16} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(u)} sx={{ bgcolor: 'error.lighter', color: 'error.main' }}><IconTrash size={16} /></IconButton>
                    </Stack>
                  </Stack>
                  <Typography variant="h6" fontWeight={800} noWrap>{u.name}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap mb={2}>{u.email}</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <StatusChip type="role" value={u.role} />
                    <StatusChip type="status" value={u.status} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
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
          <Button onClick={() => setDialogOpen(false)} disabled={saving} color="inherit">Cancelar Operação</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.email} sx={{ borderRadius: 2 }}>
            {saving ? 'Registrando...' : 'Confirmar Registro'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Remover Acesso" message={`Remover bloqueia "${deleteTarget?.name}" permanentemente. Continuar?`}
        confirmLabel="Remover" loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </PageContainer>
  );
}

export default function UsersPage() { return <NotifyProvider><UsersInner /></NotifyProvider>; }
