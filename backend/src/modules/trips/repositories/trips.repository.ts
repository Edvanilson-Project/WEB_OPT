import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripEntity } from '../entities/trip.entity';
import { BaseRepository } from '../../../common/repositories/base.repository';

/**
 * Repositório de Viagens (Padrão Repository: Abstrai a persistência e isola o TypeORM do domínio).
 * Agora estende BaseRepository para garantir isolamento Multi-Tenant.
 */
@Injectable()
export class TripsRepository extends BaseRepository<TripEntity> {
  constructor(
    @InjectRepository(TripEntity)
    private readonly tripRepo: Repository<TripEntity>,
  ) {
    super(tripRepo);
  }
}
