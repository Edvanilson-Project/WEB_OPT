import { Entity, Column, AfterLoad } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

@Entity('optimization_settings')
export class OptimizationSettingsEntity extends BaseCompanyEntity {
  @Column({ name: 'algorithm_type', default: 'hybrid_pipeline' })
  algorithmType: string;

  // General
  @Column({ name: 'time_budget_seconds', default: 300 })
  timeBudgetSeconds: number;

  // Crew Constraints (CCT / CLT art. 235-A a 235-G)
  @Column({ name: 'cct_max_shift_minutes', default: 480 })
  cctMaxShiftMinutes: number; // jornada máxima (spread) — padrão 8h

  @Column({ name: 'cct_max_work_minutes', default: 440 })
  cctMaxWorkMinutes: number; // trabalho efetivo máximo — padrão 7h20

  @Column({ name: 'cct_max_driving_minutes', default: 270 })
  cctMaxDrivingMinutes: number; // direção contínua máxima — padrão 4h30

  @Column({ name: 'cct_min_break_minutes', default: 30 })
  cctMinBreakMinutes: number; // intervalo mínimo entre trechos — padrão 30min

  @Column({ name: 'cct_min_layover_minutes', default: 8 })
  cctMinLayoverMinutes: number; // pausa mínima no terminal mesmo bloco — padrão 8min

  @Column({ name: 'apply_cct', default: true })
  applyCct: boolean; // se false, ignora restrições CCT (modo só custo)

  // Soltura e recolhimento (garagem)
  @Column({ name: 'pullout_minutes', default: 10 })
  pulloutMinutes: number; // tempo para sair da garagem à 1ª viagem

  @Column({ name: 'pullback_minutes', default: 10 })
  pullbackMinutes: number; // tempo após última viagem para retornar à garagem

  // Veículo
  @Column({ name: 'max_vehicle_shift_minutes', default: 960 })
  maxVehicleShiftMinutes: number; // turno máximo de um veículo — padrão 16h

  // Custos VSP
  @Column({
    name: 'fixed_vehicle_activation_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 800,
  })
  fixedVehicleActivationCost: number;

  @Column({
    name: 'deadhead_cost_per_minute',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0.85,
  })
  deadheadCostPerMinute: number;

  @Column({
    name: 'idle_cost_per_minute',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0.5,
  })
  idleCostPerMinute: number;

  @Column({ name: 'allow_vehicle_split_shifts', default: true })
  allowVehicleSplitShifts: boolean;

  @Column({ name: 'allow_multi_line_block', default: true })
  allowMultiLineBlock: boolean;

  @Column({ name: 'vsp_garage_return_policy', default: 'smart' })
  vspGarageReturnPolicy: string; // smart, always, never

  // Relief Points (mid-route driver change)
  @Column({ name: 'allow_relief_points', default: false })
  allowReliefPoints: boolean;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'connection_tolerance_minutes', default: 2 })
  connectionToleranceMinutes: number;

  // Novos campos CCT/CLT (sessão 2026) ──────────────────────────────────────────

  /** Trabalho efetivo mínimo (0 = desabilitado) — CCT soft */
  @Column({ name: 'cct_min_work_minutes', default: 0 })
  cctMinWorkMinutes: number;

  /** Turno mínimo (0 = desabilitado) — CCT soft */
  @Column({ name: 'cct_min_shift_minutes', default: 0 })
  cctMinShiftMinutes: number;

  /** Horas extras máx./dia = 2h — CLT art.59 */
  @Column({ name: 'cct_overtime_limit_minutes', default: 120 })
  cctOvertimeLimitMinutes: number;

  /** Janela que exige pausa obrigatória — UE 4h30 */
  @Column({ name: 'cct_mandatory_break_after_minutes', default: 270 })
  cctMandatoryBreakAfterMinutes: number;

  /** Pausa fracionada parte 1 — UE */
  @Column({ name: 'cct_split_break_first_minutes', default: 15 })
  cctSplitBreakFirstMinutes: number;

  /** Pausa fracionada parte 2 — UE */
  @Column({ name: 'cct_split_break_second_minutes', default: 30 })
  cctSplitBreakSecondMinutes: number;

  /** Intervalo de refeição — Lei 13.103 */
  @Column({ name: 'cct_meal_break_minutes', default: 60 })
  cctMealBreakMinutes: number;

  /** Descanso inter-jornada mínimo = 11h — CLT art.66 */
  @Column({ name: 'cct_inter_shift_rest_minutes', default: 660 })
  cctInterShiftRestMinutes: number;

  /** Descanso semanal mínimo = 24h — CLT art.67 */
  @Column({ name: 'cct_weekly_rest_minutes', default: 1440 })
  cctWeeklyRestMinutes: number;

  /** Descanso semanal reduzido — UE */
  @Column({ name: 'cct_reduced_weekly_rest_minutes', default: 2160 })
  cctReducedWeeklyRestMinutes: number;

  /** Permitir descanso semanal reduzido */
  @Column({ name: 'cct_allow_reduced_weekly_rest', default: false })
  cctAllowReducedWeeklyRest: boolean;

  /** Limite diário de condução — UE */
  @Column({ name: 'cct_daily_driving_limit_minutes', default: 540 })
  cctDailyDrivingLimitMinutes: number;

  /** Limite diário estendido — UE */
  @Column({ name: 'cct_extended_daily_driving_limit_minutes', default: 600 })
  cctExtendedDailyDrivingLimitMinutes: number;

  /** Número de extensões semanais permitidas — UE */
  @Column({ name: 'cct_max_extended_driving_days_per_week', default: 2 })
  cctMaxExtendedDrivingDaysPerWeek: number;

  /** Limite semanal de condução — UE */
  @Column({ name: 'cct_weekly_driving_limit_minutes', default: 3360 })
  cctWeeklyDrivingLimitMinutes: number;

  /** Limite quinzenal de condução — UE */
  @Column({ name: 'cct_fortnight_driving_limit_minutes', default: 5400 })
  cctFortnightDrivingLimitMinutes: number;

  /** Tempo ocioso é remunerado — CCT motoristas */
  @Column({ name: 'cct_idle_time_is_paid', default: true })
  cctIdleTimeIsPaid: boolean;

  /** Tempo de espera remunerado em percentual do salário-hora */
  @Column({
    name: 'cct_waiting_time_pay_pct',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.3,
  })
  cctWaitingTimePayPct: number;

  /** Garantia mínima de horas remuneradas */
  @Column({ name: 'cct_min_guaranteed_work_minutes', default: 0 })
  cctMinGuaranteedWorkMinutes: number;

  /** Exigir início e fim no mesmo depósito */
  @Column({ name: 'enforce_same_depot_start_end', default: false })
  enforceSameDepotStartEnd: boolean;

  /** Exigir que cada plantão permaneça em uma única linha */
  @Column({ name: 'enforce_single_line_duty', default: false })
  enforceSingleLineDuty: boolean;

  /** Peso de equidade entre motoristas */
  @Column({
    name: 'fairness_weight',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 0,
  })
  fairnessWeight: number;

  /** Peso para domingos livres */
  @Column({
    name: 'sunday_off_weight',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 0,
  })
  sundayOffWeight: number;

  /** Adicional de feriado */
  @Column({
    name: 'holiday_extra_pct',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 1.0,
  })
  holidayExtraPct: number;

  /** Início período noturno = 22h — CLT art.73 */
  @Column({ name: 'cct_nocturnal_start_hour', default: 22 })
  cctNocturnalStartHour: number;

  /** Fim período noturno = 05h — CLT art.73 */
  @Column({ name: 'cct_nocturnal_end_hour', default: 5 })
  cctNocturnalEndHour: number;

  /** Fator hora noturna (52.5 min = 1h) — CLT art.73 §1 */
  @Column({
    name: 'cct_nocturnal_factor',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.875,
  })
  cctNocturnalFactor: number;

  /** Adicional noturno +20% — CLT art.73 §2 */
  @Column({
    name: 'cct_nocturnal_extra_pct',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.2,
  })
  cctNocturnalExtraPct: number;

  /** VSP: exigir mesmo depósito início/fim de bloco */
  @Column({ name: 'same_depot_required', default: false })
  sameDepotRequired: boolean;

  /** EV: máximo de carregadores simultâneos */
  @Column({ name: 'max_simultaneous_chargers', default: 0 })
  maxSimultaneousChargers: number;

  /** EV: tarifa pico */
  @Column({
    name: 'peak_energy_cost_per_kwh',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  peakEnergyCostPerKwh: number;

  /** EV: tarifa fora de pico */
  @Column({
    name: 'offpeak_energy_cost_per_kwh',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  offpeakEnergyCostPerKwh: number;

  /** Workpiece mínimo */
  @Column({ name: 'min_workpiece_minutes', default: 0 })
  minWorkpieceMinutes: number;

  /** Workpiece máximo */
  @Column({ name: 'max_workpiece_minutes', default: 480 })
  maxWorkpieceMinutes: number;

  /** Mínimo de viagens por workpiece */
  @Column({ name: 'min_trips_per_piece', default: 1 })
  minTripsPerPiece: number;

  /** Máximo de viagens por workpiece */
  @Column({ name: 'max_trips_per_piece', default: 4 })
  maxTripsPerPiece: number;

  /** Habilita pricing problem / geração de colunas */
  @Column({ name: 'pricing_enabled', default: true })
  pricingEnabled: boolean;

  /** Força set covering / column generation */
  @Column({ name: 'use_set_covering', default: false })
  useSetCovering: boolean;

  /** Preservar pares preferenciais ida-volta no mesmo veículo */
  @Column({ name: 'preserve_preferred_pairs', default: true })
  preservePreferredPairs: boolean;

  /** Forçar pares ida/volta no mesmo tripulante (hard constraint) */
  @Column({ name: 'enforce_trip_groups_hard', default: true })
  enforceTripGroupsHard: boolean;

  /** Operador troca de veículo somente em terminais */
  @Column({ name: 'operator_change_terminals_only', default: true })
  operatorChangeTerminalsOnly: boolean;

  /** Operador permanece em um único veículo por jornada */
  @Column({ name: 'operator_single_vehicle_only', default: false })
  operatorSingleVehicleOnly: boolean;

  /** Aborta em violações hard de entrada/saída em vez de apenas auditar */
  @Column({ name: 'strict_hard_validation', default: true })
  strictHardValidation: boolean;

  /** Modo de operação: urbano ou fretamento */
  @Column({ name: 'operation_mode', default: 'urban', nullable: true })
  operationMode: string;

  /** Multiplicador de timeout do backend (Somente Admin) */
  @Column({
    name: 'max_timeout_multiplier',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 1.5,
  })
  maxTimeoutMultiplier: number;

  /** Máximo de sucessores candidatos por tarefa na geração de colunas */
  @Column({ name: 'max_candidate_successors_per_task', default: 5 })
  maxCandidateSuccessorsPerTask: number;

  /** Máximo global de colunas/workpieces geradas */
  @Column({ name: 'max_generated_columns', default: 2500 })
  maxGeneratedColumns: number;

  /** Máximo de iterações de pricing problem */
  @Column({ name: 'max_pricing_iterations', default: 1 })
  maxPricingIterations: number;

  /** Máximo de colunas adicionadas por rodada de pricing */
  @Column({ name: 'max_pricing_additions', default: 192 })
  maxPricingAdditions: number;

  /** Meta de trabalho efetivo para equidade (minutos) */
  @Column({ name: 'fairness_target_work_minutes', default: 420 })
  fairnessTargetWorkMinutes: number;

  /** Tolerância para equidade antes de penalizar (minutos) */
  @Column({ name: 'fairness_tolerance_minutes', default: 30 })
  fairnessToleranceMinutes: number;

  /** Limite de ociosidade não remunerada por jornada */
  @Column({ name: 'max_unpaid_break_minutes', default: 360 })
  maxUnpaidBreakMinutes: number;

  /** Tempo após o qual uma pausa longa é penalizada */
  @Column({ name: 'long_unpaid_break_limit_minutes', default: 180 })
  longUnpaidBreakLimitMinutes: number;

  /** Peso da penalidade para pausas longas */
  @Column({
    name: 'long_unpaid_break_penalty_weight',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 1.0,
  })
  longUnpaidBreakPenaltyWeight: number;

  /** Razão de reuso máximo para conexões VSP */
  @Column({
    name: 'max_connection_cost_for_reuse_ratio',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 2.5,
  })
  maxConnectionCostForReuseRatio: number;

  /** Peso do objetivo: reduzir hora extra */
  @Column({
    name: 'goal_weight_overtime',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.8,
  })
  goalWeightOvertime: number;

  /** Peso do objetivo: reduzir spread */
  @Column({
    name: 'goal_weight_spread',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.15,
  })
  goalWeightSpread: number;

  /** Peso do objetivo: atingir garantia mínima */
  @Column({
    name: 'goal_weight_min_work',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.2,
  })
  goalWeightMinWork: number;

  /** Layover mínimo para o Terminal Central (ID 1) */
  @Column({ name: 'terminal_central_min_layover', default: 12 })
  terminalCentralMinLayover: number;

  /** Gap mínimo para turno partido de veículo */
  @Column({ name: 'split_shift_min_gap_minutes', default: 120 })
  splitShiftMinGapMinutes: number;

  /** Gap máximo para turno partido de veículo */
  @Column({ name: 'split_shift_max_gap_minutes', default: 600 })
  splitShiftMaxGapMinutes: number;

  @AfterLoad()
  convertDecimals() {
    const decimals = [
      'fixedVehicleActivationCost',
      'deadheadCostPerMinute',
      'idleCostPerMinute',
      'cctWaitingTimePayPct',
      'fairnessWeight',
      'sundayOffWeight',
      'holidayExtraPct',
      'cctNocturnalFactor',
      'cctNocturnalExtraPct',
      'peakEnergyCostPerKwh',
      'offpeakEnergyCostPerKwh',
      'maxTimeoutMultiplier',
      'longUnpaidBreakPenaltyWeight',
      'maxConnectionCostForReuseRatio',
      'goalWeightOvertime',
      'goalWeightSpread',
      'goalWeightMinWork',
    ] as const;
    for (const key of decimals) {
      if (typeof (this as any)[key] === 'string') {
        (this as any)[key] = parseFloat((this as any)[key]);
      }
    }
  }
}
