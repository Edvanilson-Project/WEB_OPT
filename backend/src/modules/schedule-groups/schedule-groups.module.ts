import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleGroupEntity } from './entities/schedule-group.entity';
import { ScheduleGroupItemEntity } from './entities/schedule-group-item.entity';
import { ScheduleGroupsService } from './schedule-groups.service';
import { ScheduleGroupsController } from './schedule-groups.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduleGroupEntity, ScheduleGroupItemEntity]),
  ],
  controllers: [ScheduleGroupsController],
  providers: [ScheduleGroupsService],
  exports: [ScheduleGroupsService],
})
export class ScheduleGroupsModule {}
