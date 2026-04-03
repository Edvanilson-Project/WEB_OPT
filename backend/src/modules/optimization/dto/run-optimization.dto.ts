import {
  IsInt,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptimizationAlgorithm } from '../entities/optimization-run.entity';

export class RunOptimizationDto {
  @ApiPropertyOptional({ description: 'ID de uma única linha (use lineIds para múltiplas)' })
  @IsOptional()
  @IsInt()
  lineId?: number;

  @ApiPropertyOptional({ description: 'IDs de múltiplas linhas a otimizar em conjunto' })
  @IsOptional()
  @IsArray()
  lineIds?: number[];

  @ApiProperty({ description: 'ID da empresa' })
  @IsInt()
  companyId: number;

  @ApiPropertyOptional({ description: 'ID da expedição específica' })
  @IsOptional()
  @IsInt()
  scheduleId?: number;

  @ApiPropertyOptional({
    description: 'Algoritmo a usar',
    default: OptimizationAlgorithm.FULL_PIPELINE,
  })
  @IsOptional()
  algorithm?: string;

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
    maxShiftMinutes?: number;     // jornada máxima total (spread)
    maxDrivingMinutes?: number;  // direção contínua máxima
    breakMinutes?: number;
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
}
