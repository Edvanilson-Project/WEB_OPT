'use client';
import React, { useMemo } from 'react';
import { Box, Stack, Chip, Tooltip, Typography, Badge } from '@mui/material';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import type { OptimizationResultSummary } from '../../_types';
import { detectOperationalConflicts, type OperationalConflict } from '../_helpers/operational-conflicts';

export interface OperationalConflictIndicatorProps {
  res: OptimizationResultSummary;
}

/**
 * Compact indicator component for operational conflicts
 * Non-intrusive header indicator that shows summary + tooltip details
 */
export function OperationalConflictIndicator({ res }: OperationalConflictIndicatorProps) {
  const conflicts = useMemo(() => detectOperationalConflicts(res), [res]);

  const hasErrors = conflicts.some(c => c.severity === 'error');
  const hasWarnings = conflicts.some(c => c.severity === 'warning');

  if (!hasErrors && !hasWarnings) {
    return (
      <Tooltip title="Nenhum conflito operacional detectado">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <IconCircleCheck size={16} style={{ color: '#4caf50', flexShrink: 0 }} />
          <Typography variant="caption" fontWeight={700} sx={{ color: 'success.main' }}>
            Viável
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const errorCount = conflicts.filter(c => c.severity === 'error').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;

  return (
    <Tooltip
      arrow
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="caption" display="block" fontWeight={900} sx={{ mb: 0.5, borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.5 }}>
            Conflitos Operacionais
          </Typography>
          <Stack spacing={0.5}>
            {conflicts.map((c, i) => (
              <Typography key={i} variant="caption" sx={{ fontSize: '0.75rem', opacity: 0.95 }}>
                • {c.message}
              </Typography>
            ))}
          </Stack>
        </Box>
      }
    >
      <Stack direction="row" spacing={0.75} alignItems="center">
        {errorCount > 0 && (
          <Badge badgeContent={errorCount} color="error" overlap="circular">
            <Chip
              size="small"
              variant="outlined"
              label="Erro"
              icon={<IconAlertCircle size={14} />}
              color="error"
              sx={{ height: 22, fontWeight: 700 }}
            />
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge badgeContent={warningCount} color="warning" overlap="circular">
            <Chip
              size="small"
              variant="outlined"
              label="Aviso"
              color="warning"
              sx={{ height: 22, fontWeight: 700 }}
            />
          </Badge>
        )}
      </Stack>
    </Tooltip>
  );
}
