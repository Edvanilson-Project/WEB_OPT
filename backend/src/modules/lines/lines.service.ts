import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LineEntity } from './entities/line.entity';
import { CreateLineDto } from './dto/create-line.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class LinesService {
  constructor(
    @InjectRepository(LineEntity)
    private readonly lineRepo: Repository<LineEntity>,
  ) {}

  async create(dto: CreateLineDto): Promise<LineEntity> {
    const exists = await this.lineRepo.findOne({ where: { code: dto.code } });
    if (exists)
      throw new ConflictException(`Código de linha '${dto.code}' já existe.`);
    const line = this.lineRepo.create(dto);
    return this.lineRepo.save(line);
  }

  async findAll(companyId?: number): Promise<LineEntity[]> {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return this.lineRepo.find({ where, order: { code: 'ASC' } });
  }

  async findOne(id: number): Promise<LineEntity> {
    const line = await this.lineRepo.findOne({ where: { id } });
    if (!line) throw new EntityNotFoundException('Linha', id);
    return line;
  }

  async update(id: number, dto: Partial<CreateLineDto>): Promise<LineEntity> {
    const line = await this.findOne(id);
    Object.assign(line, dto);
    return this.lineRepo.save(line);
  }

  async remove(id: number): Promise<void> {
    const line = await this.findOne(id);
    await this.lineRepo.remove(line);
  }
}
