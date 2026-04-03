import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineStatus } from '../entities/line.entity';

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
  distanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  avgTripDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colorHex?: string;

  @ApiPropertyOptional({ enum: LineStatus })
  @IsOptional()
  @IsEnum(LineStatus)
  status?: LineStatus;
}
