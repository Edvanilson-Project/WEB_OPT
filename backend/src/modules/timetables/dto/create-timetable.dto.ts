import {
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTimetableDto {
  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiProperty()
  @IsInt()
  lineId: number;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  tripTimeConfigId: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  passengerConfigId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  vehicleTypeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validityStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validityEnd?: string;
}
