import {
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripDirection } from '../entities/trip.entity';

export class CreateTripDto {
  @ApiProperty()
  @IsInt()
  lineId: number;

  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  scheduleId?: number;

  @ApiProperty({ enum: TripDirection })
  @IsEnum(TripDirection)
  direction: TripDirection;

  @ApiProperty({
    description: 'Horário de início em minutos a partir de 00:00',
    example: 360,
  })
  @IsInt()
  @Min(0)
  startTimeMinutes: number;

  @ApiProperty({ description: 'Duração em minutos' })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  originTerminalId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  destinationTerminalId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  passengerCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  vehicleTypeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tripGroupId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tripCode?: string;
}
