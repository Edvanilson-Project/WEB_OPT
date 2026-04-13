import {
  IsInt,
  IsString,
  IsEnum,
  IsObject,
  IsBoolean,
  IsArray,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsNotEmpty,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TripPayloadDto {
  @IsInt()
  @IsNotEmpty()
  id: number;

  @IsInt()
  @IsNotEmpty()
  line_id: number;

  @IsInt()
  @IsOptional()
  trip_group_id: number | null;

  @IsInt()
  @Min(0)
  start_time: number;

  @IsInt()
  @Min(0)
  end_time: number;

  @IsInt()
  @IsNotEmpty()
  origin_id: number;

  @IsInt()
  @IsNotEmpty()
  destination_id: number;

  @IsInt()
  @Min(0)
  duration: number;

  @IsNumber()
  @Min(0)
  distance_km: number;

  @IsInt()
  @IsOptional()
  mid_trip_relief_point_id: number | null;

  @IsInt()
  @IsOptional()
  mid_trip_relief_offset_minutes: number | null;

  @IsObject()
  @IsNotEmpty()
  deadhead_times: Record<string, number>;
}

export class VehicleTypePayloadDto {
  @IsInt()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  activation_cost: number;
}

export class CctPayloadDto {
  @IsNumber()
  max_work_minutes: number;

  @IsNumber()
  min_work_minutes: number;

  @IsNumber()
  min_shift_minutes: number;

  @IsNumber()
  max_shift_minutes: number;

  @IsNumber()
  max_driving_minutes: number;

  @IsNumber()
  break_minutes: number;

  @IsNumber()
  @Min(0)
  connection_tolerance_minutes: number;

  @IsBoolean()
  enforce_single_line_duty: boolean;
}

export class OptimizerPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripPayloadDto)
  @ArrayMinSize(1, { message: 'Optimizer requer no mínimo 1 viagem (trip) para processamento.' })
  trips: TripPayloadDto[];

  @IsArray()
  @IsOptional() // Current implementation sends an empty array, so optional validation
  vehicle_types?: VehicleTypePayloadDto[];

  @IsString()
  @IsNotEmpty()
  algorithm: string;

  @IsNumber()
  @Min(5, { message: 'time_budget_s deve ser no mínimo 5 segundos.' })
  @Max(600, { message: 'time_budget_s não pode exceder 600 segundos (10 minutos).' })
  time_budget_s: number;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => CctPayloadDto)
  cct?: CctPayloadDto;

  // O payload real usa cct_params (nome do campo no optimizer Python)
  @IsObject()
  @IsOptional()
  cct_params?: Record<string, any>;

  @IsObject()
  @IsOptional()
  vsp?: Record<string, any>;

  // O payload real usa vsp_params (nome do campo no optimizer Python)
  @IsObject()
  @IsOptional()
  vsp_params?: Record<string, any>;
}
