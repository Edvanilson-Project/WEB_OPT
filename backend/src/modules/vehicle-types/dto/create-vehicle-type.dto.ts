import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleTypeDto {
  @ApiProperty({ example: 'Ônibus Convencional' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'CONV' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 80 })
  @IsInt()
  passengerCapacity: number;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  costPerKm?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  costPerHour?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  fixedCost?: number;

  @ApiProperty({ description: 'ID da empresa' })
  @IsInt()
  companyId: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
