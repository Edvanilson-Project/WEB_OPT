import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OptimizationSettingsService } from './optimization-settings.service';
import { OptimizationSettingsController } from './optimization-settings.controller';
import { OptimizationSettingsEntity } from './entities/optimization-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OptimizationSettingsEntity])],
  controllers: [OptimizationSettingsController],
  providers: [OptimizationSettingsService],
  exports: [OptimizationSettingsService],
})
export class OptimizationSettingsModule {}
