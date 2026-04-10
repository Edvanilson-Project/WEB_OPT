import {
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleRouteStatus } from '../entities/vehicle-route.entity';

export class CreateVehicleRouteDto {
  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiProperty()
  @IsInt()
  optimizationRunId: number;

  @ApiProperty()
  @IsString()
  vehicleNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  vehicleTypeId?: number;

  @ApiProperty()
  @IsInt()
  lineId: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  tripIds: number[];

  @ApiProperty({ description: 'Total de viagens na rota' })
  @IsInt()
  @Min(1)
  @Max(100)
  totalTrips: number;

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
  totalWorkMinutes: number;

  @ApiPropertyOptional({
    description: 'Custo estimado da rota',
    example: 1200.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  estimatedCost?: number;

  @ApiPropertyOptional({ enum: VehicleRouteStatus, default: VehicleRouteStatus.DRAFT })
  @IsOptional()
  @IsEnum(VehicleRouteStatus)
  status?: VehicleRouteStatus;
}