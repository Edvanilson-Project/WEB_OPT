import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('passenger_configs')
export class PassengerConfigEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'line_id' })
  lineId: number;

  @Column({ length: 200 })
  description: string;

  @Column({ name: 'band_interval_minutes', default: 60 })
  bandIntervalMinutes: number;

  @Column({ name: 'start_hour_minutes', default: 240 })
  startHourMinutes: number;

  @Column({ name: 'end_hour_minutes', default: 1440 })
  endHourMinutes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
