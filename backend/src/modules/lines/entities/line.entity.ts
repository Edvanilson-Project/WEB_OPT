import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

export enum LineStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNDER_REVIEW = 'under_review',
}

@Entity('lines')
export class LineEntity extends BaseCompanyEntity {
  @Column({ unique: true, length: 20 })
  code: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'origin_terminal_id' })
  originTerminalId: number;

  @Column({ name: 'destination_terminal_id' })
  destinationTerminalId: number;

  @Column({
    name: 'distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  distanceKm: number;

  @Column({ name: 'avg_trip_duration_minutes', nullable: true })
  avgTripDurationMinutes: number;

  @Column({
    type: 'enum',
    enum: LineStatus,
    default: LineStatus.ACTIVE,
  })
  status: LineStatus;

  @Column({ nullable: true, length: 7, name: 'color_hex' })
  colorHex: string;
}
