'use client';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import ConfirmDialog from '../_components/ConfirmDialog';
import { NotifyProvider, useNotify } from '../_components/Notify';
import { getSessionUser, optimizationSettingsApi } from '@/lib/api';
import type { OptimizationSettings } from '../_types';
import { extractArray } from '../_types';
import {
  ALGORITHM_OPTIONS,
  DEFAULT_SETTINGS_FORM,
  normalizeSettingsForApi,
  normalizeSettingsFromApi,
  notifyOptimizationSettingsUpdated,
  OptimizationSettingsEditor,
  OptimizationSettingsHighlights,
  type SettingsFormValues,
} from '../_components/OptimizationSettingsEditor';

function SettingsInner() {
  const theme = useTheme();
  const notify = useNotify();
  const [settings, setSettings] = useState<OptimizationSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OptimizationSettings | null>(null);
  const [form, setForm] = useState<SettingsFormValues>(DEFAULT_SETTINGS_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OptimizationSettings | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState<number | null>(null);

  const user = getSessionUser();
  const companyId = user?.companyId ?? 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await optimizationSettingsApi.getAll(companyId);
      setSettings(extractArray(data));
    } catch {
      notify.error('Falha ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  }, [companyId, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(normalizeSettingsFromApi(DEFAULT_SETTINGS_FORM));
    setDialogOpen(true);
  };

  const openEdit = (item: OptimizationSettings) => {
    setEditTarget(item);
    const { id: _id, companyId: _cid, createdAt: _ca, updatedAt: _ua, ...rest } = item;
    setForm(normalizeSettingsFromApi({ ...DEFAULT_SETTINGS_FORM, ...rest }));
    setDialogOpen(true);
  };

  const setField = <K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      notify.warning('Informe um nome para identificar a configuração.');
      return;
    }

    setSaving(true);
    try {
      const payload = normalizeSettingsForApi(form);
      if (editTarget) {
        await optimizationSettingsApi.update(editTarget.id, payload, companyId);
        notify.success('Configuração atualizada.');
      } else {
        await optimizationSettingsApi.create(payload, companyId);
        notify.success('Configuração criada.');
      }
      notifyOptimizationSettingsUpdated();
      setDialogOpen(false);
      await load();
    } catch (error: any) {
      notify.error(error?.response?.data?.message ?? 'Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await optimizationSettingsApi.delete(deleteTarget.id, companyId);
      notify.success('Configuração excluída.');
      notifyOptimizationSettingsUpdated();
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      notify.error(error?.response?.data?.message ?? 'Erro ao excluir configuração.');
    } finally {
      setDeleting(false);
    }
  };

  const handleActivate = async (item: OptimizationSettings) => {
    setActivating(item.id);
    try {
      await optimizationSettingsApi.activate(item.id, companyId);
      notify.success('Configuração ativada para as próximas execuções.');
      notifyOptimizationSettingsUpdated();
      await load();
    } catch (error: any) {
      notify.error(error?.response?.data?.message ?? 'Erro ao ativar configuração.');
    } finally {
      setActivating(null);
    }
  };

  const algoLabel = (value: string) =>
    ALGORITHM_OPTIONS.find((item) => item.value === value)?.label ?? value;

  return (
    <PageContainer title="Configurações de Otimização" description="Perfis completos do motor de otimização">
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconSettings size={28} color={theme.palette.primary.main} />
            <Typography variant="h4" fontWeight={800}>Perfis de otimização</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" mt={0.75}>
            Gerencie presets avançados para solver, regras trabalhistas, veículos elétricos, fairness e geração de colunas.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Recarregar lista">
            <IconButton onClick={load} disabled={loading} size="small">
              <IconRefresh size={18} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>
            Nova configuração
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Perfis cadastrados', value: settings.length, color: theme.palette.primary.main },
          { label: 'Perfis ativos', value: settings.filter((item) => item.isActive).length, color: theme.palette.success.main },
          { label: 'Com pricing ativo', value: settings.filter((item) => item.pricingEnabled).length, color: theme.palette.secondary.main },
          { label: 'Com depósito obrigatório', value: settings.filter((item) => item.sameDepotRequired).length, color: theme.palette.warning.main },
        ].map((item) => (
          <Grid item xs={6} md={3} key={item.label}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h5" fontWeight={800} sx={{ color: item.color }}>{item.value}</Typography>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {loading ? (
        <Box>
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={220} sx={{ borderRadius: 3, mb: 2 }} />
          ))}
        </Box>
      ) : settings.length === 0 ? (
        <Paper elevation={0} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 3, p: 6, textAlign: 'center' }}>
          <IconSettings size={48} color={theme.palette.grey[400]} />
          <Typography variant="h6" color="text.secondary" mt={2}>Nenhuma configuração cadastrada</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Crie um perfil para controlar todas as regras e estratégias da otimização.
          </Typography>
          <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={openCreate}>
            Criar primeiro perfil
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {settings.map((item) => (
            <Grid item xs={12} lg={6} key={item.id}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 4,
                  borderColor: item.isActive ? 'primary.main' : 'divider',
                  boxShadow: item.isActive ? '0 10px 30px rgba(37,99,235,0.10)' : 'none',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} mb={1.5}>
                  <Box>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="h6" fontWeight={800}>{item.name || `Configuração #${item.id}`}</Typography>
                      {item.isActive ? <Chip size="small" color="primary" icon={<IconCheck size={12} />} label="Ativa" /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {item.description || 'Perfil completo para operação multi-linha e análise regulatória.'}
                    </Typography>
                  </Box>
                  <Chip label={algoLabel(item.algorithmType)} color="secondary" variant="outlined" />
                </Stack>

                <OptimizationSettingsHighlights settings={item} />

                <Grid container spacing={1.5} mt={1} mb={1.5}>
                  {[
                    { label: 'Jornada', value: `${item.cctMaxShiftMinutes} min` },
                    { label: 'Direção', value: `${item.cctMaxDrivingMinutes} min` },
                    { label: 'Veículo', value: `${item.maxVehicleShiftMinutes ?? '--'} min` },
                    { label: 'Fairness', value: `${item.fairnessWeight ?? 0}` },
                    { label: 'Break obrigatório', value: `${item.cctMandatoryBreakAfterMinutes ?? '--'} min` },
                    { label: 'Carregadores', value: `${item.maxSimultaneousChargers ?? '--'}` },
                  ].map((metric) => (
                    <Grid item xs={6} sm={4} key={metric.label}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" color="text.secondary">{metric.label}</Typography>
                        <Typography variant="body2" fontWeight={700}>{metric.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="flex-end">
                  {!item.isActive ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<IconCheck size={14} />}
                      onClick={() => handleActivate(item)}
                      disabled={activating === item.id}
                    >
                      Ativar
                    </Button>
                  ) : null}
                  <Button size="small" variant="outlined" startIcon={<IconEdit size={14} />} onClick={() => openEdit(item)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<IconTrash size={14} />}
                    onClick={() => setDeleteTarget(item)}
                    disabled={item.isActive}
                  >
                    Excluir
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconSettings size={22} />
            <Typography variant="h6" fontWeight={800}>
              {editTarget ? 'Editar perfil de otimização' : 'Novo perfil de otimização'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Este perfil controla o solver ativo, as restrições CCT/Lei 13.103, os parâmetros de EV e o modelo set covering/pricing.
              </Alert>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Nome do perfil"
                  size="small"
                  fullWidth
                  value={form.name || ''}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Ex: Operação multi-linha produção"
                />
                <TextField
                  label="Descrição"
                  size="small"
                  fullWidth
                  value={form.description || ''}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Resumo operacional e objetivo do perfil"
                />
              </Stack>
              <OptimizationSettingsEditor value={form} onChange={setField} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : editTarget ? 'Salvar alterações' : 'Criar perfil'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir configuração"
        message={`Tem certeza que deseja excluir a configuração "${deleteTarget?.name || `Configuração #${deleteTarget?.id}`}"?`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}

export default function SettingsPage() {
  return (
    <NotifyProvider>
      <SettingsInner />
    </NotifyProvider>
  );
}
