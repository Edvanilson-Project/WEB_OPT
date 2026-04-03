import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OptimizationService } from './optimization.service';
import { OptimizationController } from './optimization.controller';
import { OptimizationRunEntity } from './entities/optimization-run.entity';
import { TripsModule } from '../trips/trips.module';
import { OptimizationSettingsModule } from '../optimization-settings/optimization-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OptimizationRunEntity]),
    TripsModule,
    OptimizationSettingsModule,
  ],
  controllers: [OptimizationController],
  providers: [OptimizationService],
  exports: [OptimizationService],
})
export class OptimizationModule {}
