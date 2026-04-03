import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { OptimizationRunEntity } from '../optimization/entities/optimization-run.entity';
import { TripEntity } from '../trips/entities/trip.entity';
import { LineEntity } from '../lines/entities/line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OptimizationRunEntity,
      TripEntity,
      LineEntity,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
