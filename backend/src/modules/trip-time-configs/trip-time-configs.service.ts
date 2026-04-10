import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripTimeConfigEntity } from './entities/trip-time-config.entity';
import { TripTimeBandEntity } from './entities/trip-time-band.entity';
import {
  CreateTripTimeConfigDto,
  SaveTripTimeBandDto,
} from './dto/create-trip-time-config.dto';

@Injectable()
export class TripTimeConfigsService {
  constructor(
    @InjectRepository(TripTimeConfigEntity)
    private readonly configRepo: Repository<TripTimeConfigEntity>,
    @InjectRepository(TripTimeBandEntity)
    private readonly bandRepo: Repository<TripTimeBandEntity>,
  ) {}

  async create(dto: CreateTripTimeConfigDto) {
    const config = this.configRepo.create(dto);
    const saved = await this.configRepo.save(config);

    // Auto-gerar faixas usando horários configurados
    const startMin = dto.startHourMinutes ?? 240;
    const endMin = dto.endHourMinutes ?? 1440;
    const bands: Partial<TripTimeBandEntity>[] = [];
    for (let s = startMin; s < endMin; s += dto.bandIntervalMinutes) {
      bands.push({
        configId: saved.id,
        startMinutes: s,
        endMinutes: Math.min(s + dto.bandIntervalMinutes, endMin),
        tripDurationOutbound: null,
        tripDurationReturn: null,
        idleMinutesOutbound: 0,
        idleMinutesReturn: 0,
      });
    }
    await this.bandRepo.save(bands);

    return { ...saved, bands };
  }

  async findAll(companyId?: number) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return this.configRepo.find({ where, order: { id: 'DESC' } });
  }

  async findOne(id: number) {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException('Config não encontrada');
    const bands = await this.bandRepo.find({
      where: { configId: id },
      order: { startMinutes: 'ASC' },
    });
    return { ...config, bands };
  }

  async getBands(configId: number) {
    return this.bandRepo.find({
      where: { configId },
      order: { startMinutes: 'ASC' },
    });
  }

  async saveBands(configId: number, dtos: SaveTripTimeBandDto[]) {
    // Remove existing bands and save new ones
    await this.bandRepo.delete({ configId });
    const bands = dtos.map((dto) => this.bandRepo.create({ configId, ...dto }));
    return this.bandRepo.save(bands);
  }

  async update(id: number, dto: Partial<CreateTripTimeConfigDto>) {
    await this.configRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    return this.configRepo.manager.transaction(async (em) => {
      await em.delete(this.bandRepo.target, { configId: id });
      return em.delete(this.configRepo.target, id);
    });
  }
}
