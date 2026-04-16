import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './trips.service';
import { TripsImportService } from './trips-import.service';
import { TripsController } from './trips.controller';
import { TripEntity } from './entities/trip.entity';
import { TripsRepository } from './repositories/trips.repository';
import { LinesModule } from '../lines/lines.module';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity]), LinesModule],
  controllers: [TripsController],
  providers: [TripsService, TripsImportService, TripsRepository],
  exports: [TripsService, TripsImportService, TripsRepository],
})
export class TripsModule {}
