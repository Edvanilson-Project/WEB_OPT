'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, Stack, Alert, Skeleton, Tooltip,
  IconButton, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, InputAdornment, Chip, useTheme,
} from '@mui/material';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh, IconRoute,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import StatusChip from '../_components/StatusChip';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { linesApi, terminalsApi, getSessionUser } from '@/lib/api';
import type { Line, Terminal } from '../_types';
import { extractArray } from '../_types';

interface LineForm {
  code: string;
  name: string;
  originTerminalId: string;
  destinationTerminalId: string;
  distanceKm: string;
  avgTripDurationMinutes: string;
  status: string;
  colorHex: string;
}

const EMPTY: LineForm = {
  code: '', name: '', originTerminalId: '', destinationTerminalId: '',
  distanceKm: '', avgTripDurationMinutes: '', status: 'active', colorHex: '#5D87FF',
};

function LinesInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [lines, setLines] = useState<Line[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Line | null>(null);
  const [form, setForm] = useState<LineForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Line | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [linesData, terminalsData] = await Promise.allSettled([
        linesApi.getAll(),
        terminalsApi.getAll(),
      ]);
      if (linesData.status === 'fulfilled') setLines(extractArray(linesData.value));
      if (terminalsData.status === 'fulfilled') setTerminals(extractArray(terminalsData.value));
    } catch {
      notify.error('Falha ao carregar dados. Verifique a conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = lines.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (line: Line) => {
    setEditTarget(line);
    setForm({
      code: line.code, name: line.name,
      originTerminalId: String(line.originTerminalId),
      destinationTerminalId: String(line.destinationTerminalId),
      distanceKm: line.distanceKm != null ? String(line.distanceKm) : '',
      avgTripDurationMinutes: line.avgTripDurationMinutes != null ? String(line.avgTripDurationMinutes) : '',
      status: line.status,
      colorHex: line.colorHex ?? '#5D87FF',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.originTerminalId || !form.destinationTerminalId) {
      notify.warning('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const user = getSessionUser();
      const payload = {
        companyId: user?.companyId ?? 1,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        originTerminalId: Number(form.originTerminalId),
        destinationTerminalId: Number(form.destinationTerminalId),
        distanceKm: form.distanceKm ? parseFloat(form.distanceKm) : undefined,
        avgTripDurationMinutes: form.avgTripDurationMinutes ? parseInt(form.avgTripDurationMinutes) : undefined,
        status: form.status,
        colorHex: form.colorHex,
      };
      if (editTarget) {
        await linesApi.update(editTarget.id, payload);
        notify.success('Linha atualizada com sucesso!');
      } else {
        await linesApi.create(payload);
        notify.success('Linha criada com sucesso!');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? 'Erro ao salvar linha.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await linesApi.delete(deleteTarget.id);
      notify.success('Linha excluída com sucesso!');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? 'Erro ao excluir linha.');
    } finally {
      setDeleting(false);
    }
  };

  const terminalLabel = (id: number | string) => terminals.find((t) => t.id == id)?.name ?? String(id);

  const f = (key: keyof LineForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <PageContainer title="Linhas — OTIMIZ" description="Gerenciamento de linhas de transporte">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>Linhas</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Gerenciar rotas e linhas de transporte público
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar">
            <IconButton onClick={load} disabled={loading} size="small"><IconRefresh size={18} /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>
            Nova Linha
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }}
          />
          <Typography variant="caption" color="text.secondary" ml="auto">
            {filtered.length} linha{filtered.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Paper>

      <DashboardCard title="">
        {loading ? (
          <Box>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 0.5, borderRadius: 1 }} />
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Origem</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Destino</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Dist. (km)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <IconRoute size={40} color={theme.palette.grey[400]} />
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        {search ? 'Nenhuma linha encontrada para esta busca.' : 'Nenhuma linha cadastrada. Crie a primeira!'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((line) => (
                    <TableRow key={line.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: line.colorHex ?? '#5D87FF', flexShrink: 0 }} />
                          <Typography variant="body2" fontWeight={600} fontFamily="monospace">{line.code}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{line.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{terminalLabel(line.originTerminalId)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{terminalLabel(line.destinationTerminalId)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{line.distanceKm != null ? `${line.distanceKm}km` : '–'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip type="status" value={line.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(line)}><IconEdit size={16} /></IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(line)}><IconTrash size={16} /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DashboardCard>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editTarget ? 'Editar Linha' : 'Nova Linha'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="Código" required sx={{ width: 130 }} value={form.code} onChange={f('code')}
                inputProps={{ style: { textTransform: 'uppercase' } }} />
              <TextField label="Nome da Linha" required fullWidth value={form.name} onChange={f('name')} />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel required>Terminal de Origem</InputLabel>
              <Select label="Terminal de Origem *" value={form.originTerminalId}
                onChange={(e) => setForm((p) => ({ ...p, originTerminalId: e.target.value }))}>
                {terminals.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.name}{t.shortName ? ` (${t.shortName})` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel required>Terminal de Destino</InputLabel>
              <Select label="Terminal de Destino *" value={form.destinationTerminalId}
                onChange={(e) => setForm((p) => ({ ...p, destinationTerminalId: e.target.value }))}>
                {terminals.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.name}{t.shortName ? ` (${t.shortName})` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField label="Distância (km)" type="number" fullWidth value={form.distanceKm} onChange={f('distanceKm')}
                InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }} />
              <TextField label="Duração Média" type="number" fullWidth value={form.avgTripDurationMinutes} onChange={f('avgTripDurationMinutes')}
                InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }} />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  <MenuItem value="active">Ativa</MenuItem>
                  <MenuItem value="inactive">Inativa</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">Cor:</Typography>
                <Box component="label" sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: form.colorHex, border: '1px solid', borderColor: 'divider' }} />
                  <input type="color" value={form.colorHex} onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))} style={{ opacity: 0, position: 'absolute', width: 0 }} />
                  <Typography variant="caption" fontFamily="monospace">{form.colorHex}</Typography>
                </Box>
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.code || !form.name || !form.originTerminalId || !form.destinationTerminalId}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Linha"
        message={`Deseja excluir a linha "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}

export default function LinesPage() {
  return <NotifyProvider><LinesInner /></NotifyProvider>;
}
