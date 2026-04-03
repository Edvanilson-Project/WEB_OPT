import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TerminalEntity } from './entities/terminal.entity';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class TerminalsService {
  constructor(
    @InjectRepository(TerminalEntity)
    private readonly terminalRepo: Repository<TerminalEntity>,
  ) {}

  async create(dto: CreateTerminalDto): Promise<TerminalEntity> {
    const terminal = this.terminalRepo.create(dto);
    return this.terminalRepo.save(terminal);
  }

  async findAll(companyId?: number): Promise<TerminalEntity[]> {
    const where: any = { isActive: true };
    if (companyId) where.companyId = companyId;
    return this.terminalRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<TerminalEntity> {
    const terminal = await this.terminalRepo.findOne({ where: { id } });
    if (!terminal) throw new EntityNotFoundException('Terminal', id);
    return terminal;
  }

  async update(
    id: number,
    dto: Partial<CreateTerminalDto>,
  ): Promise<TerminalEntity> {
    const terminal = await this.findOne(id);
    Object.assign(terminal, dto);
    return this.terminalRepo.save(terminal);
  }

  async remove(id: number): Promise<void> {
    const terminal = await this.findOne(id);
    terminal.isActive = false;
    await this.terminalRepo.save(terminal);
  }
}
