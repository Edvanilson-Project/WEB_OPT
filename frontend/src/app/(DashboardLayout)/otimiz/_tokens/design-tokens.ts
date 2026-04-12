import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// ── Table tokens ─────────────────────────────────────────────────────────────
/** Header cell: bold */
export const thSx = { fontWeight: 700 } as const;
/** Compact body cell: reduced vertical padding */
export const tdCompactSx = { py: 0.75 } as const;

// ── Card / KPI tokens ────────────────────────────────────────────────────────
export const kpiCardSx = {
  p: 2,
  borderRadius: 2,
  textAlign: 'center' as const,
  borderLeft: '4px solid',
} as const;

// ── Dialog tokens ────────────────────────────────────────────────────────────
export const dialogTitleSx = { fontWeight: 700 } as const;

// ── Gantt palette (theme-aware) ──────────────────────────────────────────────
/** 10-color palette for line-based visualizations (Gantt, charts) */
export function getLinePalette(theme: Theme): string[] {
  return [
    theme.palette.info.main,
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.secondary.main,
    theme.palette.warning.main,
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange (flat)
    '#6366f1', // Indigo
  ];
}

/** Gantt trip direction / deadhead colors */
export function getGanttColors(theme: Theme) {
  return {
    ida: theme.palette.info.main,
    volta: theme.palette.primary.main,
    deadhead: alpha(theme.palette.warning.main, 0.18),
    deadheadBorder: alpha(theme.palette.warning.dark, 0.45),
  } as const;
}
