import { Transform } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

function normalizePercentLike({ value }: { value: unknown }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }
  return value > 5 ? value / 100 : value;
}

export class CreateOptimizationSettingsDto {
  @IsString()
  algorithmType: string;

  @IsNumber() @IsOptional() @Min(10) @Max(500)
  gaPopulationSize?: number;

  @IsNumber() @IsOptional() @Min(10) @Max(1000)
  gaGenerations?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(1)
  gaMutationRate?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(1)
  gaCrossoverRate?: number;

  @IsNumber() @IsOptional()
  saInitialTemperature?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(1)
  saCoolingRate?: number;

  @IsNumber() @IsOptional()
  saMinTemperature?: number;

  @IsNumber() @IsOptional() @Min(1) @Max(100)
  tsTabuSize?: number;

  @IsNumber() @IsOptional() @Min(10) @Max(5000)
  tsMaxIterations?: number;

  @IsNumber() @IsOptional() @Min(10) @Max(600)
  ilpTimeoutSeconds?: number;

  @IsNumber() @IsOptional() @Min(30) @Max(3600)
  timeBudgetSeconds?: number;

  @IsNumber() @IsOptional() @Min(60) @Max(720)
  cctMaxShiftMinutes?: number;

  @IsNumber() @IsOptional() @Min(60) @Max(480)
  cctMaxDrivingMinutes?: number;

  @IsNumber() @IsOptional() @Min(10) @Max(60)
  cctMinBreakMinutes?: number;

  @IsNumber() @IsOptional() @Min(1) @Max(3)
  cctMaxDutiesPerDay?: number;

  @IsBoolean() @IsOptional()
  allowReliefPoints?: boolean;

  @IsString() @IsOptional()
  name?: string;

  @IsString() @IsOptional()
  description?: string;

  // ── Parâmetros CCT adicionais ────────────────────────────────────────────────

  @IsNumber() @IsOptional() @Min(60) @Max(720)
  cctMaxWorkMinutes?: number;

  @IsNumber() @IsOptional() @Min(1) @Max(60)
  cctMinLayoverMinutes?: number;

  @IsBoolean() @IsOptional()
  applyCct?: boolean;

  @IsNumber() @IsOptional() @Min(0) @Max(60)
  pulloutMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(60)
  pullbackMinutes?: number;

  @IsNumber() @IsOptional() @Min(120) @Max(1440)
  maxVehicleShiftMinutes?: number;

  // ── Novos parâmetros CCT/CLT (2026) ─────────────────────────────────────────

  /** Trabalho efetivo mínimo (0 = desabilitado) — CCT soft */
  @IsNumber() @IsOptional() @Min(0) @Max(480)
  cctMinWorkMinutes?: number;

  /** Turno mínimo (0 = desabilitado) — CCT soft */
  @IsNumber() @IsOptional() @Min(0) @Max(720)
  cctMinShiftMinutes?: number;

  /** Horas extras máx. por dia — CLT art.59 (padrão: 120 min = 2h) */
  @IsNumber() @IsOptional() @Min(0) @Max(240)
  cctOvertimeLimitMinutes?: number;

  @IsNumber() @IsOptional() @Min(60) @Max(600)
  cctMandatoryBreakAfterMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(60)
  cctSplitBreakFirstMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(60)
  cctSplitBreakSecondMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(180)
  cctMealBreakMinutes?: number;

  /** Descanso inter-jornada — CLT art.66 (padrão: 660 min = 11h) */
  @IsNumber() @IsOptional() @Min(660) @Max(1440)
  cctInterShiftRestMinutes?: number;

  /** Descanso semanal — CLT art.67 (padrão: 1440 min = 24h) */
  @IsNumber() @IsOptional() @Min(1440) @Max(2880)
  cctWeeklyRestMinutes?: number;

  @IsNumber() @IsOptional() @Min(1440) @Max(2880)
  cctReducedWeeklyRestMinutes?: number;

  @IsBoolean() @IsOptional()
  cctAllowReducedWeeklyRest?: boolean;

  @IsNumber() @IsOptional() @Min(0) @Max(720)
  cctDailyDrivingLimitMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(720)
  cctExtendedDailyDrivingLimitMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(7)
  cctMaxExtendedDrivingDaysPerWeek?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(6000)
  cctWeeklyDrivingLimitMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(10000)
  cctFortnightDrivingLimitMinutes?: number;

  /** Tempo ocioso é remunerado — CCT motoristas */
  @IsBoolean() @IsOptional()
  cctIdleTimeIsPaid?: boolean;

  @Transform(normalizePercentLike)
  @IsNumber() @IsOptional() @Min(0) @Max(1)
  cctWaitingTimePayPct?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(720)
  cctMinGuaranteedWorkMinutes?: number;

  @IsBoolean() @IsOptional()
  enforceSameDepotStartEnd?: boolean;

  @IsBoolean() @IsOptional()
  enforceSingleLineDuty?: boolean;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  fairnessWeight?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  sundayOffWeight?: number;

  @Transform(normalizePercentLike)
  @IsNumber() @IsOptional() @Min(0) @Max(5)
  holidayExtraPct?: number;

  /** Hora de início do período noturno — CLT art.73 */
  @IsNumber() @IsOptional() @Min(18) @Max(23)
  cctNocturnalStartHour?: number;

  /** Hora de término do período noturno — CLT art.73 */
  @IsNumber() @IsOptional() @Min(0) @Max(8)
  cctNocturnalEndHour?: number;

  /** Fator de conversão hora noturna — CLT art.73 §1 */
  @IsNumber() @IsOptional() @Min(0.7) @Max(1.0)
  cctNocturnalFactor?: number;

  /** Adicional noturno percentual — CLT art.73 §2 */
  @IsNumber() @IsOptional() @Min(0) @Max(0.5)
  cctNocturnalExtraPct?: number;

  @IsBoolean() @IsOptional()
  sameDepotRequired?: boolean;

  @IsNumber() @IsOptional() @Min(0) @Max(500)
  maxSimultaneousChargers?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  peakEnergyCostPerKwh?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  offpeakEnergyCostPerKwh?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(1440)
  minWorkpieceMinutes?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(1440)
  maxWorkpieceMinutes?: number;

  @IsNumber() @IsOptional() @Min(1) @Max(20)
  minTripsPerPiece?: number;

  @IsNumber() @IsOptional() @Min(1) @Max(50)
  maxTripsPerPiece?: number;

  @IsBoolean() @IsOptional()
  pricingEnabled?: boolean;

  @IsBoolean() @IsOptional()
  useSetCovering?: boolean;

  @IsBoolean() @IsOptional()
  preservePreferredPairs?: boolean;

  @IsNumber() @IsOptional() @Min(1) @Max(50)
  maxCandidateSuccessorsPerTask?: number;

  @IsNumber() @IsOptional() @Min(8) @Max(20000)
  maxGeneratedColumns?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(20)
  maxPricingIterations?: number;

  @IsNumber() @IsOptional() @Min(1) @Max(5000)
  maxPricingAdditions?: number;
}
