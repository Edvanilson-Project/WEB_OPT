import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from './company.entity';
import { TenantBaseEntity } from '../../../common/entities/base.entity';

@Entity('users')
export class User extends TenantBaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ default: 'user' })
  role: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;
}
