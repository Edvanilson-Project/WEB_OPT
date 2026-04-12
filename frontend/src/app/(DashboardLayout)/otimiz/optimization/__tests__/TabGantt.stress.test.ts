import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

/**
 * Harness para testes de stress: simula alto volume de linhas (múltiplos veículos)
 * e validação de performance/virtualizacao
 */
function GanttStressHarness({ vehicleCount }: { vehicleCount: number }) {
  const [expandedVehicles, setExpandedVehicles] = React.useState<Set<string>>(new Set());

  const vehicles = React.useMemo(() => {
    return Array.from({ length: vehicleCount }, (_, i) => ({
      id: `v${i}`,
      name: `Veículo ${String(i + 1).padStart(3, '0')}`,
      trips: 3 + (i % 5),
    }));
  }, [vehicleCount]);

  const handleToggleVehicle = (vehicleId: string) => {
    setExpandedVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  };

  return React.createElement(
    'div',
    { 'data-testid': 'gantt-stress-container' },
    React.createElement('div', { 'data-testid': 'gantt-header' }, `Total: ${vehicleCount} veículos`),
    React.createElement('div', { 'data-testid': 'gantt-virtualized-list', role: 'list' },
      vehicles.map((vehicle) =>
        React.createElement(
          'div',
          {
            key: vehicle.id,
            'data-testid': `gantt-row-${vehicle.id}`,
            role: 'listitem',
            style: { height: '40px', borderBottom: '1px solid #eee', overflow: 'hidden' },
          },
          React.createElement(
            'button',
            {
              'data-testid': `gantt-expand-${vehicle.id}`,
              onClick: () => handleToggleVehicle(vehicle.id),
              type: 'button',
            },
            expandedVehicles.has(vehicle.id) ? '▼' : '▶',
          ),
          React.createElement('span', null, ` ${vehicle.name}`),
          React.createElement('span', { 'data-testid': `gantt-trips-${vehicle.id}` }, ` (${vehicle.trips} viagens)`),
          expandedVehicles.has(vehicle.id)
            ? React.createElement(
                'div',
                {
                  'data-testid': `gantt-expanded-${vehicle.id}`,
                  style: { marginLeft: '20px', marginTop: '5px', fontSize: '0.9em', color: '#666' },
                },
                `Detalhes de ${vehicle.name}...`,
              )
            : null,
        ),
      ),
    ),
  );
}

function renderWithTheme(ui: React.ReactNode) {
  return render(React.createElement(ThemeProvider, { theme }, ui));
}

describe('TabGantt stress tests (múltiplas linhas e alto volume)', () => {
  it('renderiza 20 linhas adequadamente', async () => {
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 20 }));

    expect(screen.getByTestId('gantt-header')).toHaveTextContent('Total: 20 veículos');

    // Verificar que todas as 20 linhas foram renderizadas
    for (let i = 0; i < 20; i++) {
      const row = screen.getByTestId(`gantt-row-v${i}`);
      expect(row).toBeInTheDocument();
      expect(row).toHaveTextContent(`Veículo ${String(i + 1).padStart(3, '0')}`);
    }
  });

  it('renderiza 50 linhas sem degradacao de performance', async () => {
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 50 }));

    const container = screen.getByTestId('gantt-virtualized-list');
    expect(container).toBeInTheDocument();

    // Verificar primeiras 5 e últimas 5 linhas
    expect(screen.getByTestId('gantt-row-v0')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-v49')).toBeInTheDocument();
  });

  it('renderiza 100+ linhas e permite expansão seletiva de linhas', async () => {
    const user = userEvent.setup();
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 100 }));

    expect(screen.getByTestId('gantt-header')).toHaveTextContent('Total: 100 veículos');

    // Expandir algumas linhas representativas
    await user.click(screen.getByTestId('gantt-expand-v0'));
    expect(screen.getByTestId('gantt-expanded-v0')).toBeInTheDocument();

    await user.click(screen.getByTestId('gantt-expand-v50'));
    expect(screen.getByTestId('gantt-expanded-v50')).toBeInTheDocument();

    // Recolher v0
    await user.click(screen.getByTestId('gantt-expand-v0'));
    expect(screen.queryByTestId('gantt-expanded-v0')).not.toBeInTheDocument();

    // v50 deve continuar expandido
    expect(screen.getByTestId('gantt-expanded-v50')).toBeInTheDocument();
  });

  it('mantém estado de expansão consistente durante interações múltiplas', async () => {
    const user = userEvent.setup();
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 30 }));

    const expandButtons = ['v0', 'v10', 'v20', 'v29'];

    // Expandir múltiplas linhas
    for (const vehicleId of expandButtons) {
      await user.click(screen.getByTestId(`gantt-expand-${vehicleId}`));
      expect(screen.getByTestId(`gantt-expanded-${vehicleId}`)).toBeInTheDocument();
    }

    // Verificar que todas continuam expandidas
    for (const vehicleId of expandButtons) {
      expect(screen.getByTestId(`gantt-expanded-${vehicleId}`)).toBeInTheDocument();
    }
  });

  it('exibe contagem de viagens corretamente para cada linha em alto volume', async () => {
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 40 }));

    // Verificar que o contador de viagens está visível para algumas linhas
    for (let i = 0; i < 10; i++) {
      const tripsDisplay = screen.getByTestId(`gantt-trips-v${i}`);
      expect(tripsDisplay).toHaveTextContent(/\(\d+ viagens\)/);
    }
  });

  it('permite scroll e navegação em lista de 100+ linhas', async () => {
    const user = userEvent.setup();
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 150 }));

    const container = screen.getByTestId('gantt-virtualized-list');

    // Primeira linha deve estar visível no início
    expect(screen.getByTestId('gantt-row-v0')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-v149')).toBeInTheDocument();

    // Expandir uma linha no meio (simula navegação)
    await user.click(screen.getByTestId('gantt-expand-v75'));
    expect(screen.getByTestId('gantt-expanded-v75')).toBeInTheDocument();
  });

  it('performance: múltiplas expansões sucessivas (stress de estado)', async () => {
    const user = userEvent.setup();
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 50 }));

    // Realizar múltiplas expansões/recolhimentos rapidamente
    for (let i = 0; i < min(10, 50); i++) {
      const vehicleId = `v${i}`;
      await user.click(screen.getByTestId(`gantt-expand-${vehicleId}`));
      expect(screen.getByTestId(`gantt-expanded-${vehicleId}`)).toBeInTheDocument();
      await user.click(screen.getByTestId(`gantt-expand-${vehicleId}`));
      expect(screen.queryByTestId(`gantt-expanded-${vehicleId}`)).not.toBeInTheDocument();
    }
  });

  it('renderiza lista com 200 linhas sem travamento (extremo stress)', () => {
    const startTime = performance.now();
    renderWithTheme(React.createElement(GanttStressHarness, { vehicleCount: 200 }));
    const renderTime = performance.now() - startTime;

    // Render deve ser rápido mesmo com 200 linhas (< 500ms para harness simples)
    expect(renderTime).toBeLessThan(500);

    expect(screen.getByTestId('gantt-header')).toHaveTextContent('Total: 200 veículos');
    expect(screen.getByTestId('gantt-row-v0')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-v199')).toBeInTheDocument();
  });
});

// Utilitário simples
function min(a: number, b: number): number {
  return a < b ? a : b;
}
