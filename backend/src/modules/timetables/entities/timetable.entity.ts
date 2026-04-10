import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('timetables')
export class TimetableEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'line_id' })
  lineId: number;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'trip_time_config_id', nullable: true })
  tripTimeConfigId: number;

  @Column({ name: 'passenger_config_id', nullable: true })
  passengerConfigId: number;

  @Column({ name: 'vehicle_type_id', nullable: true })
  vehicleTypeId: number;

  @Column({ name: 'validity_start', type: 'date', nullable: true })
  validityStart: string;

  @Column({ name: 'validity_end', type: 'date', nullable: true })
  validityEnd: string;

  @Column({ length: 20, default: 'draft' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
