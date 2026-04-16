'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  IconButton,
} from '@mui/material';
import { IconUpload, IconCheck, IconAlertTriangle, IconX } from '@tabler/icons-react';
import axios from 'axios';

interface TripImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TripImportModal: React.FC<TripImportModalProps> = ({ open, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/trips/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
      });

      setResult(response.data);
      if (response.data.success > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao processar o arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Importar Viagens (CSV/Excel)
        <IconButton onClick={onClose} size="small">
          <IconX size="18" />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {!result && (
          <Box
            sx={{
              border: '2px dashed',
              borderColor: file ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: 'action.hover',
              cursor: 'pointer',
              position: 'relative',
              '&:hover': { bgcolor: 'action.selected' },
            }}
            component="label"
          >
            <input type="file" hidden accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
            <IconUpload size="48" style={{ marginBottom: 12, opacity: 0.5 }} />
            <Typography variant="h6">
              {file ? file.name : 'Clique ou arraste o arquivo aqui'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Suporta formatos .csv, .xlsx e .xls
            </Typography>
          </Box>
        )}

        {uploading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography>Processando dados e normalizando horários...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert 
              severity={result.errors.length > 0 ? "warning" : "success"}
              icon={result.errors.length > 0 ? <IconAlertTriangle /> : <IconCheck />}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                Importação concluída: {result.success} viagens salvas.
              </Typography>
            </Alert>

            {result.errors.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Problemas encontrados ({result.errors.length}):
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.100', borderRadius: 1 }}>
                  {result.errors.map((err, i) => (
                    <ListItem key={i}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <IconX size="14" color="red" />
                      </ListItemIcon>
                      <ListItemText primary={err} primaryTypographyProps={{ variant: 'caption' }} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {result ? (
          <Button onClick={handleReset} variant="outlined">Importar outro</Button>
        ) : (
          <Button onClick={onClose} disabled={uploading}>Cancelar</Button>
        )}
        {!result && (
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!file || uploading}
            startIcon={uploading ? <CircularProgress size={18} /> : <IconUpload />}
          >
            Iniciar Importação
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TripImportModal;
