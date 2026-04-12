import React from 'react';
import { Box, Typography, Paper, Stack, Chip } from '@mui/material';

/* ── Page Hero ── Clean header banner with optional eyebrow, description, actions & metrics */
interface HeroMetric { label: string; value: string | number; hint: string; icon: React.ReactNode; tone: string }
interface OtimizPageHeroProps {
  title: string; subtitle?: string; eyebrow?: string; description?: string;
  actions?: React.ReactNode; metrics?: HeroMetric[];
}

export function OtimizPageHero({ title, subtitle, eyebrow, description, actions, metrics }: OtimizPageHeroProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
        <Box>
          {eyebrow && <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>{eyebrow}</Typography>}
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary" mt={0.5}>{subtitle}</Typography>}
          {description && <Typography variant="body2" color="text.secondary" mt={0.5}>{description}</Typography>}
        </Box>
        {actions && <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>{actions}</Stack>}
      </Stack>
      {metrics && metrics.length > 0 && (
        <Stack direction="row" spacing={2} mt={2} flexWrap="wrap" useFlexGap>
          {metrics.map((m, i) => (
            <Chip key={i} icon={<>{m.icon}</>} label={`${m.label}: ${m.value}`} variant="outlined" size="small" />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

/* ── Panel ── Simple outlined paper wrapper, consistent with DashboardCard */
export function OtimizPanel({ children, sx, contentSx }: { children: React.ReactNode; sx?: object; contentSx?: object }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', ...sx }}>
      <Box sx={{ p: 2, ...contentSx }}>{children}</Box>
    </Paper>
  );
}

/* ── Toolbar ── Minimal search/filter bar */
export function OtimizToolbar({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', ...sx }}>
      {children}
    </Box>
  );
}