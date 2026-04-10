import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

export enum LineStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNDER_REVIEW = 'under_review',
}

export enum LineOperationMode {
  ROUNDTRIP = 'roundtrip',
  OUTBOUND_ONLY = 'outbound_only',
  RETURN_ONLY = 'return_only',
  FLEXIBLE = 'flexible',
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

  @Column({ name: 'pullout_terminal_id', nullable: true })
  pulloutTerminalId: number;

  @Column({ name: 'pullout_duration_minutes', default: 10 })
  pulloutDurationMinutes: number;

  @Column({ name: 'pullback_duration_minutes', default: 10 })
  pullbackDurationMinutes: number;

  @Column({
    name: 'return_distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  returnDistanceKm: number;

  @Column({ name: 'return_trip_duration_minutes', nullable: true })
  returnTripDurationMinutes: number;

  @Column({ name: 'idle_terminal_id', nullable: true })
  idleTerminalId: number;

  @Column({
    name: 'idle_distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  idleDistanceKm: number;

  @Column({
    name: 'idle_return_distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  idleReturnDistanceKm: number;

  @Column({ name: 'garage_terminal_id', nullable: true })
  garageTerminalId: number;

  @Column({
    name: 'garage_distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  garageDistanceKm: number;

  @Column({ name: 'vehicle_type_id', nullable: true })
  vehicleTypeId: number;

  @Column({
    name: 'operation_mode',
    type: 'enum',
    enum: LineOperationMode,
    default: LineOperationMode.ROUNDTRIP,
  })
  operationMode: LineOperationMode;
}
