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
import { linesApi, terminalsApi, vehicleTypesApi, getSessionUser } from '@/lib/api';
import type { Line, Terminal, VehicleType } from '../_types';
import { extractArray } from '../_types';

interface LineForm {
  code: string;
  name: string;
  originTerminalId: string;
  destinationTerminalId: string;
  distanceKm: string;
  returnDistanceKm: string;
  idleTerminalId: string;
  idleDistanceKm: string;
  idleReturnDistanceKm: string;
  garageTerminalId: string;
  garageDistanceKm: string;
  vehicleTypeId: string;
  status: string;
  operationMode: string;
}

const EMPTY: LineForm = {
  code: '', name: '', originTerminalId: '', destinationTerminalId: '',
  distanceKm: '', returnDistanceKm: '', idleTerminalId: '', idleDistanceKm: '',
  idleReturnDistanceKm: '', garageTerminalId: '', garageDistanceKm: '',
  vehicleTypeId: '', status: 'active', operationMode: 'roundtrip',
};

const OP_MODE_LABELS: Record<string, string> = {
  roundtrip: 'Ida e Volta',
  outbound_only: 'Somente Ida',
  return_only: 'Somente Volta',
  flexible: 'Flexível',
};

function LinesInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [lines, setLines] = useState<Line[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
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
      const [linesData, terminalsData, vtData] = await Promise.allSettled([
        linesApi.getAll(),
        terminalsApi.getAll(),
        vehicleTypesApi.getAll(),
      ]);
      if (linesData.status === 'fulfilled') setLines(extractArray(linesData.value));
      if (terminalsData.status === 'fulfilled') setTerminals(extractArray(terminalsData.value));
      if (vtData.status === 'fulfilled') setVehicleTypes(extractArray(vtData.value));
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
      returnDistanceKm: line.returnDistanceKm != null ? String(line.returnDistanceKm) : '',
      idleTerminalId: line.idleTerminalId != null ? String(line.idleTerminalId) : '',
      idleDistanceKm: line.idleDistanceKm != null ? String(line.idleDistanceKm) : '',
      idleReturnDistanceKm: line.idleReturnDistanceKm != null ? String(line.idleReturnDistanceKm) : '',
      garageTerminalId: line.garageTerminalId != null ? String(line.garageTerminalId) : '',
      garageDistanceKm: line.garageDistanceKm != null ? String(line.garageDistanceKm) : '',
      vehicleTypeId: line.vehicleTypeId != null ? String(line.vehicleTypeId) : '',
      status: line.status,
      operationMode: line.operationMode || 'roundtrip',
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
        returnDistanceKm: form.returnDistanceKm ? parseFloat(form.returnDistanceKm) : undefined,
        idleTerminalId: form.idleTerminalId ? Number(form.idleTerminalId) : undefined,
        idleDistanceKm: form.idleDistanceKm ? parseFloat(form.idleDistanceKm) : undefined,
        idleReturnDistanceKm: form.idleReturnDistanceKm ? parseFloat(form.idleReturnDistanceKm) : undefined,
        garageTerminalId: form.garageTerminalId ? Number(form.garageTerminalId) : undefined,
        garageDistanceKm: form.garageDistanceKm ? parseFloat(form.garageDistanceKm) : undefined,
        vehicleTypeId: form.vehicleTypeId ? Number(form.vehicleTypeId) : undefined,
        status: form.status,
        operationMode: form.operationMode,
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
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Km Ida</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Km Volta</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Term. Ociosa</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Km Ociosa Ida</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Km Ociosa Volta</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Term. Garagem</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Km Garagem</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tipo Veículo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Modo Op.</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} align="center" sx={{ py: 6 }}>
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
                        <Typography variant="body2" fontWeight={600} fontFamily="monospace">{line.code}</Typography>
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
                        <Typography variant="body2">{line.distanceKm != null ? `${line.distanceKm}` : '–'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{line.returnDistanceKm != null ? `${line.returnDistanceKm}` : '–'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{line.idleTerminalId ? terminalLabel(line.idleTerminalId) : '–'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{line.idleDistanceKm != null ? `${line.idleDistanceKm}` : '–'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{line.idleReturnDistanceKm != null ? `${line.idleReturnDistanceKm}` : '–'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{line.garageTerminalId ? terminalLabel(line.garageTerminalId) : '–'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{line.garageDistanceKm != null ? `${line.garageDistanceKm}` : '–'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{line.vehicleTypeId ? (vehicleTypes.find(v => v.id === line.vehicleTypeId)?.name ?? '–') : '–'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={OP_MODE_LABELS[line.operationMode || 'roundtrip'] || line.operationMode} />
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
              <TextField label="Km Ida" type="number" fullWidth value={form.distanceKm} onChange={f('distanceKm')}
                InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }} />
              <TextField label="Km Volta" type="number" fullWidth value={form.returnDistanceKm} onChange={f('returnDistanceKm')}
                InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }} />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel>Terminal Ociosa</InputLabel>
              <Select label="Terminal Ociosa" value={form.idleTerminalId}
                onChange={(e) => setForm((p) => ({ ...p, idleTerminalId: e.target.value }))}>
                <MenuItem value="">Nenhum</MenuItem>
                {terminals.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.name}{t.shortName ? ` (${t.shortName})` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField label="Km Ociosa Ida" type="number" fullWidth value={form.idleDistanceKm} onChange={f('idleDistanceKm')}
                InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }} />
              <TextField label="Km Ociosa Volta" type="number" fullWidth value={form.idleReturnDistanceKm} onChange={f('idleReturnDistanceKm')}
                InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }} />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel>Terminal Garagem</InputLabel>
              <Select label="Terminal Garagem" value={form.garageTerminalId}
                onChange={(e) => setForm((p) => ({ ...p, garageTerminalId: e.target.value }))}>
                <MenuItem value="">Nenhum</MenuItem>
                {terminals.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.name}{t.shortName ? ` (${t.shortName})` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField label="Km Garagem" type="number" fullWidth value={form.garageDistanceKm} onChange={f('garageDistanceKm')}
                InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }} />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  <MenuItem value="active">Ativa</MenuItem>
                  <MenuItem value="inactive">Inativa</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <FormControl fullWidth size="small">                <InputLabel>Tipo de Veículo</InputLabel>
                <Select label="Tipo de Veículo" value={form.vehicleTypeId}
                  onChange={(e) => setForm((p) => ({ ...p, vehicleTypeId: e.target.value }))}>
                  <MenuItem value="">Nenhum</MenuItem>
                  {vehicleTypes.filter(v => v.isActive).map((v) => (
                    <MenuItem key={v.id} value={String(v.id)}>{v.name} ({v.passengerCapacity} pass.)</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">              <InputLabel>Modo de Operação</InputLabel>
              <Select label="Modo de Operação" value={form.operationMode}
                onChange={(e) => setForm((p) => ({ ...p, operationMode: e.target.value }))}>
                <MenuItem value="roundtrip">Ida e Volta (duas pontas)</MenuItem>
                <MenuItem value="outbound_only">Somente Ida</MenuItem>                  <MenuItem value="return_only">Somente Volta</MenuItem>                <MenuItem value="flexible">Flexível (ida e/ou volta conforme demanda)</MenuItem>
              </Select>
            </FormControl>
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
