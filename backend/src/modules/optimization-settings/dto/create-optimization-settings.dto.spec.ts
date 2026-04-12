/**
 * Validação da CreateOptimizationSettingsDto
 *
 * Testa que o DTO aceita configurações válidas (incluindo operationMode)
 * e rejeita valores inválidos — detectando o bug "property should not exist".
 */

import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOptimizationSettingsDto } from './create-optimization-settings.dto';

async function validateDto(plain: Record<string, unknown>): Promise<ValidationError[]> {
  const instance = plainToInstance(CreateOptimizationSettingsDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

function errorFields(errors: ValidationError[]): string[] {
  return errors.map(e => e.property);
}

// ─── Payload mínimo válido ────────────────────────────────────────────────────

const minimalValid: Record<string, unknown> = {
  algorithmType: 'hybrid_pipeline',
};

// ─── Payload completo válido (urbano) ─────────────────────────────────────────

const fullUrban: Record<string, unknown> = {
  algorithmType: 'hybrid_pipeline',
  timeBudgetSeconds: 120,
  cctMaxShiftMinutes: 480,
  cctMinLayoverMinutes: 8,
  cctInterShiftRestMinutes: 660,
  operationMode: 'urban',
  isActive: true,
};

// ─── Payload fretamento (charter) ────────────────────────────────────────────

const fullCharter: Record<string, unknown> = {
  algorithmType: 'simulated_annealing',
  timeBudgetSeconds: 300,
  cctMaxShiftMinutes: 720,
  operationMode: 'charter',
  isActive: false,
};

// ─── Configure típica de produção com todos os campos principais ──────────────

const productionConfig: Record<string, unknown> = {
  algorithmType: 'joint_solver',
  timeBudgetSeconds: 600,
  cctMaxShiftMinutes: 480,
  cctMinLayoverMinutes: 10,
  cctInterShiftRestMinutes: 660,
  cctMealBreakMinutes: 30,
  operationMode: 'urban',
  fixedVehicleActivationCost: 250.0,
  deadheadCostPerMinute: 0.5,
  idleCostPerMinute: 0.2,
  operatorChangeTerminalsOnly: true,
  operatorSingleVehicleOnly: false,
  strictHardValidation: true,
  enforceTripGroupsHard: true,
  preservePreferredPairs: true,
  isActive: true,
};

// ─── Suíte de testes ──────────────────────────────────────────────────────────

describe('CreateOptimizationSettingsDto — validação de DTO', () => {
  describe('payload mínimo', () => {
    it('aceita apenas algorithmType', async () => {
      const errors = await validateDto(minimalValid);
      expect(errorFields(errors)).toEqual([]);
    });
  });

  describe('operationMode', () => {
    it('aceita operationMode "urban"', async () => {
      const errors = await validateDto({ ...minimalValid, operationMode: 'urban' });
      expect(errorFields(errors)).toEqual([]);
    });

    it('aceita operationMode "charter"', async () => {
      const errors = await validateDto({ ...minimalValid, operationMode: 'charter' });
      expect(errorFields(errors)).toEqual([]);
    });

    it('aceita ausência de operationMode (opcional)', async () => {
      const errors = await validateDto(minimalValid);
      expect(errorFields(errors)).not.toContain('operationMode');
    });

    it('rejeita operationMode com valor inválido', async () => {
      const errors = await validateDto({ ...minimalValid, operationMode: 'invalid_mode' });
      expect(errorFields(errors)).toContain('operationMode');
    });

    it('rejeita operationMode numérico', async () => {
      const errors = await validateDto({ ...minimalValid, operationMode: 3 });
      expect(errorFields(errors)).toContain('operationMode');
    });
  });

  describe('configuração urbana completa', () => {
    it('aceita payload urbano completo sem erros', async () => {
      const errors = await validateDto(fullUrban);
      expect(errorFields(errors)).toEqual([]);
    });
  });

  describe('configuração de fretamento', () => {
    it('aceita payload charter sem erros', async () => {
      const errors = await validateDto(fullCharter);
      expect(errorFields(errors)).toEqual([]);
    });
  });

  describe('configuração de produção completa', () => {
    it('aceita payload de produção sem erros', async () => {
      const errors = await validateDto(productionConfig);
      expect(errorFields(errors)).toEqual([]);
    });

    it('aceita strictHardValidation como campo persistível', async () => {
      const errors = await validateDto({
        ...minimalValid,
        strictHardValidation: false,
      });
      expect(errorFields(errors)).toEqual([]);
    });
  });

  describe('campos opcionais — limites', () => {
    it('rejeita timeBudgetSeconds < 30', async () => {
      const errors = await validateDto({ ...minimalValid, timeBudgetSeconds: 10 });
      expect(errorFields(errors)).toContain('timeBudgetSeconds');
    });

    it('rejeita timeBudgetSeconds > 3600', async () => {
      const errors = await validateDto({ ...minimalValid, timeBudgetSeconds: 4000 });
      expect(errorFields(errors)).toContain('timeBudgetSeconds');
    });

    it('aceita timeBudgetSeconds no limite inferior (30)', async () => {
      const errors = await validateDto({ ...minimalValid, timeBudgetSeconds: 30 });
      expect(errorFields(errors)).toEqual([]);
    });

    it('aceita timeBudgetSeconds no limite superior (3600)', async () => {
      const errors = await validateDto({ ...minimalValid, timeBudgetSeconds: 3600 });
      expect(errorFields(errors)).toEqual([]);
    });

    it('rejeita cctMaxShiftMinutes < 60', async () => {
      const errors = await validateDto({ ...minimalValid, cctMaxShiftMinutes: 30 });
      expect(errorFields(errors)).toContain('cctMaxShiftMinutes');
    });

    it('rejeita cctMaxShiftMinutes > 720', async () => {
      const errors = await validateDto({ ...minimalValid, cctMaxShiftMinutes: 800 });
      expect(errorFields(errors)).toContain('cctMaxShiftMinutes');
    });
  });

  describe('campos não permitidos (whitelist)', () => {
    it('rejeita campo desconhecido "fooBar"', async () => {
      const errors = await validateDto({ ...minimalValid, fooBar: 'xpto' });
      // Com forbidNonWhitelisted, deve gerar erro para o campo extra
      expect(errorFields(errors)).toContain('fooBar');
    });

    it('não rejeita operationMode como campo desconhecido (fix de regressão)', async () => {
      // Este teste detecta o bug original: operationMode causava 400
      const errors = await validateDto({ ...minimalValid, operationMode: 'urban' });
      // operationMode NÃO deve aparecer nos erros após o fix
      expect(errorFields(errors)).not.toContain('operationMode');
    });
  });

  describe('múltiplas configurações alternadas', () => {
    const configs = [
      { algorithmType: 'greedy', operationMode: 'urban' },
      { algorithmType: 'simulated_annealing', operationMode: 'charter', timeBudgetSeconds: 180 },
      { algorithmType: 'tabu_search', operationMode: 'urban', timeBudgetSeconds: 60 },
      { algorithmType: 'set_partitioning', operationMode: 'charter', timeBudgetSeconds: 600 },
      { algorithmType: 'joint_solver', operationMode: 'urban', cctMaxShiftMinutes: 480 },
      { algorithmType: 'hybrid_pipeline', isActive: true },
      { algorithmType: 'hybrid_pipeline', isActive: false, operationMode: 'charter' },
    ];

    configs.forEach((cfg, idx) => {
      it(`configuração #${idx + 1} (${cfg.algorithmType}/${(cfg as any).operationMode ?? 'sem modo'}) é válida`, async () => {
        const errors = await validateDto(cfg as Record<string, unknown>);
        expect(errorFields(errors)).toEqual([]);
      });
    });
  });
});
