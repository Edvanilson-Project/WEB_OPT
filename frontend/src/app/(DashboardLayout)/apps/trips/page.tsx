'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
} from '@mui/material';
import { IconUpload, IconRoute, IconDotsVertical, IconSparkles } from '@tabler/icons-react';
import PageContainer from '@/app/components/container/PageContainer';
import Breadcrumb from '@/app/(DashboardLayout)/layout/shared/breadcrumb/Breadcrumb';
import TripImportModal from '@/app/components/trips/TripImportModal';
import OptimizationProgressModal from '@/app/components/trips/OptimizationProgressModal';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Tab } from '@mui/material';
import GanttPlanner from '@/app/components/trips/GanttPlanner';
import axios from 'axios';

const TripsPage = () => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isOptModalOpen, setIsOptModalOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState('1');

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/trips', { withCredentials: true });
      setTrips(response.data);
    } catch (error) {
      console.error('Erro ao buscar viagens', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOptimization = async () => {
    try {
      // Por agora, otimizaremos todas as viagens visíveis ou selecionadas
      const response = await axios.post('/optimization/run', {
        name: `Otimização ${new Date().toLocaleDateString()}`,
        algorithm: 'hybrid_pipeline'
      }, { withCredentials: true });

      setActiveRunId(response.data.id);
      setIsOptModalOpen(true);
    } catch (error) {
      console.error('Falha ao iniciar otimização', error);
      alert('Erro ao iniciar motor matemático. Verifique se o Optimizer Python está online.');
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const BCrumb = [
    { to: '/', title: 'Home' },
    { title: 'Gestão de Viagens' },
  ];

  return (
    <PageContainer title="Gestão de Viagens" description="Gere e organize as viagens da sua frota">
      <Breadcrumb title="Viagens" items={BCrumb} />
      
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Centro de Gestão</Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color="success"
            startIcon={<IconSparkles size="18" />}
            onClick={handleStartOptimization}
            disabled={trips.length === 0}
          >
            Otimizar Cenário
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<IconUpload size="18" />}
            onClick={() => setIsImportModalOpen(true)}
          >
            Importar Viagens
          </Button>
        </Stack>
      </Box>

      <TabContext value={tabValue}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <TabList onChange={handleTabChange} aria-label="Operação Tabs">
            <Tab label="Lista de Viagens" value="1" />
            <Tab label="Planejador (Gantt)" value="2" />
          </TabList>
        </Box>
        
        <TabPanel value="1" sx={{ p: 0 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 0 }}>
              <TableContainer component={Paper} elevation={0}>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell><Typography variant="subtitle2" fontWeight={600}>Cód. Viagem</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2" fontWeight={600}>Linha</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2" fontWeight={600}>Início</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2" fontWeight={600}>Fim</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2" fontWeight={600}>Duração</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2" fontWeight={600}>Sentido</Typography></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trips.length === 0 && !loading ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                          Nenhuma viagem encontrada. Clique em "Importar" para começar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      trips.map((trip) => (
                        <TableRow key={trip.id} hover>
                          <TableCell>
                            <Typography variant="body2">{trip.tripCode}</Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <IconRoute size="16" />
                              <Typography variant="body2">{trip.lineId}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={`${Math.floor(trip.startTimeMinutes / 60).toString().padStart(2, '0')}:${(trip.startTimeMinutes % 60).toString().padStart(2, '0')}`} 
                              size="small" 
                              variant="outlined" 
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={`${Math.floor(trip.endTimeMinutes / 60).toString().padStart(2, '0')}:${(trip.endTimeMinutes % 60).toString().padStart(2, '0')}`} 
                              size="small" 
                              color="info"
                              variant="outlined" 
                            />
                          </TableCell>
                          <TableCell>{trip.durationMinutes} min</TableCell>
                          <TableCell>
                            <Chip 
                              label={trip.direction === 'outbound' ? 'Ida' : 'Volta'} 
                              size="small" 
                              color={trip.direction === 'outbound' ? 'success' : 'secondary'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </TabPanel>
        
        <TabPanel value="2" sx={{ p: 0 }}>
          <GanttPlanner />
        </TabPanel>
      </TabContext>

      <TripImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchTrips}
      />

      <OptimizationProgressModal
        open={isOptModalOpen}
        runId={activeRunId}
        onClose={() => setIsOptModalOpen(false)}
      />
    </PageContainer>
  );
};

export default TripsPage;
