'use client';
import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Stack, Tabs, Tab, Badge, Paper,
  LinearProgress, Alert, AlertTitle,
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
  const [tab, setTab] = useState(0);
  const res = useMemo(() => run.resultSummary || {}, [run.resultSummary]);
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
      <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
        <AlertTitle>Falha de Processamento</AlertTitle>
        <Typography>O motor de otimização rejeitou os parâmetros ou abortou a execução.</Typography>
        <Typography variant="caption" sx={{ whiteSpace: 'pre-line', mt: 1, display: 'block' }}>{run.errorMessage || 'Detalhes indisponíveis.'}</Typography>
      </Alert>
    );
  }

  if (run.status === 'running') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <IconRobot size={48} color="#1976D2" />
        <Typography variant="h6" fontWeight={700} mt={2}>Motor em Execução...</Typography>
        <Typography color="text.secondary" mb={2}>Análise pesada e Set Partitioning em progressão.</Typography>
        <LinearProgress sx={{ maxWidth: 400, mx: 'auto', borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box>
      <KpiStrip res={res} run={run} />
      <Paper
        variant="outlined"
        sx={{
          mb: 3,
          p: 1,
          borderRadius: 3,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<IconUsers size={16} />} iconPosition="start" label="Escalas" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }} />
          <Tab icon={<IconBus size={16} />} iconPosition="start" label="Veículos" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }} />
          <Tab
            icon={<Badge badgeContent={alertCount} color="error" max={99}><IconAlertTriangle size={16} /></Badge>}
            iconPosition="start" label="Alertas" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }}
          />
          <Tab icon={<IconRoute size={16} />} iconPosition="start" label="Viagens" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }} />
          <Tab icon={<IconChartBar size={16} />} iconPosition="start" label="Gantt" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }} />
          <Tab icon={<IconFileCode size={16} />} iconPosition="start" label="Auditoria" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }} />
        </Tabs>
      </Paper>

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
        />
      )}
      {tab === 5 && <TabAudit run={run} allRuns={allRuns} />}
    </Box>
  );
}
