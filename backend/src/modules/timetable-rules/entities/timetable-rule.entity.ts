import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('timetable_rules')
export class TimetableRuleEntity extends BaseEntity {
  @Index()
  @Column({ name: 'schedule_id' })
  scheduleId: number;

  @Column({ name: 'time_band_id' })
  timeBandId: number;

  @Column({ name: 'headway_minutes' })
  headwayMinutes: number;

  @Column({ name: 'vehicle_count', nullable: true })
  vehicleCount: number;

  @Column({ nullable: true, length: 500 })
  notes: string;
}
