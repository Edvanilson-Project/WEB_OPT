import { Entity, Column, Index } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

export enum ShiftStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PUBLISHED = 'published',
}

@Entity('crew_shifts')
export class CrewShiftEntity extends BaseCompanyEntity {
  @Index()
  @Column({ name: 'optimization_run_id' })
  optimizationRunId: number;

  @Index()
  @Column({ name: 'vehicle_route_id', nullable: true })
  vehicleRouteId: number;

  @Column({ name: 'operator_name', nullable: true, length: 150 })
  operatorName: string;

  @Column({ name: 'vehicle_number', length: 50 })
  vehicleNumber: string;

  @Column({ name: 'line_id' })
  lineId: number;

  @Column({ type: 'jsonb', name: 'trip_ids' })
  tripIds: number[];

  @Column({ name: 'start_time_minutes' })
  startTimeMinutes: number;

  @Column({ name: 'end_time_minutes' })
  endTimeMinutes: number;

  @Column({ name: 'work_duration_minutes' })
  workDurationMinutes: number;

  @Column({ name: 'break_duration_minutes', default: 0 })
  breakDurationMinutes: number;

  @Column({ name: 'total_trips' })
  totalTrips: number;

  @Column({ name: 'has_cct_violation', default: false })
  hasCctViolation: boolean;

  @Column({ type: 'jsonb', name: 'violations', nullable: true })
  violations: object[];

  @Column({
    type: 'enum',
    enum: ShiftStatus,
    default: ShiftStatus.DRAFT,
  })
  status: ShiftStatus;
}
