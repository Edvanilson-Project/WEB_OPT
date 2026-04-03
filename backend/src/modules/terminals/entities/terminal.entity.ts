import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

@Entity('terminals')
export class TerminalEntity extends BaseCompanyEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ name: 'short_name', nullable: true, length: 20 })
  shortName: string;

  @Column({ nullable: true, length: 500 })
  address: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude: number;

  @Column({ name: 'is_garage', default: false })
  isGarage: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
