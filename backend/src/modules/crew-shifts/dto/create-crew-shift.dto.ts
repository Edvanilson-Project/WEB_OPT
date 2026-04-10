import {
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus } from '../entities/crew-shift.entity';

export class CreateCrewShiftDto {
  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiProperty()
  @IsInt()
  optimizationRunId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  vehicleRouteId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorName?: string;

  @ApiProperty()
  @IsString()
  vehicleNumber: string;

  @ApiProperty()
  @IsInt()
  lineId: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  tripIds: number[];

  @ApiProperty({
    description: 'Horário de início em minutos a partir de 00:00',
    example: 360,
  })
  @IsInt()
  @Min(0)
  @Max(2880)
  startTimeMinutes: number;

  @ApiProperty({
    description: 'Horário de término em minutos a partir de 00:00',
    example: 720,
  })
  @IsInt()
  @Min(0)
  @Max(2880)
  endTimeMinutes: number;

  @ApiProperty({ description: 'Duração total de trabalho em minutos' })
  @IsInt()
  @Min(1)
  @Max(1440)
  workDurationMinutes: number;

  @ApiPropertyOptional({ description: 'Duração total de pausas em minutos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  breakDurationMinutes?: number;

  @ApiProperty({ description: 'Total de viagens na jornada' })
  @IsInt()
  @Min(1)
  @Max(100)
  totalTrips: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasCctViolation?: boolean;

  @ApiPropertyOptional({ type: [Object], description: 'Lista de violações CCT' })
  @IsOptional()
  @IsArray()
  violations?: object[];

  @ApiPropertyOptional({ enum: ShiftStatus, default: ShiftStatus.DRAFT })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;
}