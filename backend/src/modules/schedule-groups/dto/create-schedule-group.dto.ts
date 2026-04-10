import { IsInt, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleGroupDto {
  @ApiProperty({ example: 'Programação Dia Útil - Agosto 2026' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiProperty({
    example: [1, 2, 3],
    description: 'IDs dos quadros horários (schedules) a incluir',
  })
  @IsArray()
  @IsInt({ each: true })
  scheduleIds: number[];
}
