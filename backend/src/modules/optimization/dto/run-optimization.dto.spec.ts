/**
 * Testes unitários: RunOptimizationDto — Class-Validator
 *
 * Valida que as regras de validação do DTO repelem payloads inválidos
 * ANTES de qualquer comunicação com o optimizer Python.
 *
 * Grupo 2 do PLANO_COPILOT_WEB_OPT.md — Backend NestJS DTO Audit
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RunOptimizationDto } from './run-optimization.dto';

function toDto(plain: Record<string, any>): RunOptimizationDto {
  return plainToInstance(RunOptimizationDto, plain);
}

async function expectValid(plain: Record<string, any>) {
  const errors = await validate(toDto(plain));
  if (errors.length) {
    throw new Error(
      `Esperado válido, mas obteve erros: ${JSON.stringify(errors.map((e) => e.constraints))}`,
    );
  }
}

async function expectInvalid(plain: Record<string, any>, field?: string) {
  const errors = await validate(toDto(plain));
  if (!errors.length) throw new Error(`Esperado inválido para ${JSON.stringify(plain)}, mas passou.`);
  if (field) {
    const fieldErrors = errors.find((e) => e.property === field);
    if (!fieldErrors) {
      throw new Error(
        `Campo '${field}' deveria ter erros, mas os erros foram em: ${errors.map((e) => e.property).join(', ')}`,
      );
    }
  }
}

describe('RunOptimizationDto', () => {
  // ─── timeBudgetSeconds ──────────────────────────────────

  describe('timeBudgetSeconds', () => {
    it('aceita valor válido dentro do range (30)', async () => {
      await expectValid({ lineId: 1, companyId: 1, timeBudgetSeconds: 30 });
    });

    it('aceita valor no limite mínimo (5)', async () => {
      await expectValid({ lineId: 1, companyId: 1, timeBudgetSeconds: 5 });
    });

    it('aceita valor no limite máximo (600)', async () => {
      await expectValid({ lineId: 1, companyId: 1, timeBudgetSeconds: 600 });
    });

    it('rejeita valor abaixo do mínimo (4)', async () => {
      await expectInvalid({ lineId: 1, companyId: 1, timeBudgetSeconds: 4 }, 'timeBudgetSeconds');
    });

    it('rejeita valor negativo (-1)', async () => {
      await expectInvalid({ lineId: 1, companyId: 1, timeBudgetSeconds: -1 }, 'timeBudgetSeconds');
    });

    it('rejeita zero (0)', async () => {
      await expectInvalid({ lineId: 1, companyId: 1, timeBudgetSeconds: 0 }, 'timeBudgetSeconds');
    });

    it('rejeita valor acima do máximo (601)', async () => {
      await expectInvalid({ lineId: 1, companyId: 1, timeBudgetSeconds: 601 }, 'timeBudgetSeconds');
    });

    it('é opcional — omitido é válido', async () => {
      await expectValid({ lineId: 1, companyId: 1 });
    });

    it('rejeita string de número (não coercido pelo class-validator sem transform)', async () => {
      // Se não usar @Transform, strings não são números válidos
      const dto = toDto({ lineId: 1, timeBudgetSeconds: 'abc' });
      const errors = await validate(dto);
      const field = errors.find((e) => e.property === 'timeBudgetSeconds');
      // class-transformer sem @Type converte string para NaN — @IsNumber deve rejeitar
      expect(field).toBeDefined();
    });
  });

  // ─── operationMode ──────────────────────────────────────

  describe('operationMode', () => {
    it('aceita "urban"', async () => {
      await expectValid({ lineId: 1, operationMode: 'urban' });
    });

    it('aceita "charter"', async () => {
      await expectValid({ lineId: 1, operationMode: 'charter' });
    });

    it('rejeita valor inválido "suburban"', async () => {
      await expectInvalid({ lineId: 1, operationMode: 'suburban' }, 'operationMode');
    });

    it('rejeita valor numérico', async () => {
      await expectInvalid({ lineId: 1, operationMode: 1 }, 'operationMode');
    });

    it('é opcional — omitido é válido', async () => {
      await expectValid({ lineId: 1, companyId: 1 });
    });
  });

  // ─── algorithm ───────────────────────────────────────────

  describe('algorithm', () => {
    it('aceita todos os algoritmos válidos', async () => {
      const valid = [
        'greedy', 'genetic', 'simulated_annealing', 'tabu_search',
        'set_partitioning', 'joint_solver', 'hybrid_pipeline',
      ];
      for (const alg of valid) {
        await expectValid({ lineId: 1, algorithm: alg });
      }
    });

    it('rejeita algoritmo inexistente', async () => {
      await expectInvalid({ lineId: 1, algorithm: 'magic_solver' }, 'algorithm');
    });

    it('é opcional — usa default hybrid_pipeline', async () => {
      await expectValid({ lineId: 1 });
    });
  });

  // ─── lineId / lineIds ─────────────────────────────────────

  describe('lineId / lineIds', () => {
    it('aceita apenas lineId', async () => {
      await expectValid({ lineId: 16 });
    });

    it('aceita apenas lineIds', async () => {
      await expectValid({ lineIds: [16, 17] });
    });

    it('aceita ambos (schema permite, service decide qual usar)', async () => {
      await expectValid({ lineId: 16, lineIds: [16, 17] });
    });

    it('rejeita lineId como string', async () => {
      await expectInvalid({ lineId: 'dezoito' }, 'lineId');
    });

    it('rejeita lineIds com string dentro do array', async () => {
      await expectInvalid({ lineIds: [16, 'dezoito'] }, 'lineIds');
    });
  });

  // ─── vspParams / cspParams ────────────────────────────────

  describe('vspParams e cspParams (IsObject)', () => {
    it('aceita vspParams como objeto vazio', async () => {
      await expectValid({ lineId: 1, vspParams: {} });
    });

    it('aceita cspParams com connectionToleranceMinutes', async () => {
      await expectValid({ lineId: 1, cspParams: { connectionToleranceMinutes: 5 } });
    });

    it('rejeita vspParams como string', async () => {
      await expectInvalid({ lineId: 1, vspParams: 'invalido' }, 'vspParams');
    });

    it('rejeita vspParams como número', async () => {
      await expectInvalid({ lineId: 1, vspParams: 42 }, 'vspParams');
    });
  });

  // ─── dryRun ───────────────────────────────────────────────

  describe('dryRun', () => {
    it('aceita true', async () => {
      await expectValid({ lineId: 1, dryRun: true });
    });

    it('aceita false', async () => {
      await expectValid({ lineId: 1, dryRun: false });
    });

    it('rejeita string "true"', async () => {
      await expectInvalid({ lineId: 1, dryRun: 'true' }, 'dryRun');
    });
  });

  // ─── Payload completo válido ───────────────────────────────

  it('aceita payload completo válido (smoke test)', async () => {
    await expectValid({
      companyId: 1,
      lineId: 16,
      algorithm: 'hybrid_pipeline',
      operationMode: 'urban',
      timeBudgetSeconds: 30,
      dryRun: false,
      vspParams: { maxVehicles: 10, allowMultiLineBlock: true },
      cspParams: { connectionToleranceMinutes: 2, maxWorkMinutes: 480 },
    });
  });
});
