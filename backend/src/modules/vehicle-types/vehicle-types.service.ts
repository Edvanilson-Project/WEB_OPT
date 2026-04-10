import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleTypeEntity } from './entities/vehicle-type.entity';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class VehicleTypesService {
  constructor(
    @InjectRepository(VehicleTypeEntity)
    private readonly repo: Repository<VehicleTypeEntity>,
  ) {}

  async create(dto: CreateVehicleTypeDto): Promise<VehicleTypeEntity> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(companyId?: number): Promise<VehicleTypeEntity[]> {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<VehicleTypeEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new EntityNotFoundException('Tipo de veículo', id);
    return entity;
  }

  async update(
    id: number,
    dto: Partial<CreateVehicleTypeDto>,
  ): Promise<VehicleTypeEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
