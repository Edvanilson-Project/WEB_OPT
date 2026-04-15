import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { OperatorEntity } from './entities/operator.entity';
import { RosteringRuleEntity } from './entities/rostering-rule.entity';
import { OptimizationRunEntity } from '../optimization/entities/optimization-run.entity';
import { RosteringService } from './rostering.service';
import { RosteringIntegrationService } from './rostering-integration.service';
import { RosteringController } from './rostering.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OperatorEntity,
      RosteringRuleEntity,
      OptimizationRunEntity,
    ]),
    HttpModule,
  ],
  controllers: [RosteringController],
  providers: [RosteringService, RosteringIntegrationService],
  exports: [RosteringService, RosteringIntegrationService],
})
export class RosteringModule {}
