import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleEntity } from './entities/schedule.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(ScheduleEntity)
    private readonly repo: Repository<ScheduleEntity>,
  ) {}

  async create(dto: CreateScheduleDto): Promise<ScheduleEntity> {
    const entity = this.repo.create(dto as any);
    return this.repo.save(entity as any) as Promise<ScheduleEntity>;
  }

  async findAll(
    companyId?: number,
    lineId?: number,
  ): Promise<ScheduleEntity[]> {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (lineId) where.lineId = lineId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<ScheduleEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new EntityNotFoundException('Schedule', id);
    return entity;
  }

  async update(
    id: number,
    dto: Partial<CreateScheduleDto>,
  ): Promise<ScheduleEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
