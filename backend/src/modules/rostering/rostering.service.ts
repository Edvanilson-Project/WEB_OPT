import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OperatorEntity } from './entities/operator.entity';
import { RosteringRuleEntity } from './entities/rostering-rule.entity';
import {
  CreateOperatorDto,
  UpdateOperatorDto,
  CreateRosteringRuleDto,
  UpdateRosteringRuleDto,
} from './dto/rostering.dto';

@Injectable()
export class RosteringService {
  private readonly logger = new Logger(RosteringService.name);

  constructor(
    @InjectRepository(OperatorEntity)
    private readonly operatorRepo: Repository<OperatorEntity>,
    @InjectRepository(RosteringRuleEntity)
    private readonly ruleRepo: Repository<RosteringRuleEntity>,
  ) {}

  // ─── OPERADORES ─────────────────────────────────────────────────────────

  async createOperator(dto: CreateOperatorDto): Promise<OperatorEntity> {
    const op = this.operatorRepo.create({
      registration: dto.registration,
      name: dto.name,
      cp: dto.cp,
      lastShiftEnd: dto.lastShiftEnd ?? 0,
      metadata: dto.metadata ?? {},
      companyId: dto.companyId,
    });
    return this.operatorRepo.save(op);
  }

  async findAllOperators(companyId: number): Promise<OperatorEntity[]> {
    return this.operatorRepo.find({
      where: { companyId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOperatorById(id: number, companyId?: number): Promise<OperatorEntity> {
    const where: any = { id };
    if (companyId) where.companyId = companyId;
    const op = await this.operatorRepo.findOne({ where });
    if (!op) throw new NotFoundException(`Operador #${id} não encontrado`);
    return op;
  }

  async updateOperator(id: number, dto: UpdateOperatorDto): Promise<OperatorEntity> {
    const op = await this.findOperatorById(id);
    Object.assign(op, dto);
    return this.operatorRepo.save(op);
  }

  async deleteOperator(id: number): Promise<void> {
    const op = await this.findOperatorById(id);
    op.isActive = false;
    await this.operatorRepo.save(op);
  }

  /**
   * Adiciona tags ao metadata de múltiplos operadores de uma vez.
   * Não sobrescreve tags existentes — faz merge.
   */
  async addTagsToOperators(
    operatorIds: number[],
    tags: Record<string, any>,
  ): Promise<{ updated: number }> {
    const operators = await this.operatorRepo.find({
      where: { id: In(operatorIds) },
    });

    for (const op of operators) {
      op.metadata = { ...op.metadata, ...tags };
    }

    await this.operatorRepo.save(operators);
    this.logger.log(
      `Tags ${JSON.stringify(tags)} adicionadas a ${operators.length} operadores`,
    );
    return { updated: operators.length };
  }

  /**
   * Remove tags específicas do metadata de múltiplos operadores.
   */
  async removeTagsFromOperators(
    operatorIds: number[],
    tagKeys: string[],
  ): Promise<{ updated: number }> {
    const operators = await this.operatorRepo.find({
      where: { id: In(operatorIds) },
    });

    for (const op of operators) {
      for (const key of tagKeys) {
        delete op.metadata[key];
      }
    }

    await this.operatorRepo.save(operators);
    this.logger.log(
      `Tags [${tagKeys.join(', ')}] removidas de ${operators.length} operadores`,
    );
    return { updated: operators.length };
  }

  // ─── REGRAS DE ROSTERING ────────────────────────────────────────────────

  async createRule(dto: CreateRosteringRuleDto): Promise<RosteringRuleEntity> {
    const rule = this.ruleRepo.create({
      ruleId: dto.ruleId,
      name: dto.name,
      description: dto.description,
      type: dto.type,
      weight: dto.weight,
      meta: dto.meta ?? {},
      companyId: dto.companyId,
    });
    return this.ruleRepo.save(rule);
  }

  async findAllRules(companyId: number): Promise<RosteringRuleEntity[]> {
    return this.ruleRepo.find({
      where: { companyId },
      order: { weight: 'DESC' },
    });
  }

  async findActiveRules(companyId: number): Promise<RosteringRuleEntity[]> {
    return this.ruleRepo.find({
      where: { companyId, isActive: true },
      order: { weight: 'DESC' },
    });
  }

  async findRuleById(id: number): Promise<RosteringRuleEntity> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Regra #${id} não encontrada`);
    return rule;
  }

  async updateRule(id: number, dto: UpdateRosteringRuleDto): Promise<RosteringRuleEntity> {
    const rule = await this.findRuleById(id);
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async deleteRule(id: number): Promise<void> {
    const rule = await this.findRuleById(id);
    rule.isActive = false;
    await this.ruleRepo.save(rule);
  }

  async toggleRule(id: number): Promise<RosteringRuleEntity> {
    const rule = await this.findRuleById(id);
    rule.isActive = !rule.isActive;
    return this.ruleRepo.save(rule);
  }
}
