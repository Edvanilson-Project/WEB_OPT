'use client';
import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Stack, Tabs, Tab, Badge, Paper,
  LinearProgress, Alert, AlertTitle, Divider,
  alpha, useTheme,
} from '@mui/material';
import {
  IconRobot, IconUsers, IconBus, IconAlertTriangle,
  IconRoute, IconChartBar, IconFileCode,
} from '@tabler/icons-react';
import type {
  Line, Terminal, OptimizationRun, OptimizationSettings,
  OptimizationResultSummary, OptimizationStructuredIssue,
} from '../../_types';
import {
  buildTripIntervalPolicy,
} from '../_helpers/formatters';
import {
  buildDutyAssignmentsByPublicTripId, buildDutyMealBreakIntervalKeys,
} from '../_helpers/trip-intervals';
import { KpiStrip } from './shared';
import { TabOverview } from './TabOverview';
import { TabVehicles } from './TabVehicles';
import { TabAlerts } from './TabAlerts';
import { TabTrips } from './TabTrips';
import { TabGantt } from './TabGantt';
import { TabAudit } from './TabAudit';
import { AiCopilotInsight } from './AiCopilotInsight';

export function RunVisuals({
  run,
  lines,
  terminals,
  allRuns,
  activeSettings,
}: {
  run: OptimizationRun,
  lines: Line[],
  terminals: Terminal[],
  allRuns: OptimizationRun[],
  activeSettings: OptimizationSettings | null,
}) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [whatIfCost, setWhatIfCost] = useState<number | null>(null);
  const res = useMemo(() => run.resultSummary || {}, [run.resultSummary]);

  // Reset what-if cost when switching to a different run
  React.useEffect(() => { setWhatIfCost(null); }, [run.id]);
  const warningsRaw = res.warnings || [];
  const warnings = Array.isArray(warningsRaw) ? (warningsRaw as (string | OptimizationStructuredIssue)[]).map(w => typeof w === 'string' ? w : w.message) : [];
  const unassigned = res.unassigned_trips || [];
  const alertCount = (res.cct_violations ?? res.cctViolations ?? 0) + warnings.length + unassigned.length;
  const intervalPolicy = useMemo(
    () => buildTripIntervalPolicy(run, activeSettings),
    [run, activeSettings],
  );
  const duties = useMemo(() => res.duties || [], [res]);
  const dutyAssignmentsByPublicTripId = useMemo(
    () => buildDutyAssignmentsByPublicTripId(duties),
    [duties],
  );
  const mealBreakIntervalKeys = useMemo(
    () => buildDutyMealBreakIntervalKeys(duties, intervalPolicy),
    [duties, intervalPolicy],
  );

  if (run.status === 'failed') {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Paper variant="outlined" sx={{ 
          p: 6, borderRadius: 5, 
          borderColor: 'error.light', 
          bgcolor: alpha(theme.palette.error.main, 0.02),
          maxWidth: 600, mx: 'auto'
        }}>
          <Stack alignItems="center" spacing={2}>
            <Box sx={{ 
              width: 64, height: 64, borderRadius: '50%', 
              bgcolor: alpha(theme.palette.error.main, 0.1), 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'error.main'
            }}>
              <IconAlertTriangle size={32} />
            </Box>
            <Typography variant="h5" fontWeight={900}>Falha no Processamento</Typography>
            <Typography variant="body1" color="text.secondary">
              O motor de otimização encontrou um erro crítico ao processar esta execução.
            </Typography>
            <Paper variant="outlined" sx={{ 
              p: 2, borderRadius: 2, mt: 2, width: '100%', 
              bgcolor: 'background.default', textAlign: 'left',
              borderStyle: 'dashed'
            }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'error.main', wordBreak: 'break-all' }}>
                {run.errorMessage || 'Erro inesperado no solver.'}
              </Typography>
            </Paper>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (run.status === 'pending') {
    return (
      <Box sx={{ py: 12, textAlign: 'center' }}>
        <Stack alignItems="center" spacing={3} sx={{ maxWidth: 450, mx: 'auto' }}>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ 
              width: 80, height: 80, borderRadius: '50%', 
              bgcolor: alpha(theme.palette.warning.main, 0.1), 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'warning.main',
              animation: 'pulse 2s infinite'
            }}>
              <IconRobot size={40} />
            </Box>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={900} gutterBottom>Solicitação em Espera</Typography>
            <Typography variant="body1" color="text.secondary">
              Sua execução foi enfileirada com sucesso. O motor iniciará o processamento assim que houver recursos disponíveis.
            </Typography>
          </Box>
          <LinearProgress sx={{ width: '100%', height: 6, borderRadius: 3, bgcolor: alpha(theme.palette.warning.main, 0.1), '& .MuiLinearProgress-bar': { bgcolor: 'warning.main' } }} />
        </Stack>
      </Box>
    );
  }

  if (run.status === 'running') {
    return (
      <Box sx={{ py: 12, textAlign: 'center' }}>
        <Stack alignItems="center" spacing={3} sx={{ maxWidth: 450, mx: 'auto' }}>
          <Box>
             <Box sx={{ 
              width: 80, height: 80, borderRadius: '50%', 
              bgcolor: alpha(theme.palette.primary.main, 0.1), 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'primary.main',
              mb: 1
            }}>
              <IconRobot size={40} />
            </Box>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={900} gutterBottom>Motor em Execução</Typography>
            <Typography variant="body1" color="text.secondary">
              Realizando análise combinatória e balanceamento de custos. Isso pode levar alguns minutos dependendo da complexidade da malha.
            </Typography>
          </Box>
          <Box sx={{ width: '100%' }}>
            <LinearProgress sx={{ height: 6, borderRadius: 3 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontWeight: 600 }}>
              ESTÁGIO: OTIMIZAÇÃO VSP/CSP HÍBRIDA
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <KpiStrip res={res} run={run} whatIfCost={whatIfCost} />

      {/* AI Copilot Insight — aparece abaixo dos KPIs, acima das abas */}
      <AiCopilotInsight insight={res.aiCopilotInsight ?? res.ai_copilot_insight} />

      <Box sx={{ mb: 4, position: 'relative' }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)} 
          variant="scrollable" 
          scrollButtons="auto"
          sx={{
            minHeight: 48,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.875rem',
              color: 'text.secondary',
              minHeight: 48,
              minWidth: 100,
              gap: 1,
              transition: 'all 0.2s',
              '&.Mui-selected': {
                color: 'primary.main',
              },
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.04),
              }
            }
          }}
        >
          <Tab icon={<IconUsers size={18} />} iconPosition="start" label="Escalas" />
          <Tab icon={<IconBus size={18} />} iconPosition="start" label="Veículos" />
          <Tab
            icon={<Badge badgeContent={alertCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}><IconAlertTriangle size={18} /></Badge>}
            iconPosition="start" label="Alertas"
          />
          <Tab icon={<IconRoute size={18} />} iconPosition="start" label="Viagens" />
          <Tab icon={<IconChartBar size={18} />} iconPosition="start" label="Gantt" />
          <Tab icon={<IconFileCode size={18} />} iconPosition="start" label="Auditoria" />
        </Tabs>
        <Divider sx={{ mt: -0.1 }} />
      </Box>

      <Box sx={{ animation: 'fadeIn 0.4s ease-out' }}>
        {tab === 0 && (
          <TabOverview
            res={res}
            lines={lines}
            terminals={terminals}
            intervalPolicy={intervalPolicy}
            mealBreakIntervalKeys={mealBreakIntervalKeys}
          />
        )}
        {tab === 1 && (
          <TabVehicles
            res={res}
            lines={lines}
            terminals={terminals}
            dutyAssignmentsByPublicTripId={dutyAssignmentsByPublicTripId}
            intervalPolicy={intervalPolicy}
            mealBreakIntervalKeys={mealBreakIntervalKeys}
          />
        )}
        {tab === 2 && <TabAlerts res={res} lines={lines} terminals={terminals} />}
        {tab === 3 && <TabTrips res={res} lines={lines} terminals={terminals} />}
        {tab === 4 && (
          <TabGantt
            res={res}
            lines={lines}
            terminals={terminals}
            intervalPolicy={intervalPolicy}
            onWhatIfUpdate={setWhatIfCost}
          />
        )}
        {tab === 5 && <TabAudit run={run} allRuns={allRuns} />}
      </Box>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
      `}</style>
    </Box>
  );
}
