import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('schedule_group_items')
export class ScheduleGroupItemEntity extends BaseEntity {
  @Index()
  @Column({ name: 'schedule_group_id' })
  scheduleGroupId: number;

  @Column({ name: 'schedule_id' })
  scheduleId: number;
}
