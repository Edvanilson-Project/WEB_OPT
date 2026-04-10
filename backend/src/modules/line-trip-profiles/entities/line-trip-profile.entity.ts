import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('line_trip_profiles')
export class LineTripProfileEntity extends BaseEntity {
  @Column({ name: 'line_id' })
  lineId: number;

  @Column({ length: 10 })
  direction: string; // 'outbound' | 'return'

  @Column({ name: 'time_band_id' })
  timeBandId: number;

  @Column({ name: 'trip_duration_minutes' })
  tripDurationMinutes: number;

  @Column({
    name: 'distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  distanceKm: number;

  @Column({ name: 'passenger_demand', default: 0 })
  passengerDemand: number;
}
