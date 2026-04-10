import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LineTripProfileEntity } from './entities/line-trip-profile.entity';
import { CreateLineTripProfileDto } from './dto/create-line-trip-profile.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class LineTripProfilesService {
  constructor(
    @InjectRepository(LineTripProfileEntity)
    private readonly repo: Repository<LineTripProfileEntity>,
  ) {}

  async create(dto: CreateLineTripProfileDto): Promise<LineTripProfileEntity> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async createBulk(
    dtos: CreateLineTripProfileDto[],
  ): Promise<LineTripProfileEntity[]> {
    const entities = this.repo.create(dtos);
    return this.repo.save(entities);
  }

  async findByLine(lineId: number): Promise<LineTripProfileEntity[]> {
    return this.repo.find({
      where: { lineId },
      order: { direction: 'ASC', timeBandId: 'ASC' },
    });
  }

  async findOne(id: number): Promise<LineTripProfileEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new EntityNotFoundException('LineTripProfile', id);
    return entity;
  }

  async update(
    id: number,
    dto: Partial<CreateLineTripProfileDto>,
  ): Promise<LineTripProfileEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async removeByLine(lineId: number): Promise<void> {
    await this.repo.delete({ lineId });
  }
}
