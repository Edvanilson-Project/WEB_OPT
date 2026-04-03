import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

@Entity('vehicle_types')
export class VehicleTypeEntity extends BaseCompanyEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, nullable: true })
  code: string;

  @Column({ name: 'passenger_capacity' })
  passengerCapacity: number;

  @Column({
    name: 'cost_per_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  costPerKm: number;

  @Column({
    name: 'cost_per_hour',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  costPerHour: number;

  @Column({
    name: 'fixed_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  fixedCost: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
}
