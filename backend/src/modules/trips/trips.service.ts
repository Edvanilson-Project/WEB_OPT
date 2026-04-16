import { Injectable, BadRequestException } from '@nestjs/common';
import { TripsRepository } from './repositories/trips.repository';
import { TripEntity } from './entities/trip.entity';
import { CreateTripDto } from './dto/create-trip.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class TripsService {
  constructor(
    private readonly tripRepo: TripsRepository,
  ) {}

  async create(dto: CreateTripDto): Promise<TripEntity> {
    const endTime = dto.startTimeMinutes + dto.durationMinutes;
    // BaseRepository.create já faz o save e garante o companyId
    return this.tripRepo.create({ ...dto, endTimeMinutes: endTime } as any);
  }

  async createBulk(dtos: CreateTripDto[]): Promise<TripEntity[]> {
    // Como BaseRepository.create é async e já salva, fazemos em paralelo
    const promises = dtos.map((dto) =>
      this.tripRepo.create({
        ...dto,
        endTimeMinutes: dto.startTimeMinutes + dto.durationMinutes,
      } as any),
    );
    return Promise.all(promises);
  }

  async findAll(companyId?: number, lineId?: number): Promise<TripEntity[]> {
    if (!companyId) throw new BadRequestException('companyId é obrigatório');
    const where: any = { companyId, isActive: true };
    if (lineId) where.lineId = lineId;
    return this.tripRepo.findAll({
      where,
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findBySchedule(scheduleId: number): Promise<TripEntity[]> {
    return this.tripRepo.findAll({
      where: { scheduleId, isActive: true } as any,
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findOne(id: number, companyId?: number): Promise<TripEntity> {
    const where: Record<string, number> =
      companyId != null ? { id, companyId } : { id };
    const trip = await this.tripRepo.findOne({ where } as any);
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
      trip.endTimeMinutes = trip.startTimeMinutes + (trip.durationMinutes || 0);
    }
    return this.tripRepo.save(trip);
  }

  async remove(id: number, companyId?: number): Promise<void> {
    const trip = await this.findOne(id, companyId);
    await this.tripRepo.delete(trip.id);
  }
}
