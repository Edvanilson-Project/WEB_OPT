import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsObject,
  IsBoolean,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptimizationAlgorithm } from '../entities/optimization-run.entity';

export class RunOptimizationDto {
  @ApiPropertyOptional({ description: 'Nome amigável para a execução da otimização' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'ID de uma única linha (use lineIds para múltiplas)',
  })
  @IsOptional()
  @IsInt()
  lineId?: number;

  @ApiPropertyOptional({
    description: 'IDs de múltiplas linhas a otimizar em conjunto',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  lineIds?: number[];

  @ApiPropertyOptional({
    description: 'ID da empresa (extraído do JWT se omitido)',
  })
  @IsOptional()
  @IsInt()
  companyId?: number;

  @ApiPropertyOptional({ description: 'ID da expedição específica' })
  @IsOptional()
  @IsInt()
  scheduleId?: number;

  @ApiPropertyOptional({
    description: 'Algoritmo a usar',
    default: OptimizationAlgorithm.HYBRID_PIPELINE,
    enum: OptimizationAlgorithm,
  })
  @IsOptional()
  @IsEnum(OptimizationAlgorithm)
  algorithm?: string;

  @ApiPropertyOptional({
    description: 'Modo de operação: urban (Urbano) ou charter (Fretamento)',
    default: 'urban',
    enum: ['urban', 'charter'],
  })
  @IsOptional()
  @IsEnum(['urban', 'charter'])
  operationMode?: 'urban' | 'charter';

  @ApiPropertyOptional({ description: 'Parâmetros do VSP' })
  @IsOptional()
  @IsObject()
  vspParams?: {
    restarts?: number;
    maxLocalIterations?: number;
    enablePerturbation?: boolean;
    timeLimitSeconds?: number;
    timeBudgetSeconds?: number;
    maxVehicles?: number;
    fixedVehicleActivationCost?: number;
    deadheadCostPerMinute?: number;
    idleCostPerMinute?: number;
    randomSeed?: number;
    maxConnectionCostForReuseRatio?: number;
    strictHardValidation?: boolean;
    allowMultiLineBlock?: boolean;
    allowVehicleSplitShifts?: boolean;
    splitShiftMinGapMinutes?: number;
    splitShiftMaxGapMinutes?: number;
  };

  @ApiPropertyOptional({ description: 'Parâmetros do CSP/CCT' })
  @IsOptional()
  @IsObject()
  cspParams?: {
    maxWorkMinutes?: number;
    minWorkMinutes?: number;
    minShiftMinutes?: number;
    maxShiftMinutes?: number; // jornada máxima total (spread)
    maxDrivingMinutes?: number; // direção contínua máxima
    breakMinutes?: number;
    connectionToleranceMinutes?: number;
    enforceSingleLineDuty?: boolean;
    fairnessWeight?: number;
    fairnessTargetWorkMinutes?: number;
    fairnessToleranceMinutes?: number;
    maxUnpaidBreakMinutes?: number;
    maxTotalUnpaidBreakMinutes?: number;
    longUnpaidBreakLimitMinutes?: number;
    longUnpaidBreakPenaltyWeight?: number;
    strictHardValidation?: boolean;
    enforceTripGroupsHard?: boolean;
    operatorChangeTerminalsOnly?: boolean;
    operatorSingleVehicleOnly?: boolean;
    timeLimitSeconds?: number;
  };

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ description: 'Budget global de tempo em segundos (atalho para vspParams.timeBudgetSeconds + cspParams.timeLimitSeconds). Min: 5s, Max: 600s', default: 30, minimum: 5, maximum: 600 })
  @IsOptional()
  @IsNumber()
  @Min(5, { message: 'timeBudgetSeconds deve ser no mínimo 5 segundos.' })
  @Max(600, { message: 'timeBudgetSeconds não pode exceder 600 segundos (10 minutos).' })
  timeBudgetSeconds?: number;
}
