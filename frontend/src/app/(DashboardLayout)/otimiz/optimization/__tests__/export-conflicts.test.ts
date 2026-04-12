import { describe, it, expect } from 'vitest';
import { conflictsToCSV, conflictsToTSV, conflictsToJSON, conflictsToHTML, exportConflicts } from '../_helpers/export-conflicts';
import type { OperationalConflict } from '../_helpers/operational-conflicts';
import type { OptimizationResultSummary } from '../../_types';

describe('Export Conflicts', () => {
  const mockConflicts: OperationalConflict[] = [
    {
      type: 'overlap',
      severity: 'error',
      blockId: 1,
      message: 'Viagens sobrepostas detectadas',
      count: 1,
    },
    {
      type: 'unrealistic',
      severity: 'warning',
      blockId: 2,
      message: 'Intervalo muito curto entre viagens (1min)',
      count: 1,
    },
  ];

  const mockRes: OptimizationResultSummary = {
    blocks: [{ block_id: 1, trips: [] }, { block_id: 2, trips: [] }],
    duties: [],
    metadata: {},
  };

  describe('conflictsToCSV', () => {
    it('gera CSV válido com headers e dados', () => {
      const csv = conflictsToCSV(mockConflicts);
      const lines = csv.split('\n');
      
      expect(lines[0]).toContain('Bloco');
      expect(lines[0]).toContain('Tipo');
      expect(lines[0]).toContain('Severidade');
      expect(lines[1]).toContain('#1');
      expect(lines[1]).toContain('OVERLAP');
      expect(lines[1]).toContain('ERRO');
    });

    it('escapa aspas dentro de mensagens', () => {
      const conflict: OperationalConflict = {
        type: 'unrealistic',
        severity: 'warning',
        blockId: 1,
        message: 'Conflito com "aspas" no texto',
        count: 1,
      };
      
      const csv = conflictsToCSV([conflict]);
      expect(csv).toContain('""aspas""');
    });
  });

  describe('conflictsToTSV', () => {
    it('gera TSV com separador tab', () => {
      const tsv = conflictsToTSV(mockConflicts);
      const lines = tsv.split('\n');
      
      expect(lines[0]).toContain('Bloco\tTipo');
      expect(lines[1]).toContain('#1\tOVERLAP');
    });
  });

  describe('conflictsToJSON', () => {
    it('gera JSON estruturado com metadata', () => {
      const json = conflictsToJSON(mockConflicts, mockRes);
      const parsed = JSON.parse(json);

      expect(parsed.totalConflicts).toBe(2);
      expect(parsed.stats.errors).toBe(1);
      expect(parsed.stats.warnings).toBe(1);
      expect(parsed.conflicts).toHaveLength(2);
      expect(parsed.exportDate).toBeDefined();
    });

    it('agrupa conflitos por tipo em stats', () => {
      const json = conflictsToJSON(mockConflicts, mockRes);
      const parsed = JSON.parse(json);

      const byType = parsed.stats.byType;
      expect(byType).toContainEqual({ type: 'overlap', count: 1 });
      expect(byType).toContainEqual({ type: 'unrealistic', count: 1 });
    });
  });

  describe('conflictsToHTML', () => {
    it('gera HTML com tabela e estilos', () => {
      const html = conflictsToHTML(mockConflicts);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<table>');
      expect(html).toContain('Relatório de Conflitos Operacionais');
      expect(html).toContain('#1');
      expect(html).toContain('ERRO');
    });

    it('exibe data de geração em pt-BR', () => {
      const html = conflictsToHTML(mockConflicts);
      expect(html).toContain('Gerado em:');
    });
  });

  describe('exportConflicts', () => {
    it('exporta em CSV com nome contendo data', () => {
      const result = exportConflicts(mockRes, 'csv');
      
      expect(result.format).toBe('csv');
      expect(result.filename).toMatch(/conflitos-operacionais-\d{4}-\d{2}-\d{2}\.csv/);
      expect(result.mimeType).toBe('text/csv;charset=utf-8');
      expect(result.content).toContain('Bloco,Tipo');
    });

    it('exporta em JSON com estrutura completa', () => {
      const result = exportConflicts(mockRes, 'json');
      
      expect(result.format).toBe('json');
      expect(result.mimeType).toBe('application/json;charset=utf-8');
      const parsed = JSON.parse(result.content);
      expect(parsed.totalConflicts).toBeDefined();
    });

    it('exporta em HTML com formatação completa', () => {
      const result = exportConflicts(mockRes, 'html');
      
      expect(result.format).toBe('html');
      expect(result.mimeType).toBe('text/html;charset=utf-8');
      expect(result.content).toContain('<!DOCTYPE html>');
    });

    it('exporta em TSV formato correto', () => {
      const result = exportConflicts(mockRes, 'tsv');
      
      expect(result.format).toBe('tsv');
      expect(result.filename).toMatch(/\.tsv$/);
      expect(result.mimeType).toBe('text/tab-separated-values;charset=utf-8');
    });
  });

  describe('edge cases', () => {
    it('trata conflitos sem blockId', () => {
      const conflict: OperationalConflict = {
        type: 'overlap',
        severity: 'error',
        message: 'Erro geral',
        count: 1,
      };

      const csv = conflictsToCSV([conflict]);
      expect(csv).toContain('N/A');
    });

    it('trata lista vazia de conflitos', () => {
      const csv = conflictsToCSV([]);
      const json = conflictsToJSON([], mockRes);
      const html = conflictsToHTML([]);

      expect(csv).toContain('Bloco,Tipo');
      expect(JSON.parse(json).totalConflicts).toBe(0);
      expect(html).toContain('<tbody>\n        \n      </tbody>');
    });
  });
});
