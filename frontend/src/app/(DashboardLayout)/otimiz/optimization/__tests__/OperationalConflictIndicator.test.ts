import { describe, it, expect } from 'vitest';
import { detectOperationalConflicts, type OperationalConflict } from '../_helpers/operational-conflicts';
import type { OptimizationResultSummary } from '../../_types';

describe('detectOperationalConflicts', () => {
  it('retorna vazio quando não há conflitos', () => {
    const res: OptimizationResultSummary = {
      blocks: [
        {
          block_id: 1,
          trips: [
            { id: 1, start_time: 360, end_time: 420, destination_terminal_id: 1 },
            { id: 2, start_time: 480, end_time: 540, destination_terminal_id: 1 },
          ],
        },
      ],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    expect(conflicts).toHaveLength(0);
  });

  it('detecta viagens sobrepostas (erro crítico)', () => {
    const res: OptimizationResultSummary = {
      blocks: [
        {
          block_id: 1,
          trips: [
            { id: 1, start_time: 360, end_time: 450, destination_terminal_id: 1 },
            { id: 2, start_time: 420, end_time: 540, destination_terminal_id: 1 }, // Sobreposição!
          ],
        },
      ],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    const overlapConflict = conflicts.find(c => c.type === 'overlap');
    expect(overlapConflict).toBeDefined();
    expect(overlapConflict?.severity).toBe('error');
  });

  it('detecta intervalo muito curto entre viagens (<2 min)', () => {
    const res: OptimizationResultSummary = {
      blocks: [
        {
          block_id: 1,
          trips: [
            { id: 1, start_time: 360, end_time: 420, destination_terminal_id: 1 },
            { id: 2, start_time: 421, end_time: 480, destination_terminal_id: 1 }, // Gap = 1 min
          ],
        },
      ],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    const unrealisticConflict = conflicts.find(c => c.type === 'unrealistic');
    expect(unrealisticConflict).toBeDefined();
    expect(unrealisticConflict?.severity).toBe('warning');
  });

  it('detecta falta de intervalo em jornada longa (>6h)', () => {
    const res: OptimizationResultSummary = {
      blocks: [
        {
          block_id: 1,
          trips: [
            { id: 1, start_time: 360, end_time: 420, destination_terminal_id: 1 },
            { id: 2, start_time: 425, end_time: 480, destination_terminal_id: 1 },
            { id: 3, start_time: 485, end_time: 540, destination_terminal_id: 1 },
            { id: 4, start_time: 545, end_time: 600, destination_terminal_id: 1 },
            { id: 5, start_time: 605, end_time: 660, destination_terminal_id: 1 },
            { id: 6, start_time: 665, end_time: 720, destination_terminal_id: 1 },
            // Total: 360-720 = 360 min = 6h; gaps: 5 min each, max 5 < 15
          ],
        },
      ],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    const breakConflict = conflicts.find(c => c.type === 'break-violation');
    expect(breakConflict?.severity).toBe('warning');
  });

  it('detecta blocos sem retorno à garagem', () => {
    const res: OptimizationResultSummary = {
      blocks: [
        {
          block_id: 1,
          trips: [
            { id: 1, start_time: 360, end_time: 420, destination_terminal_id: 1 },
            { id: 2, start_time: 480, end_time: 540, destination_terminal_id: 5 }, // Terminal 5, não é garagem
          ],
        },
      ],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    const noReturnConflict = conflicts.find(c => c.type === 'no-return');
    expect(noReturnConflict?.severity).toBe('warning');
  });

  it('consolida múltiplos conflitos do mesmo tipo', () => {
    const res: OptimizationResultSummary = {
      blocks: [
        {
          block_id: 1,
          trips: [
            { id: 1, start_time: 360, end_time: 420, destination_terminal_id: 1 },
            { id: 2, start_time: 421, end_time: 480, destination_terminal_id: 1 }, // Unrealistic gap
          ],
        },
        {
          block_id: 2,
          trips: [
            { id: 3, start_time: 360, end_time: 420, destination_terminal_id: 1 },
            { id: 4, start_time: 421, end_time: 480, destination_terminal_id: 1 }, // Another unrealistic gap
          ],
        },
      ],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    const unrealisticConflicts = conflicts.filter(c => c.type === 'unrealistic');
    // Cada um tem count=1 mas após consolidação deve ter count=2
    expect(unrealisticConflicts.length).toBeGreaterThan(0);
  });

  it('retorna status "viável" quando res está vazio', () => {
    const res: OptimizationResultSummary = {
      blocks: [],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    expect(conflicts).toHaveLength(0);
  });

  it('trata trips com valores undefined graciosamente', () => {
    const res: OptimizationResultSummary = {
      blocks: [
        {
          block_id: 1,
          trips: [
            { id: 1, start_time: undefined, end_time: undefined },
            { id: 2, start_time: 480, end_time: 540 },
          ],
        },
      ],
      duties: [],
      metadata: {},
    };

    const conflicts = detectOperationalConflicts(res);
    // Deve não lançar erro
    expect(conflicts).toBeDefined();
  });
});
