import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('trip_time_bands')
export class TripTimeBandEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'config_id' })
  configId: number;

  @Column({ name: 'start_minutes' })
  startMinutes: number;

  @Column({ name: 'end_minutes' })
  endMinutes: number;

  @Column({ name: 'trip_duration_outbound', nullable: true })
  tripDurationOutbound: number;

  @Column({ name: 'trip_duration_return', nullable: true })
  tripDurationReturn: number;

  @Column({ name: 'idle_minutes_outbound', default: 0 })
  idleMinutesOutbound: number;

  @Column({ name: 'idle_minutes_return', default: 0 })
  idleMinutesReturn: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
