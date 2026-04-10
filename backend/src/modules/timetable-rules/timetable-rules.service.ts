import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimetableRuleEntity } from './entities/timetable-rule.entity';
import { CreateTimetableRuleDto } from './dto/create-timetable-rule.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class TimetableRulesService {
  constructor(
    @InjectRepository(TimetableRuleEntity)
    private readonly repo: Repository<TimetableRuleEntity>,
  ) {}

  async create(dto: CreateTimetableRuleDto): Promise<TimetableRuleEntity> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async createBulk(
    dtos: CreateTimetableRuleDto[],
  ): Promise<TimetableRuleEntity[]> {
    const entities = this.repo.create(dtos);
    return this.repo.save(entities);
  }

  async findBySchedule(scheduleId: number): Promise<TimetableRuleEntity[]> {
    return this.repo.find({
      where: { scheduleId },
      order: { timeBandId: 'ASC' },
    });
  }

  async findOne(id: number): Promise<TimetableRuleEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new EntityNotFoundException('TimetableRule', id);
    return entity;
  }

  async update(
    id: number,
    dto: Partial<CreateTimetableRuleDto>,
  ): Promise<TimetableRuleEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
