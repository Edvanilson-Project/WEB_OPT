import { IsInt, IsString, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePassengerConfigDto {
  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiProperty()
  @IsInt()
  lineId: number;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(5)
  @Max(120)
  bandIntervalMinutes: number;

  @ApiPropertyOptional({
    example: 240,
    description: 'Início da geração em minutos (ex: 240 = 04:00)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1800)
  startHourMinutes?: number;

  @ApiPropertyOptional({
    example: 1440,
    description:
      'Fim da geração em minutos (ex: 1440 = 24:00, 1560 = 02:00+1d)',
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(1800)
  endHourMinutes?: number;
}

export class SavePassengerBandDto {
  @ApiProperty()
  @IsInt()
  startMinutes: number;

  @ApiProperty()
  @IsInt()
  endMinutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  passengersOutbound?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  passengersReturn?: number;
}
