'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  IconButton,
  Box,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import Scrollbar from '@/app/components/custom-scroll/Scrollbar';
import { IconBellRinging, IconCheck, IconX, IconLoader, IconBrain } from '@tabler/icons-react';
import { Stack } from '@mui/system';
import Link from 'next/link';
import { optimizationApi } from '@/lib/api';

interface RunNotif {
  id: number;
  status: string;
  vehicles?: number;
  crew?: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  completed: { color: '#13DEB9', icon: <IconCheck size={20} /> },
  failed: { color: '#FA896B', icon: <IconX size={20} /> },
  running: { color: '#FFAE1F', icon: <IconLoader size={20} /> },
  pending: { color: '#5D87FF', icon: <IconBrain size={20} /> },
};

const Notifications = () => {
  const [anchorEl2, setAnchorEl2] = useState(null);
  const [runs, setRuns] = useState<RunNotif[]>([]);

  const loadRuns = useCallback(async () => {
    try {
      const data = await optimizationApi.getAll({ companyId: 1 });
      const arr = Array.isArray(data) ? data : (data as any)?.data ?? [];
      setRuns(arr.slice(0, 5).map((r: any) => ({
        id: r.id,
        status: r.status,
        vehicles: r.resultSummary?.vehicles ?? r.totalVehicles,
        crew: r.resultSummary?.crew ?? r.totalCrew,
        createdAt: r.createdAt,
      })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const handleClick2 = (event: any) => {
    setAnchorEl2(event.currentTarget);
    loadRuns();
  };
  const handleClose2 = () => { setAnchorEl2(null); };

  const recentCount = runs.filter((r) => r.status === 'completed' || r.status === 'running').length;

  return (
    <Box>
      <IconButton
        size="large"
        aria-label="notificações"
        color="inherit"
        aria-controls="msgs-menu"
        aria-haspopup="true"
        sx={{ color: anchorEl2 ? 'primary.main' : 'text.secondary' }}
        onClick={handleClick2}
      >
        <Badge badgeContent={recentCount > 0 ? recentCount : undefined} color="primary">
          <IconBellRinging size="21" stroke="1.5" />
        </Badge>
      </IconButton>
      <Menu
        id="msgs-menu"
        anchorEl={anchorEl2}
        keepMounted
        open={Boolean(anchorEl2)}
        onClose={handleClose2}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        sx={{ '& .MuiMenu-paper': { width: '360px' } }}
      >
        <Stack direction="row" py={2} px={4} justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Otimizações Recentes</Typography>
          {recentCount > 0 && <Chip label={`${recentCount} recentes`} color="primary" size="small" />}
        </Stack>
        <Scrollbar sx={{ maxHeight: '320px' }}>
          {runs.length === 0 ? (
            <Box px={4} py={3} textAlign="center">
              <Typography variant="body2" color="text.secondary">Nenhuma execução recente</Typography>
            </Box>
          ) : (
            runs.map((run) => {
              const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.pending;
              return (
                <MenuItem key={run.id} sx={{ py: 1.5, px: 4 }}>
                  <Stack direction="row" spacing={2} alignItems="center" width="100%">
                    <Avatar sx={{ width: 40, height: 40, bgcolor: `${cfg.color}22`, color: cfg.color }}>
                      {cfg.icon}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Run #{String(run.id).padStart(4, '0')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {run.status === 'completed' && run.vehicles != null
                          ? `${run.vehicles} veículos · ${run.crew} tripulantes`
                          : run.status === 'running' ? 'Em execução...' : run.status}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(run.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Stack>
                </MenuItem>
              );
            })
          )}
        </Scrollbar>
        <Box p={2} pb={1}>
          <Button href="/otimiz/optimization" variant="outlined" component={Link} color="primary" fullWidth onClick={handleClose2}>
            Ver Todas as Execuções
          </Button>
        </Box>
      </Menu>
    </Box>
  );
};

export default Notifications;
