import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrewShiftEntity } from './entities/crew-shift.entity';
import { CreateCrewShiftDto } from './dto/create-crew-shift.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class CrewShiftsService {
  constructor(
    @InjectRepository(CrewShiftEntity)
    private readonly crewShiftRepo: Repository<CrewShiftEntity>,
  ) {}

  async create(dto: CreateCrewShiftDto): Promise<CrewShiftEntity> {
    const crewShift = this.crewShiftRepo.create(dto);
    return this.crewShiftRepo.save(crewShift);
  }

  async createBulk(dtos: CreateCrewShiftDto[]): Promise<CrewShiftEntity[]> {
    const crewShifts = dtos.map((dto) => this.crewShiftRepo.create(dto));
    return this.crewShiftRepo.save(crewShifts);
  }

  async findAll(
    companyId?: number,
    optimizationRunId?: number,
    lineId?: number,
    status?: string,
  ): Promise<CrewShiftEntity[]> {
    if (!companyId) throw new BadRequestException('companyId é obrigatório');

    const where: any = { companyId };
    if (optimizationRunId) where.optimizationRunId = optimizationRunId;
    if (lineId) where.lineId = lineId;
    if (status) where.status = status;

    return this.crewShiftRepo.find({
      where,
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findByOptimizationRun(
    optimizationRunId: number,
  ): Promise<CrewShiftEntity[]> {
    return this.crewShiftRepo.find({
      where: { optimizationRunId },
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findOne(id: number, companyId?: number): Promise<CrewShiftEntity> {
    const where: Record<string, number> =
      companyId != null ? { id, companyId } : { id };
    const crewShift = await this.crewShiftRepo.findOne({ where });
    if (!crewShift)
      throw new EntityNotFoundException('Turno de tripulação', id);
    return crewShift;
  }

  async update(
    id: number,
    dto: Partial<CreateCrewShiftDto>,
    companyId?: number,
  ): Promise<CrewShiftEntity> {
    const crewShift = await this.findOne(id, companyId);
    Object.assign(crewShift, dto);
    return this.crewShiftRepo.save(crewShift);
  }

  async remove(id: number, companyId?: number): Promise<void> {
    const crewShift = await this.findOne(id, companyId);
    await this.crewShiftRepo.remove(crewShift);
  }

  async updateStatus(
    id: number,
    status: string,
    companyId?: number,
  ): Promise<CrewShiftEntity> {
    const crewShift = await this.findOne(id, companyId);
    crewShift.status = status as any;
    return this.crewShiftRepo.save(crewShift);
  }

  async findByVehicleRoute(vehicleRouteId: number): Promise<CrewShiftEntity[]> {
    return this.crewShiftRepo.find({
      where: { vehicleRouteId },
      order: { startTimeMinutes: 'ASC' },
    });
  }
}
