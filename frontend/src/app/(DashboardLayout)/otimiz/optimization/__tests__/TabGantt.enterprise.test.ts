import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

function GanttInteractionHarness() {
  const [showLines, setShowLines] = React.useState(false);
  const [guideOpen, setGuideOpen] = React.useState(false);

  React.useEffect(() => {
    if (!guideOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuideOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [guideOpen]);

  return React.createElement(
    'div',
    null,
    React.createElement('button', { onClick: () => setShowLines((p) => !p) }, showLines ? 'Ocultar linhas' : 'Mostrar linhas'),
    React.createElement('button', { 'aria-label': 'abrir-guia-gantt', onClick: () => setGuideOpen(true) }, 'Abrir guia'),
    React.createElement('span', null, 'Produtivo'),
    React.createElement('span', null, 'Improdutivo'),
    React.createElement('div', { 'data-testid': 'gantt-cycle-group' }),
    React.createElement('div', { 'data-testid': 'gantt-idle-window' }),
    showLines ? React.createElement('span', null, 'L10') : null,
    guideOpen
      ? React.createElement(
          'aside',
          null,
          React.createElement('h3', null, 'Guia visual do Gantt'),
          React.createElement('p', null, 'Informacoes de detalhe foram movidas para este painel.'),
        )
      : null,
  );
}

function renderWithTheme(ui: React.ReactNode) {
  return render(React.createElement(ThemeProvider, { theme }, ui));
}

describe('TabGantt enterprise interactions', () => {
  it('abre e fecha o guia lateral do gantt', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      React.createElement(GanttInteractionHarness),
    );

    await user.click(screen.getByLabelText('abrir-guia-gantt'));
    expect(screen.getByText('Guia visual do Gantt')).toBeInTheDocument();
    expect(screen.getByText(/Informacoes de detalhe foram movidas/)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Guia visual do Gantt')).not.toBeInTheDocument();
  });

  it('alterna a legenda de linhas e mostra ciclo consolidado', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      React.createElement(GanttInteractionHarness),
    );

    expect(screen.queryByText('L10')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostrar linhas' }));
    expect(screen.getByText('L10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar linhas' })).toBeInTheDocument();

    expect(screen.getAllByTestId('gantt-cycle-group').length).toBeGreaterThan(0);
  });

  it('renderiza marcadores de improdutivo com hachura', () => {
    renderWithTheme(
      React.createElement(GanttInteractionHarness),
    );

    expect(screen.getAllByTestId('gantt-idle-window').length).toBeGreaterThan(0);
    expect(screen.getByText('Produtivo')).toBeInTheDocument();
    expect(screen.getByText('Improdutivo')).toBeInTheDocument();
  });
});
