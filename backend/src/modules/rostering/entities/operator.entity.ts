import { Entity, Column, Index } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

/**
 * Entidade de Operador (Motorista) para o Rostering Nominal.
 *
 * O campo `metadata` (JSONB) é a peça-chave da arquitetura Data-Driven:
 * Tags como "vip", "sindicato", "veterano" são armazenadas aqui sem
 * necessidade de alterar o schema do banco.
 *
 * Exemplos de metadata:
 *   { "is_vip": true, "loyalty_score": 100, "preferred_line_ids": [101, 102] }
 *   { "sindicato": "base_A", "turno_preferido": "morning" }
 */
@Entity('operators')
export class OperatorEntity extends BaseCompanyEntity {
  @Column({ name: 'registration', type: 'varchar', length: 50, unique: true })
  registration: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'cp', type: 'varchar', length: 50 })
  cp: string;

  @Index()
  @Column({ name: 'last_shift_end', type: 'int', default: 0 })
  lastShiftEnd: number;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
