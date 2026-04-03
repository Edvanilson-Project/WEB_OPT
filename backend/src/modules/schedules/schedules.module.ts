import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleEntity } from './entities/schedule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleEntity])],
  exports: [TypeOrmModule],
})
export class SchedulesModule {}
