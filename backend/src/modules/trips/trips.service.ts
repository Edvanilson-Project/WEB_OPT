import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripEntity } from './entities/trip.entity';
import { CreateTripDto } from './dto/create-trip.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(TripEntity)
    private readonly tripRepo: Repository<TripEntity>,
  ) {}

  async create(dto: CreateTripDto): Promise<TripEntity> {
    const endTime = dto.startTimeMinutes + dto.durationMinutes;
    const trip = this.tripRepo.create({ ...dto, endTimeMinutes: endTime });
    return this.tripRepo.save(trip);
  }

  async createBulk(dtos: CreateTripDto[]): Promise<TripEntity[]> {
    const trips = dtos.map((dto) =>
      this.tripRepo.create({
        ...dto,
        endTimeMinutes: dto.startTimeMinutes + dto.durationMinutes,
      }),
    );
    return this.tripRepo.save(trips);
  }

  async findAll(companyId?: number, lineId?: number): Promise<TripEntity[]> {
    if (!companyId) throw new BadRequestException('companyId é obrigatório');
    const where: any = { companyId, isActive: true };
    if (lineId) where.lineId = lineId;
    return this.tripRepo.find({
      where,
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findBySchedule(scheduleId: number): Promise<TripEntity[]> {
    return this.tripRepo.find({
      where: { scheduleId, isActive: true },
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findOne(id: number, companyId?: number): Promise<TripEntity> {
    const where: Record<string, number> =
      companyId != null ? { id, companyId } : { id };
    const trip = await this.tripRepo.findOne({ where });
    if (!trip) throw new EntityNotFoundException('Viagem', id);
    return trip;
  }

  async update(
    id: number,
    dto: Partial<CreateTripDto>,
    companyId?: number,
  ): Promise<TripEntity> {
    const trip = await this.findOne(id, companyId);
    Object.assign(trip, dto);
    if (
      dto.startTimeMinutes !== undefined ||
      dto.durationMinutes !== undefined
    ) {
      trip.endTimeMinutes = trip.startTimeMinutes + trip.durationMinutes;
    }
    return this.tripRepo.save(trip);
  }

  async remove(id: number, companyId?: number): Promise<void> {
    const trip = await this.findOne(id, companyId);
    trip.isActive = false;
    await this.tripRepo.save(trip);
  }
}
