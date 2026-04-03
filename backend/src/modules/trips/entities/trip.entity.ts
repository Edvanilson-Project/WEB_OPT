import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

export enum TripDirection {
  OUTBOUND = 'outbound',
  RETURN = 'return',
}

@Entity('trips')
export class TripEntity extends BaseCompanyEntity {
  @Column({ name: 'trip_code', length: 50, nullable: true })
  tripCode: string;

  @Column({ name: 'line_id' })
  lineId: number;

  @Column({ name: 'schedule_id', nullable: true })
  scheduleId: number;

  @Column({
    name: 'direction',
    type: 'enum',
    enum: TripDirection,
    default: TripDirection.OUTBOUND,
  })
  direction: TripDirection;

  @Column({ name: 'start_time_minutes' })
  startTimeMinutes: number;

  @Column({ name: 'end_time_minutes' })
  endTimeMinutes: number;

  @Column({ name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ name: 'origin_terminal_id', nullable: true })
  originTerminalId: number;

  @Column({ name: 'destination_terminal_id', nullable: true })
  destinationTerminalId: number;

  @Column({ name: 'passenger_count', default: 0 })
  passengerCount: number;

  @Column({ name: 'vehicle_type_id', nullable: true })
  vehicleTypeId: number;

  @Column({ name: 'trip_group_id', nullable: true })
  tripGroupId: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
