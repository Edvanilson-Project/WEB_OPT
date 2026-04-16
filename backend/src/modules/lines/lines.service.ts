import { Injectable, ConflictException } from '@nestjs/common';
import { LinesRepository } from './repositories/lines.repository';
import { LineEntity } from './entities/line.entity';
import { CreateLineDto } from './dto/create-line.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class LinesService {
  constructor(
    private readonly linesRepo: LinesRepository,
  ) {}

  async create(dto: CreateLineDto): Promise<LineEntity> {
    const exists = await this.linesRepo.findOne({ where: { code: dto.code } as any });
    if (exists)
      throw new ConflictException(`Código de linha '${dto.code}' já existe.`);
    return this.linesRepo.create(dto);
  }

  async findAll(): Promise<LineEntity[]> {
    return this.linesRepo.findAll({ order: { code: 'ASC' } as any });
  }

  async findOne(id: number): Promise<LineEntity> {
    const line = await this.linesRepo.findOne({ where: { id } as any });
    if (!line) throw new EntityNotFoundException('Linha', id);
    return line;
  }

  async update(id: number, dto: Partial<CreateLineDto>): Promise<LineEntity> {
    const line = await this.findOne(id);
    Object.assign(line, dto);
    return this.linesRepo.save(line);
  }

  async remove(id: number): Promise<void> {
    const line = await this.findOne(id); // Valida se pertence à empresa
    await this.linesRepo.delete(id);
  }
}
