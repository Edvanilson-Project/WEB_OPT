import React, { useState } from 'react';
import type { TripDetail } from '../../_types';

// ─── Utilitários de formatação ─────────────────────────────────────────────────

export function fmtCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '--';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function minToDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(Number(minutes))) return '--';
  const m = Math.floor(Math.abs(Number(minutes)));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min.toString().padStart(2, '0')}` : `${h}h`;
}

export function minToHHMM(minutes?: number | null): string {
  if (minutes == null || isNaN(Number(minutes))) return '--:--';
  const m = Math.abs(Number(minutes));
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

// ─── Componente: Tabela de Viagens ────────────────────────────────────────────

export function TripDetailTable({ trips }: { trips: TripDetail[] }) {
  const safeTrips = Array.isArray(trips) ? trips : [];
  const rows = safeTrips
    .slice()
    .sort((a, b) => (a?.start_time ?? 0) - (b?.start_time ?? 0))
    .map((trip, index) =>
      React.createElement(
        'tr',
        { key: `${trip?.id ?? 'trip'}-${index}` },
        React.createElement('td', null, minToHHMM(trip?.start_time)),
        React.createElement('td', null, minToHHMM(trip?.end_time)),
        React.createElement(
          'td',
          null,
          (trip as any)?.origin_name || (trip as any)?.origin_id || '--',
        ),
        React.createElement(
          'td',
          null,
          (trip as any)?.destination_name ||
            (trip as any)?.destination_id ||
            '--',
        ),
        React.createElement('td', null, minToDuration(trip?.duration)),
        React.createElement('td', null, `#${trip?.id ?? 'N/A'}`),
      ),
    );

  return React.createElement(
    'div',
    null,
    React.createElement(
      'table',
      null,
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          null,
          React.createElement('th', null, 'Inicio'),
          React.createElement('th', null, 'Fim'),
          React.createElement('th', null, 'Origem'),
          React.createElement('th', null, 'Destino'),
          React.createElement('th', null, 'Duracao'),
          React.createElement('th', null, 'ID'),
        ),
      ),
      React.createElement('tbody', null, rows),
    ),
  );
}

// ─── Componente: Timeline Gráfico ─────────────────────────────────────────────

export function TripTimeline({
  trips,
  start,
  end,
  totalDuration,
}: {
  trips: TripDetail[];
  start: number;
  end: number;
  totalDuration: number;
}) {
  if (!totalDuration || totalDuration <= 0) return null;

  const endLabel = minToHHMM(end);
  const bars = (trips ?? []).map((trip, index) => {
    const tripStart = trip?.start_time ?? start;
    const tripEnd = trip?.end_time ?? tripStart;
    const left = ((tripStart - start) / totalDuration) * 100;
    const width = Math.max(0.5, ((tripEnd - tripStart) / totalDuration) * 100);
    const isPull = (trip as any)?.is_pull_out || (trip as any)?.is_pull_back;

    return React.createElement('div', {
      key: `${trip?.id ?? 'timeline'}-${index}`,
      title: `${minToHHMM(tripStart)} - ${minToHHMM(tripEnd)} | #${trip?.id ?? index}`,
      style: {
        position: 'absolute',
        top: '2px',
        bottom: '2px',
        left: `${left}%`,
        width: `${width}%`,
        background: isPull ? '#ed6c02' : '#1976d2',
        borderRadius: '2px',
        opacity: 0.85,
      },
    });
  });

  return React.createElement(
    'div',
    {
      'data-end-label': endLabel,
      style: {
        position: 'relative',
        height: '26px',
        background: 'rgba(0,0,0,0.05)',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.12)',
      },
    },
    bars,
  );
}

// ─── Harness: Interações do Gantt Enterprise ─────────────────────────────────

export function EnterpriseGanttHarness({
  hasCycle = true,
  idleWindows = 1,
  lineLabels = ['L10'],
}: {
  hasCycle?: boolean;
  idleWindows?: number;
  lineLabels?: string[];
}) {
  const [showLines, setShowLines] = useState(false);
  const [openGuide, setOpenGuide] = useState(false);

  return React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => setShowLines((prev) => !prev),
        },
        showLines ? 'Ocultar linhas' : 'Mostrar linhas',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'aria-label': 'abrir-guia-gantt',
          onClick: () => setOpenGuide(true),
        },
        'Abrir guia',
      ),
    ),
    React.createElement('span', null, 'Produtivo'),
    React.createElement('span', null, 'Improdutivo'),
    ...Array.from({ length: idleWindows }, (_, index) =>
      React.createElement('div', {
        key: `idle-${index}`,
        'data-testid': 'gantt-idle-window',
      }),
    ),
    hasCycle
      ? React.createElement('div', { 'data-testid': 'gantt-cycle-group' })
      : null,
    ...(showLines
      ? lineLabels.map((label) => React.createElement('span', { key: label }, label))
      : []),
    openGuide
      ? React.createElement(
          'aside',
          null,
          React.createElement('h3', null, 'Guia visual do Gantt'),
          React.createElement(
            'p',
            null,
            'Informacoes de detalhe foram movidas para este painel.',
          ),
        )
      : null,
  );
}
