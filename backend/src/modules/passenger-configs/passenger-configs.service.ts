import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PassengerConfigEntity } from './entities/passenger-config.entity';
import { PassengerBandEntity } from './entities/passenger-band.entity';
import {
  CreatePassengerConfigDto,
  SavePassengerBandDto,
} from './dto/create-passenger-config.dto';

@Injectable()
export class PassengerConfigsService {
  constructor(
    @InjectRepository(PassengerConfigEntity)
    private readonly configRepo: Repository<PassengerConfigEntity>,
    @InjectRepository(PassengerBandEntity)
    private readonly bandRepo: Repository<PassengerBandEntity>,
  ) {}

  async create(dto: CreatePassengerConfigDto) {
    const config = this.configRepo.create(dto);
    const saved = await this.configRepo.save(config);

    // Auto-gerar faixas usando horários configurados
    const startMin = dto.startHourMinutes ?? 240;
    const endMin = dto.endHourMinutes ?? 1440;
    const bands: Partial<PassengerBandEntity>[] = [];
    for (let s = startMin; s < endMin; s += dto.bandIntervalMinutes) {
      bands.push({
        configId: saved.id,
        startMinutes: s,
        endMinutes: Math.min(s + dto.bandIntervalMinutes, endMin),
        passengersOutbound: 0,
        passengersReturn: 0,
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

  async saveBands(configId: number, dtos: SavePassengerBandDto[]) {
    await this.bandRepo.delete({ configId });
    const bands = dtos.map((dto) => this.bandRepo.create({ configId, ...dto }));
    return this.bandRepo.save(bands);
  }

  async update(id: number, dto: Partial<CreatePassengerConfigDto>) {
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
