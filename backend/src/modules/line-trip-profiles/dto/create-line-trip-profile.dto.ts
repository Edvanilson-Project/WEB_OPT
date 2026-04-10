import {
  IsNotEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLineTripProfileDto {
  @ApiProperty()
  @IsInt()
  lineId: number;

  @ApiProperty({ enum: ['outbound', 'return'] })
  @IsNotEmpty()
  @IsIn(['outbound', 'return'])
  direction: string;

  @ApiProperty()
  @IsInt()
  timeBandId: number;

  @ApiProperty({
    example: 45,
    description: 'Tempo de viagem em minutos neste sentido e faixa',
  })
  @IsInt()
  @Min(1)
  tripDurationMinutes: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional({ example: 350, description: 'Demanda de passageiros' })
  @IsOptional()
  @IsInt()
  passengerDemand?: number;
}
