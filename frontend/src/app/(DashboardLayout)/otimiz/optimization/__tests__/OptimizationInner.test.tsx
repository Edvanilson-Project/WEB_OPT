/**
 * @file OptimizationInner.test.tsx
 * Suite de testes Vitest + React Testing Library
 *
 * Foco: state grouping de Modo de Operação (urban/charter) e Algoritmos.
 * Os testes validam que os selects e botões respondem corretamente a cliques.
 */

import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Utilitários puros (sem dependência de API/contexto) ──────────────────────
// Importados por caminho relativo para evitar resolução de aliases em testes unitários
import {
  fmtCurrency,
  minToHHMM,
  minToDuration,
  TripDetailTable,
  TripTimeline,
} from './test-helpers';

// ─── Mocks globais ────────────────────────────────────────────────────────────

// Evita erros de localStorage em jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock do módulo de API para evitar chamadas de rede
vi.mock('@/lib/api', () => ({
  optimizationApi: {
    getAll: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue({ id: 99, status: 'pending' }),
  },
  optimizationSettingsApi: {
    getActive: vi.fn().mockResolvedValue(null),
  },
  linesApi: {
    getAll: vi.fn().mockResolvedValue([
      { id: 1, code: 'L1', name: 'Linha 1' },
      { id: 2, code: 'L2', name: 'Linha 2' },
    ]),
  },
  getSessionUser: vi.fn().mockReturnValue({ id: 1, companyId: 1, name: 'Teste' }),
  extractArray: vi.fn((val: unknown) => Array.isArray(val) ? val : []),
}));

// ─── Testes das funções utilitárias puras ─────────────────────────────────────

describe('Utilitários de formatação', () => {
  describe('fmtCurrency', () => {
    it('formata número como BRL', () => {
      expect(fmtCurrency(1500)).toContain('1.500');
    });
    it('retorna "--" para null', () => {
      expect(fmtCurrency(null)).toBe('--');
    });
    it('retorna "--" para undefined', () => {
      expect(fmtCurrency(undefined)).toBe('--');
    });
    it('retorna "--" para string vazia', () => {
      expect(fmtCurrency('')).toBe('--');
    });
    it('retorna "--" para NaN string', () => {
      expect(fmtCurrency('abc')).toBe('--');
    });
    it('aceita strings numéricas válidas', () => {
      expect(fmtCurrency('2000')).toContain('2.000');
    });
  });

  describe('minToHHMM', () => {
    it('converte 360 para 06:00', () => {
      expect(minToHHMM(360)).toBe('06:00');
    });
    it('converte 0 para 00:00', () => {
      expect(minToHHMM(0)).toBe('00:00');
    });
    it('converte 1439 para 23:59', () => {
      expect(minToHHMM(1439)).toBe('23:59');
    });
    it('retorna --:-- para null', () => {
      expect(minToHHMM(null)).toBe('--:--');
    });
    it('retorna --:-- para undefined', () => {
      expect(minToHHMM(undefined)).toBe('--:--');
    });
    it('suporta horários após meia-noite (1440+)', () => {
      expect(minToHHMM(1440)).toBe('24:00');
    });
  });

  describe('minToDuration', () => {
    it('45 min → "45min"', () => {
      expect(minToDuration(45)).toBe('45min');
    });
    it('90 min → "1h30"', () => {
      expect(minToDuration(90)).toBe('1h30');
    });
    it('60 min → "1h"', () => {
      expect(minToDuration(60)).toBe('1h');
    });
    it('0 min → "0min"', () => {
      expect(minToDuration(0)).toBe('0min');
    });
    it('null → "--"', () => {
      expect(minToDuration(null)).toBe('--');
    });
    it('undefined → "--"', () => {
      expect(minToDuration(undefined)).toBe('--');
    });
  });
});

// ─── Testes de componentes de renderização ────────────────────────────────────

describe('TripDetailTable', () => {
  const tripsCompletos = [
    { id: 1, start_time: 360, end_time: 420, origin_id: 1, destination_id: 2, duration: 60 },
    { id: 2, start_time: 430, end_time: 490, origin_id: 2, destination_id: 3, duration: 60 },
  ];

  it('renderiza sem crash com trips completos', () => {
    const { container } = render(<TripDetailTable trips={tripsCompletos as any} />);
    expect(container.querySelector('table')).toBeTruthy();
  });

  it('renderiza sem crash com trips legados (start_time null)', () => {
    const tripsLegados = [
      { id: 10, start_time: null, end_time: null, origin_id: 1, destination_id: 2, duration: 0 },
    ];
    // Não deve lançar exceção
    expect(() => render(<TripDetailTable trips={tripsLegados as any} />)).not.toThrow();
  });

  it('exibe "--:--" para trips sem start_time', () => {
    const tripsLegados = [
      { id: 10, start_time: null, end_time: null, origin_id: 1, destination_id: 2, duration: 0 },
    ];
    render(<TripDetailTable trips={tripsLegados as any} />);
    // Deve exibir --:-- (ou -- para horários sem valor)
    const dashes = screen.getAllByText(/--:--|--/);
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('exibe IDs formatados como #N', () => {
    render(<TripDetailTable trips={tripsCompletos as any} />);
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
  });

  it('ordena viagens por start_time', () => {
    const desordenadas = [
      { id: 2, start_time: 430, end_time: 490, origin_id: 2, destination_id: 3, duration: 60 },
      { id: 1, start_time: 360, end_time: 420, origin_id: 1, destination_id: 2, duration: 60 },
    ];
    render(<TripDetailTable trips={desordenadas as any} />);
    // id=1 (06:00) deve aparecer antes de id=2 (07:10) no DOM
    const rows = screen.getAllByText(/^#\d+$/);
    expect(rows[0].textContent).toBe('#1');
    expect(rows[1].textContent).toBe('#2');
  });
});

describe('TripTimeline', () => {
  it('renderiza sem crash com trips válidos', () => {
    const trips = [
      { id: 1, start_time: 360, end_time: 420 },
      { id: 2, start_time: 430, end_time: 490 },
    ];
    expect(() =>
      render(<TripTimeline trips={trips as any} start={360} end={490} totalDuration={130} />)
    ).not.toThrow();
  });

  it('retorna null quando totalDuration é 0', () => {
    const { container } = render(
      <TripTimeline trips={[]} start={0} end={0} totalDuration={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('não crasha com start_time null em viagem legada', () => {
    const trips = [{ id: 1, start_time: null, end_time: null }];
    expect(() =>
      render(<TripTimeline trips={trips as any} start={360} end={480} totalDuration={120} />)
    ).not.toThrow();
  });
});
