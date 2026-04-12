import {
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
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
  @Max(2880)
  startTimeMinutes: number;

  @ApiProperty({ description: 'Duração em minutos' })
  @IsInt()
  @Min(1)
  @Max(1440)
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
  @Min(0)
  @Max(50000)
  passengerCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  vehicleTypeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tripGroupId?: number;

  @ApiPropertyOptional({
    description: 'Ponto operacional intermediario onde a rendicao pode ocorrer dentro da viagem',
  })
  @IsOptional()
  @IsInt()
  midTripReliefPointId?: number;

  @ApiPropertyOptional({
    description: 'Minutos apos o inicio da viagem em que a rendicao intra-viagem pode ocorrer',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  midTripReliefOffsetMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tripCode?: string;

  @ApiPropertyOptional({
    description: 'Horário de término em minutos (recalculado pelo service)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2880)
  endTimeMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
