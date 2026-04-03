import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

export enum VehicleRouteStatus {
  DRAFT = 'draft',
  OPTIMIZED = 'optimized',
  APPROVED = 'approved',
}

@Entity('vehicle_routes')
export class VehicleRouteEntity extends BaseCompanyEntity {
  @Column({ name: 'optimization_run_id' })
  optimizationRunId: number;

  @Column({ name: 'vehicle_number', length: 50 })
  vehicleNumber: string;

  @Column({ name: 'vehicle_type_id', nullable: true })
  vehicleTypeId: number;

  @Column({ name: 'line_id' })
  lineId: number;

  @Column({ type: 'jsonb', name: 'trip_ids' })
  tripIds: number[];

  @Column({ name: 'total_trips' })
  totalTrips: number;

  @Column({ name: 'start_time_minutes' })
  startTimeMinutes: number;

  @Column({ name: 'end_time_minutes' })
  endTimeMinutes: number;

  @Column({ name: 'total_work_minutes' })
  totalWorkMinutes: number;

  @Column({
    name: 'estimated_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  estimatedCost: number;

  @Column({
    type: 'enum',
    enum: VehicleRouteStatus,
    default: VehicleRouteStatus.DRAFT,
  })
  status: VehicleRouteStatus;
}
