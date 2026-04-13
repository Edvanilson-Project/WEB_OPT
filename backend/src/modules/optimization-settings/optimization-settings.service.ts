import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptimizationSettingsEntity } from './entities/optimization-settings.entity';
import { CreateOptimizationSettingsDto } from './dto/create-optimization-settings.dto';
import { UpdateOptimizationSettingsDto } from './dto/update-optimization-settings.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class OptimizationSettingsService {
  constructor(
    @InjectRepository(OptimizationSettingsEntity)
    private readonly repo: Repository<OptimizationSettingsEntity>,
  ) {}

  async findAll(companyId: number): Promise<OptimizationSettingsEntity[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(
    id: number,
    companyId: number,
  ): Promise<OptimizationSettingsEntity> {
    const entity = await this.repo.findOne({ where: { id, companyId } });
    if (!entity)
      throw new NotFoundException(`Configuração #${id} não encontrada`);
    return entity;
  }

  async findActive(
    companyId: number,
  ): Promise<OptimizationSettingsEntity | null> {
    return this.repo.findOne({ where: { companyId, isActive: true } });
  }

  async create(
    companyId: number,
    dto: CreateOptimizationSettingsDto,
    userRole?: string,
  ): Promise<OptimizationSettingsEntity> {
    const isAdmin =
      userRole === UserRole.SUPER_ADMIN || userRole === UserRole.COMPANY_ADMIN;
    if (!isAdmin && dto.maxTimeoutMultiplier !== undefined) {
      delete dto.maxTimeoutMultiplier;
    }
    return this.repo.manager.transaction(async (em) => {
      if ((dto as any).isActive !== false) {
        await em.update(
          OptimizationSettingsEntity,
          { companyId },
          { isActive: false },
        );
      }
      const entity = em.create(OptimizationSettingsEntity, {
        ...dto,
        companyId,
        isActive: (dto as any).isActive ?? true,
      });
      return em.save(entity);
    });
  }

  async update(
    id: number,
    companyId: number,
    dto: UpdateOptimizationSettingsDto,
    userRole?: string,
  ): Promise<OptimizationSettingsEntity> {
    const isAdmin =
      userRole === UserRole.SUPER_ADMIN || userRole === UserRole.COMPANY_ADMIN;
    if (!isAdmin && dto.maxTimeoutMultiplier !== undefined) {
      delete dto.maxTimeoutMultiplier;
    }
    return this.repo.manager.transaction(async (em) => {
      const entity = await em.findOne(OptimizationSettingsEntity, {
        where: { id, companyId },
      });
      if (!entity)
        throw new NotFoundException(`Configuração #${id} não encontrada`);
      if ((dto as any).isActive === true) {
        await em.update(
          OptimizationSettingsEntity,
          { companyId },
          { isActive: false },
        );
      }
      Object.assign(entity, dto);
      return em.save(entity);
    });
  }

  async setActive(
    id: number,
    companyId: number,
  ): Promise<OptimizationSettingsEntity> {
    return this.repo.manager.transaction(async (em) => {
      await em.update(
        OptimizationSettingsEntity,
        { companyId },
        { isActive: false },
      );
      const entity = await em.findOne(OptimizationSettingsEntity, {
        where: { id, companyId },
      });
      if (!entity)
        throw new NotFoundException(`Configuração #${id} não encontrada`);
      entity.isActive = true;
      return em.save(entity);
    });
  }

  async remove(id: number, companyId: number): Promise<void> {
    const entity = await this.findOne(id, companyId);
    await this.repo.remove(entity);
  }
}
