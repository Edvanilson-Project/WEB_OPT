import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';

import { OperatorEntity } from './entities/operator.entity';
import { RosteringRuleEntity } from './entities/rostering-rule.entity';
import {
  OptimizationRunEntity,
  OptimizationStatus,
} from '../optimization/entities/optimization-run.entity';
import { OptimizerClientService } from '../optimization/optimizer-client.service';
import { OperatorsRepository } from './repositories/operators.repository';

/**
 * Serviço de Integração com o Motor Python de Rostering (SRP: Gerencia dados de operadores/regras e delega a atribuição global ao Python via ponte segura).
 */
@Injectable()
export class RosteringIntegrationService {
  private readonly logger = new Logger(RosteringIntegrationService.name);

  constructor(
    private readonly operatorRepo: OperatorsRepository,
    @InjectRepository(RosteringRuleEntity)
    private readonly ruleRepo: Repository<RosteringRuleEntity>,
    @InjectRepository(OptimizationRunEntity)
    private readonly runRepo: Repository<OptimizationRunEntity>,
    private readonly configService: ConfigService,
    private readonly optimizerClient: OptimizerClientService,
  ) {}

  /**
   * Gera o payload de Rostering e envia para o Python.
   */
  async executeRostering(
    operatorIds: number[],
    optimizationRunId: number,
    companyId: number,
    interShiftRestMinutes = 660,
  ): Promise<any> {
    // 1. Buscar operadores (Agora via repositório multi-tenant)
    const operators = await this.operatorRepo.findAll({
      where: { id: In(operatorIds), isActive: true } as any,
    });

    if (!operators.length) {
      throw new NotFoundException('Nenhum operador ativo encontrado para os IDs informados.');
    }

    // 2. Buscar regras ativas
    const rules = await this.ruleRepo.find({
      where: { companyId, isActive: true },
    });

    // 3. Buscar run de otimização para extrair os duties
    const run = await this.runRepo.findOne({
      where: { id: optimizationRunId, companyId },
    });

    if (!run) {
      throw new NotFoundException(`Optimization run #${optimizationRunId} não encontrado.`);
    }

    if (run.status !== OptimizationStatus.COMPLETED) {
      throw new Error(
        `Optimization run #${optimizationRunId} está em status "${run.status}". ` +
        `Apenas runs COMPLETED podem ser usados para Rostering.`,
      );
    }

    const resultSummary = run.resultSummary as any;
    const duties = resultSummary?.duties;

    if (!duties || !Array.isArray(duties) || duties.length === 0) {
      throw new Error(
        `Optimization run #${optimizationRunId} não contém duties no resultado.`,
      );
    }

    // 4. Montar payload para o Python (formato idêntico ao NominalRosteringRequest)
    const payload = {
      operators: operators.map((op) => ({
        id: String(op.id),
        name: op.name,
        cp: op.cp,
        last_shift_end: op.lastShiftEnd,
        metadata: op.metadata ?? {},
      })),
      duties: duties.map((d: any) => ({
        duty_id: d.duty_id ?? d.id,
        blocks: d.blocks ?? [],
        start_time: d.start_time ?? d.startTime,
        end_time: d.end_time ?? d.endTime,
        work_time: d.work_time ?? d.workTime ?? 0,
        spread_time: d.spread_time ?? d.spreadTime ?? 0,
        rest_violations: d.rest_violations ?? d.restViolations ?? 0,
        trips: (d.trips ?? []).map((t: any) => ({
          id: t.id ?? t.trip_id,
          line_id: t.line_id ?? t.lineId ?? 0,
          start_time: t.start_time ?? t.startTime ?? 0,
          end_time: t.end_time ?? t.endTime ?? 0,
          origin_id: t.origin_id ?? t.originId ?? 0,
          destination_id: t.destination_id ?? t.destinationId ?? 0,
        })),
      })),
      rules: rules.map((r) => ({
        rule_id: r.ruleId,
        type: r.type,
        weight: Number(r.weight),
        meta: r.meta ?? {},
      })),
      inter_shift_rest_minutes: interShiftRestMinutes,
    };

    this.logger.log(
      `Rostering payload: ${operators.length} operadores, ${duties.length} duties, ${rules.length} regras`,
    );

    // 5. Chamar o Python via Cliente Seguro
    try {
      const result = await this.optimizerClient.post<any>('/optimize/rostering/', payload);

      this.logger.log(
        `Rostering concluído: ${result?.assignments?.length ?? 0} atribuições, ` +
        `utility=${result?.total_utility ?? 0}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Falha no motor de Rostering: ${(error as any).message}`);
      throw error;
    }
  }
}
