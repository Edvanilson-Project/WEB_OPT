import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineStatus, LineOperationMode } from '../entities/line.entity';

export class CreateLineDto {
  @ApiProperty({ example: '214' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'Bonfim / Barroquinha' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsInt()
  originTerminalId: number;

  @ApiProperty()
  @IsInt()
  destinationTerminalId: number;

  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2880)
  avgTripDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colorHex?: string;

  @ApiPropertyOptional({ enum: LineStatus })
  @IsOptional()
  @IsEnum(LineStatus)
  status?: LineStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  returnDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  idleTerminalId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  idleDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  idleReturnDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  garageTerminalId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  garageDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  vehicleTypeId?: number;

  @ApiPropertyOptional({
    enum: LineOperationMode,
    default: LineOperationMode.ROUNDTRIP,
  })
  @IsOptional()
  @IsEnum(LineOperationMode)
  operationMode?: LineOperationMode;
}
