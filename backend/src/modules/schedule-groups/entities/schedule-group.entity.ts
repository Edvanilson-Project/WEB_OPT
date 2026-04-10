import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

@Entity('schedule_groups')
export class ScheduleGroupEntity extends BaseCompanyEntity {
  @Column({ length: 200 })
  name: string;

  @Column({ nullable: true, length: 1000 })
  description: string;

  @Column({ default: 'draft' })
  status: string; // 'draft' | 'ready' | 'optimized'
}
