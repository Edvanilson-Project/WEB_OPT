'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import { IconSettings, IconCheck, IconAlertTriangle, IconLayoutBoard } from '@tabler/icons-react';
import { io, Socket } from 'socket.io-client';

interface OptimizationProgressModalProps {
  open: boolean;
  onClose: () => void;
  runId: number | null;
}

const OptimizationProgressModal: React.FC<OptimizationProgressModalProps> = ({ open, onClose, runId }) => {
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !runId) return;

    // Conexão com o Gateway de Otimização
    const socket: Socket = io('/optimization', {
      withCredentials: true,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Filiado ao WebSocket de Otimização');
    });

    socket.on('optimization_status_changed', (data: any) => {
      if (data.runId !== runId) return;

      if (data.status === 'completed') {
        setStatus('completed');
        setSummary(data.summary);
      } else if (data.status === 'failed') {
        setStatus('failed');
        setError(data.message || 'Erro durante o processamento.');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [open, runId]);

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
        {status === 'processing' && 'Otimizando Operação...'}
        {status === 'completed' && 'Otimização Concluída!'}
        {status === 'failed' && 'Falha na Otimização'}
      </DialogTitle>
      
      <DialogContent sx={{ textAlign: 'center', pb: 4 }}>
        {status === 'processing' && (
          <Box sx={{ py: 3 }}>
            <Box className="optimization-animation" sx={{ mb: 3 }}>
              <IconSettings size="64" className="spinner-icon" style={{ animation: 'spin 4s linear infinite' }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              O motor matemático está resolvendo os conflitos de escala.
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Isso pode levar alguns segundos dependendo do volume de viagens.
            </Typography>
            <LinearProgress sx={{ height: 8, borderRadius: 5 }} />
          </Box>
        )}

        {status === 'completed' && summary && (
          <Box sx={{ py: 2 }}>
            <Box sx={{ bgcolor: 'success.light', color: 'success.main', p: 3, borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <IconCheck size="48" />
            </Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Novo Cenário Gerado
            </Typography>
            
            <Divider sx={{ my: 3 }} />
            
            <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h4" color="primary" fontWeight={700}>{summary.vehicles}</Typography>
                <Typography variant="caption" color="textSecondary">Veículos</Typography>
              </Box>
              <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 3 }}>
                <Typography variant="h4" color="success.main" fontWeight={700}>R$ {summary.cost.toLocaleString()}</Typography>
                <Typography variant="caption" color="textSecondary">Custo Estimado</Typography>
              </Box>
            </Stack>
            
            <Alert severity="success" sx={{ mt: 2, textAlign: 'left' }}>
              A frota foi otimizada com sucesso respeitando todas as regras de CCT.
            </Alert>
          </Box>
        )}

        {status === 'failed' && (
          <Box sx={{ py: 2 }}>
            <Box sx={{ bgcolor: 'error.light', color: 'error.main', p: 3, borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <IconAlertTriangle size="48" />
            </Box>
            <Typography variant="h6" color="error" gutterBottom>
              Não foi possível concluir o cálculo.
            </Typography>
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
              {error}
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, justifyContent: 'center' }}>
        {status !== 'processing' ? (
          <Button onClick={onClose} variant="contained" size="large" fullWidth>
            Fechar e Ver Resultados
          </Button>
        ) : (
          <Typography variant="caption" color="textSecondary">
            Você pode fechar esta janela; o cálculo continuará em background.
          </Typography>
        )}
      </DialogActions>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Dialog>
  );
};

export default OptimizationProgressModal;
