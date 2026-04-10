import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeBandEntity } from './entities/time-band.entity';
import { CreateTimeBandDto } from './dto/create-time-band.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class TimeBandsService {
  constructor(
    @InjectRepository(TimeBandEntity)
    private readonly repo: Repository<TimeBandEntity>,
  ) {}

  async create(dto: CreateTimeBandDto): Promise<TimeBandEntity> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(companyId?: number): Promise<TimeBandEntity[]> {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return this.repo.find({ where, order: { displayOrder: 'ASC' } });
  }

  async findOne(id: number): Promise<TimeBandEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new EntityNotFoundException('TimeBand', id);
    return entity;
  }

  async update(
    id: number,
    dto: Partial<CreateTimeBandDto>,
  ): Promise<TimeBandEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
