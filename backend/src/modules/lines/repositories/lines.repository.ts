import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LineEntity } from '../entities/line.entity';
import { BaseRepository } from '../../../common/repositories/base.repository';

/**
 * Repositório de Linhas (Padrão Repository: Abstrai a persistência e isola o TypeORM do domínio).
 * Estende BaseRepository para garantir isolamento Multi-Tenant rigoroso.
 */
@Injectable()
export class LinesRepository extends BaseRepository<LineEntity> {
  constructor(
    @InjectRepository(LineEntity)
    private readonly lineRepo: Repository<LineEntity>,
  ) {
    super(lineRepo);
  }

  /**
   * Busca uma linha pelo código dentro do contexto da empresa.
   * @param code Código da linha
   */
  async findByCode(code: string): Promise<LineEntity | null> {
    return this.findOne({ where: { code } as any });
  }

  /**
   * Busca uma linha pelo nome (parcialmente ou exato) dentro do contexto da empresa.
   * @param name Nome da linha
   */
  async findByName(name: string): Promise<LineEntity | null> {
    return this.findOne({ where: { name } as any });
  }
}
