import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('passenger_bands')
export class PassengerBandEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'config_id' })
  configId: number;

  @Column({ name: 'start_minutes' })
  startMinutes: number;

  @Column({ name: 'end_minutes' })
  endMinutes: number;

  @Column({ name: 'passengers_outbound', default: 0 })
  passengersOutbound: number;

  @Column({ name: 'passengers_return', default: 0 })
  passengersReturn: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
