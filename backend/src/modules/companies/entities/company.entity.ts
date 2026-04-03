import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum CompanyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
}

@Entity('companies')
export class CompanyEntity extends BaseEntity {
  @Column({ length: 200 })
  name: string;

  @Column({ unique: true, length: 18 })
  cnpj: string;

  @Column({ name: 'trade_name', nullable: true, length: 200 })
  tradeName: string;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.ACTIVE })
  status: CompanyStatus;

  @Column({ nullable: true, length: 500 })
  address: string;

  @Column({ nullable: true, length: 100 })
  city: string;

  @Column({ nullable: true, length: 2 })
  state: string;

  @Column({ name: 'phone', nullable: true, length: 20 })
  phone: string;

  @Column({ name: 'logo_url', nullable: true, length: 500 })
  logoUrl: string;

  @Column({ name: 'fleet_size', nullable: true })
  fleetSize: number;

  @Column({ name: 'daily_trips', nullable: true })
  dailyTrips: number;
}
