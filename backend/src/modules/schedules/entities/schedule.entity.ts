import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

export enum ScheduleType {
  WEEKDAY = 'weekday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
  HOLIDAY = 'holiday',
}

export enum ScheduleStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('schedules')
export class ScheduleEntity extends BaseCompanyEntity {
  @Column({ length: 200 })
  name: string;

  @Column({ name: 'line_id' })
  lineId: number;

  @Column({
    type: 'enum',
    enum: ScheduleType,
    default: ScheduleType.WEEKDAY,
  })
  type: ScheduleType;

  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.DRAFT,
  })
  status: ScheduleStatus;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: Date;

  @Column({ nullable: true, length: 1000 })
  description: string;
}
