import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

@Entity('time_bands')
export class TimeBandEntity extends BaseCompanyEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ name: 'start_minutes' })
  startMinutes: number;

  @Column({ name: 'end_minutes' })
  endMinutes: number;

  @Column({ name: 'is_peak', default: false })
  isPeak: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;
}
