import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTimetableRuleDto {
  @ApiProperty({ description: 'ID do quadro horário (schedule)' })
  @IsInt()
  scheduleId: number;

  @ApiProperty({ description: 'ID da faixa horária' })
  @IsInt()
  timeBandId: number;

  @ApiProperty({
    example: 10,
    description: 'Intervalo entre viagens (headway) em minutos',
  })
  @IsInt()
  @Min(1)
  headwayMinutes: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Qtd veículos estimados na faixa',
  })
  @IsOptional()
  @IsInt()
  vehicleCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
