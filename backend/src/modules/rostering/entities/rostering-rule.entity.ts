import { Entity, Column } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

/**
 * Entidade de Regra de Rostering.
 *
 * Cada regra associa um `ruleId` (slug da tag no metadata do operador) a um peso.
 * O Python usa o peso para pontuar a afinidade de cada operador com cada jornada.
 *
 * Tipos:
 *   HARD — Obrigatória. Se violada, o emparelhamento é proibido (ex: descanso mínimo).
 *   SOFT — Desejável. Contribui com `weight` pontos no score de afinidade.
 *
 * Exemplo:
 *   ruleId: "is_vip", type: "SOFT", weight: 5000
 *   → Operadores com metadata.is_vip = true ganham +5000 na pontuação.
 */
@Entity('rostering_rules')
export class RosteringRuleEntity extends BaseCompanyEntity {
  @Column({ name: 'rule_id', type: 'varchar', length: 100 })
  ruleId: string;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'type', type: 'varchar', length: 10, default: 'SOFT' })
  type: 'HARD' | 'SOFT';

  @Column({ name: 'weight', type: 'decimal', precision: 10, scale: 2, default: 0 })
  weight: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'meta', type: 'jsonb', default: {} })
  meta: Record<string, any>;
}
