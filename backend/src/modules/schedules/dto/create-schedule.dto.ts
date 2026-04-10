import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: 'QH Linha 301 - Dia Útil' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'ID da linha' })
  @IsInt()
  lineId: number;

  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional({
    enum: ['weekday', 'saturday', 'sunday', 'holiday'],
    default: 'weekday',
  })
  @IsOptional()
  @IsIn(['weekday', 'saturday', 'sunday', 'holiday'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;
}
