import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptimizationSettingsEntity } from './entities/optimization-settings.entity';
import { CreateOptimizationSettingsDto } from './dto/create-optimization-settings.dto';
import { UpdateOptimizationSettingsDto } from './dto/update-optimization-settings.dto';

@Injectable()
export class OptimizationSettingsService {
  constructor(
    @InjectRepository(OptimizationSettingsEntity)
    private readonly repo: Repository<OptimizationSettingsEntity>,
  ) {}

  async findAll(companyId: number): Promise<OptimizationSettingsEntity[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(id: number, companyId: number): Promise<OptimizationSettingsEntity> {
    const entity = await this.repo.findOne({ where: { id, companyId } });
    if (!entity) throw new NotFoundException(`Configuração #${id} não encontrada`);
    return entity;
  }

  async findActive(companyId: number): Promise<OptimizationSettingsEntity | null> {
    return this.repo.findOne({ where: { companyId, isActive: true } });
  }

  async create(companyId: number, dto: CreateOptimizationSettingsDto): Promise<OptimizationSettingsEntity> {
    // Se a nova configuração deve ser ativada imediatamente, desativa as demais
    if ((dto as any).isActive !== false) {
      await this.repo.update({ companyId }, { isActive: false });
    }
    const entity = this.repo.create({ ...dto, companyId, isActive: (dto as any).isActive ?? true });
    return this.repo.save(entity);
  }

  async update(id: number, companyId: number, dto: UpdateOptimizationSettingsDto): Promise<OptimizationSettingsEntity> {
    const entity = await this.findOne(id, companyId);
    if ((dto as any).isActive === true) {
      await this.repo.update({ companyId }, { isActive: false });
    }
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async setActive(id: number, companyId: number): Promise<OptimizationSettingsEntity> {
    // Desativar todas as configurações da empresa
    await this.repo.update({ companyId }, { isActive: false });
    // Ativar a configuração selecionada
    const entity = await this.findOne(id, companyId);
    entity.isActive = true;
    return this.repo.save(entity);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const entity = await this.findOne(id, companyId);
    await this.repo.remove(entity);
  }
}
