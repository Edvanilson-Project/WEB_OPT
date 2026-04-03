'use client';

import { Chip } from '@mui/material';

// ─── Company / User / VehicleType status ─────────────────────────────────────
const ACTIVE_INACTIVE: Record<string, { label: string; color: any }> = {
  active:    { label: 'Ativo',    color: 'success' },
  inactive:  { label: 'Inativo', color: 'default' },
  suspended: { label: 'Suspenso',color: 'warning' },
};

// ─── Optimization run status ─────────────────────────────────────────────────
const OPT_STATUS: Record<string, { label: string; color: any }> = {
  pending:   { label: 'Aguardando', color: 'info'    },
  running:   { label: 'Executando', color: 'warning' },
  completed: { label: 'Concluído',  color: 'success' },
  failed:    { label: 'Falhou',     color: 'error'   },
  cancelled: { label: 'Cancelado',  color: 'default' },
};

// ─── User roles ───────────────────────────────────────────────────────────────
const ROLE: Record<string, { label: string; color: any }> = {
  super_admin:   { label: 'Super Admin',   color: 'error'   },
  company_admin: { label: 'Admin Empresa', color: 'warning' },
  analyst:       { label: 'Analista',      color: 'info'    },
  operator:      { label: 'Operador',      color: 'default' },
};

interface Props {
  type: 'status' | 'opt' | 'role';
  value: string;
  size?: 'small' | 'medium';
}

export default function StatusChip({ type, value, size = 'small' }: Props) {
  const map = type === 'opt' ? OPT_STATUS : type === 'role' ? ROLE : ACTIVE_INACTIVE;
  const cfg = map[value] ?? { label: value, color: 'default' };
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size={size}
      variant={type === 'role' ? 'outlined' : 'filled'}
    />
  );
}
