import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperatorEntity } from '../entities/operator.entity';
import { BaseRepository } from '../../../common/repositories/base.repository';

/**
 * Repositório de Operadores (Padrão Repository: Abstrai a persistência e isola o TypeORM do domínio).
 * Estende BaseRepository para garantir isolamento Multi-Tenant.
 */
@Injectable()
export class OperatorsRepository extends BaseRepository<OperatorEntity> {
  constructor(
    @InjectRepository(OperatorEntity)
    private readonly operatorRepo: Repository<OperatorEntity>,
  ) {
    super(operatorRepo);
  }
}
