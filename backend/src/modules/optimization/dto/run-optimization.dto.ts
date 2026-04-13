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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptimizationAlgorithm } from '../entities/optimization-run.entity';

export class VspParamsDto {
  @IsOptional() @IsNumber() @Min(1) @Max(50) restarts?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5000) maxLocalIterations?: number;
  @IsOptional() @IsBoolean() enablePerturbation?: boolean;
  @IsOptional() @IsNumber() @Min(5) @Max(3600) timeLimitSeconds?: number;
  @IsOptional() @IsNumber() @Min(5) @Max(3600) timeBudgetSeconds?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(500) maxVehicles?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000000) fixedVehicleActivationCost?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) deadheadCostPerMinute?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) idleCostPerMinute?: number;
  @IsOptional() @IsNumber() randomSeed?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(120) maxConnectionCostForReuseRatio?: number;
  @IsOptional() @IsBoolean() strictHardValidation?: boolean;
  @IsOptional() @IsBoolean() allowMultiLineBlock?: boolean;
  @IsOptional() @IsBoolean() allowVehicleSplitShifts?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) splitShiftMinGapMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) splitShiftMaxGapMinutes?: number;
}

export class CspParamsDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1440) maxWorkMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) minWorkMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) minShiftMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) maxShiftMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(720) maxDrivingMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(480) breakMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(120) connectionToleranceMinutes?: number;
  @IsOptional() @IsBoolean() enforceSingleLineDuty?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1) fairnessWeight?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) fairnessTargetWorkMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(480) fairnessToleranceMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(480) maxUnpaidBreakMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) maxTotalUnpaidBreakMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(480) longUnpaidBreakLimitMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) longUnpaidBreakPenaltyWeight?: number;
  @IsOptional() @IsBoolean() strictHardValidation?: boolean;
  @IsOptional() @IsBoolean() enforceTripGroupsHard?: boolean;
  @IsOptional() @IsBoolean() operatorChangeTerminalsOnly?: boolean;
  @IsOptional() @IsBoolean() operatorSingleVehicleOnly?: boolean;
  @IsOptional() @IsNumber() @Min(5) @Max(3600) timeLimitSeconds?: number;
}

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
  @ValidateNested()
  @Type(() => VspParamsDto)
  vspParams?: VspParamsDto;

  @ApiPropertyOptional({ description: 'Parâmetros do CSP/CCT' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CspParamsDto)
  cspParams?: CspParamsDto;

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
