'use client';

import React, { useMemo, useEffect, useState, useContext } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  Box, 
  Paper, 
  useTheme, 
  alpha, 
  styled, 
  Typography, 
  CircularProgress, 
  Stack,
  Alert
} from '@mui/material';
import axios from 'axios';
import { CustomizerContext } from '@/app/context/customizerContext';

/**
 * REGRAS DE OURO OTIMIZ:
 * 1. ANCHOR_DATE fixa em UTC para evitar DST (Horário de Verão).
 * 2. Minutos do backend são somados a esta âncora.
 */
const ANCHOR_DATE = "2000-01-01T00:00:00Z";

/**
 * Styled Wrapper para envelopar e domar o CSS do FullCalendar com tokens MUI.
 */
const StyledCalendarWrapper = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  position: 'relative',
  '& .fc': {
    '--fc-border-color': alpha(theme.palette.divider, 0.1),
    '--fc-page-bg-color': theme.palette.background.paper,
    '--fc-neutral-bg-color': alpha(theme.palette.background.default, 0.5),
    '--fc-list-event-hover-bg-color': alpha(theme.palette.primary.main, 0.1),
    '--fc-today-bg-color': alpha(theme.palette.secondary.main, 0.05),
    
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.875rem',
  },
  '& .fc-theme-standard .fc-scrollgrid': {
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    borderRadius: '8px',
  },
  '& .fc-timeline-slot-label': {
    borderColor: alpha(theme.palette.divider, 0.05),
    '& .fc-timeline-slot-label-cushion': {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: theme.palette.text.secondary,
    }
  },
  '& .fc-datagrid-cell-cushion': {
    padding: '8px',
  },
  '& .fc-datagrid-cell-main': {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  // Customização dos Eventos (Viagens)
  '& .fc-timeline-event': {
    border: 'none',
    padding: '2px 4px',
    '& .fc-event-main': {
      padding: '0 4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '0.7rem',
      color: theme.palette.common.white,
    }
  },
  // Linha de tempo atual
  '& .fc-timeline-now-indicator-line': {
    borderColor: theme.palette.error.main,
    borderWidth: '2px',
  }
}));

const GanttPlanner = () => {
  const theme = useTheme();
  const { activeMode } = useContext(CustomizerContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{resources: any[], events: any[]}>({ resources: [], events: [] });

  const fetchLatestOptimization = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/optimization', { withCredentials: true });
      const runs = response.data;
      
      // Encontra a última execução concluída
      const latestRun = runs.find((r: any) => r.status === 'COMPLETED' || r.status === 'SUCCESS');
      
      if (!latestRun) {
        setError('Nenhuma otimização concluída encontrada.');
        setLoading(false);
        return;
      }

      const result = latestRun.resultSummary || {};
      const blocks = result.blocks || result.vehicle_blocks || [];
      const trips = result.trips || [];
      const unassigned = result.unassigned_trips || [];

      // Mapeamento de Recursos (Veículos)
      const mappedResources = blocks.map((b: any) => ({
        id: b.id || b.block_id,
        title: b.label || b.id || `Veículo ${b.block_id}`
      }));

      // Mapeamento de Eventos (Viagens)
      const anchorDateObj = new Date(ANCHOR_DATE);
      
      const mappedEvents = trips.map((t: any) => {
        const start = new Date(anchorDateObj.getTime() + (t.start_min || t.startTimeMinutes || 0) * 60000);
        const end = new Date(anchorDateObj.getTime() + (t.end_min || t.endTimeMinutes || t.start_min + 30) * 60000);
        
        let color = theme.palette.primary.main;
        if (activeMode === 'dark') color = theme.palette.primary.dark;
        
        // Cores Semânticas
        if (t.type === 'deadhead' || t.deadhead) {
          color = alpha(theme.palette.text.secondary, 0.4);
        }

        return {
          id: t.id || `trip-${Math.random()}`,
          resourceId: t.block_id || t.vehicleId,
          title: t.trip_label || t.tripCode || t.lineId,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: color,
          borderRadius: '4px',
          extendedProps: { ...t }
        };
      });

      // Adiciona trips não atribuídas em um recurso especial (opcional)
      if (unassigned.length > 0) {
        mappedResources.push({ id: 'unassigned', title: '⚠️ NÃO ATRIBUÍDAS' });
        unassigned.forEach((t: any) => {
          const start = new Date(anchorDateObj.getTime() + (t.start_min || t.startTimeMinutes || 0) * 60000);
          const end = new Date(anchorDateObj.getTime() + (t.end_min || t.endTimeMinutes || 0) * 60000);
          
          mappedEvents.push({
            id: t.id,
            resourceId: 'unassigned',
            title: t.tripCode || 'Trip s/ Veículo',
            start: start.toISOString(),
            end: end.toISOString(),
            backgroundColor: theme.palette.error.main,
            borderRadius: '4px',
            extendedProps: { ...t }
          });
        });
      }

      setData({ resources: mappedResources, events: mappedEvents });
    } catch (err: any) {
      console.error('Falha ao buscar otimização:', err);
      setError('Erro ao conectar com o backend de otimização.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestOptimization();
  }, [theme.palette, activeMode]);

  if (loading) {
    return (
      <Paper elevation={0} sx={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'background.paper' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" color="textSecondary">Carregando Planejador Operacional...</Typography>
        </Stack>
      </Paper>
    );
  }

  if (error && data.resources.length === 0) {
    return (
      <Box p={3}>
        <Alert severity="warning" variant="outlined">
          {error} Importe viagens e execute uma otimização no botão acima para visualizar o Gantt.
        </Alert>
      </Box>
    );
  }

  return (
    <StyledCalendarWrapper>
      <Paper elevation={0} sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
        <FullCalendar
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          timeZone="UTC"
          initialView="resourceTimelineDay"
          initialDate="2000-01-01" // Alinhado com a Anchor Date
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'resourceTimelineDay,resourceTimelineWeek'
          }}
          resources={data.resources}
          events={data.events}
          resourceAreaHeaderContent="Veículos / Escalas"
          resourceAreaWidth="220px"
          height="700px"
          slotMinTime="04:00:00"
          slotMaxTime="26:00:00"
          nowIndicator={true}
          editable={true}
          selectable={true}
          eventMinHeight={38}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
        />
      </Paper>
    </StyledCalendarWrapper>
  );
};

export default GanttPlanner;
