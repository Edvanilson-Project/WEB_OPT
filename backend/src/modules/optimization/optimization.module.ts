import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { OptimizationService } from './optimization.service';
import { OptimizationController } from './optimization.controller';
import { OptimizationRunEntity } from './entities/optimization-run.entity';
import { TripsModule } from '../trips/trips.module';
import { OptimizationSettingsModule } from '../optimization-settings/optimization-settings.module';
import { LinesModule } from '../lines/lines.module';
import { TerminalsModule } from '../terminals/terminals.module';
import { VehicleTypesModule } from '../vehicle-types/vehicle-types.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OptimizationRunEntity]),
    HttpModule,
    TripsModule,
    OptimizationSettingsModule,
    LinesModule,
    TerminalsModule,
    VehicleTypesModule,
  ],
  controllers: [OptimizationController],
  providers: [OptimizationService],
  exports: [OptimizationService],
})
export class OptimizationModule implements OnModuleInit {
  private readonly logger = new Logger(OptimizationModule.name);

  constructor(private readonly optimizationService: OptimizationService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.optimizationService.recoverStaleRuns();
    } catch (err) {
      this.logger.error(
        `Falha ao recuperar runs presos: ${(err as Error).message}`,
      );
    }
  }
}
