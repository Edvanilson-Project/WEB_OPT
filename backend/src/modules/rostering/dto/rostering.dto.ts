import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNumber,
  IsInt,
  IsArray,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';

// ─── Operator DTOs ──────────────────────────────────────────────────────────

export class CreateOperatorDto {
  @ApiProperty({ description: 'Matrícula única do operador' })
  @IsString()
  registration: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Código Profissional (CP)' })
  @IsString()
  cp: string;

  @ApiPropertyOptional({ description: 'Fim do último turno (min desde meia-noite)' })
  @IsOptional()
  @IsInt()
  lastShiftEnd?: number;

  @ApiPropertyOptional({
    description: 'Tags e atributos dinâmicos. Ex: { "is_vip": true, "loyalty_score": 100 }',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  companyId?: number;
}

export class UpdateOperatorDto extends PartialType(CreateOperatorDto) {}

export class AddTagsDto {
  @ApiProperty({ description: 'IDs dos operadores a receber a(s) tag(s)' })
  @IsArray()
  @IsInt({ each: true })
  operatorIds: number[];

  @ApiProperty({
    description: 'Tags a adicionar. Ex: { "sindicato": "base_A", "is_vip": true }',
  })
  @IsObject()
  tags: Record<string, any>;
}

export class RemoveTagsDto {
  @ApiProperty({ description: 'IDs dos operadores' })
  @IsArray()
  @IsInt({ each: true })
  operatorIds: number[];

  @ApiProperty({ description: 'Nomes das tags a remover' })
  @IsArray()
  @IsString({ each: true })
  tagKeys: string[];
}

// ─── RosteringRule DTOs ─────────────────────────────────────────────────────

export class CreateRosteringRuleDto {
  @ApiProperty({ description: 'Slug único da regra (ex: "is_vip", "sindicato")' })
  @IsString()
  ruleId: string;

  @ApiPropertyOptional({ description: 'Nome legível da regra' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descrição da regra' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['HARD', 'SOFT'], description: 'Tipo: HARD (obrigatória) ou SOFT (peso)' })
  @IsEnum(['HARD', 'SOFT'])
  type: 'HARD' | 'SOFT';

  @ApiProperty({ description: 'Peso da regra (pontos de afinidade)', minimum: 0 })
  @IsNumber()
  @Min(0)
  weight: number;

  @ApiPropertyOptional({ description: 'Metadados adicionais da regra' })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  companyId?: number;
}

export class UpdateRosteringRuleDto extends PartialType(CreateRosteringRuleDto) {}

// ─── Rostering Execution DTO ────────────────────────────────────────────────

export class RunRosteringDto {
  @ApiProperty({ description: 'IDs dos operadores a escalar' })
  @IsArray()
  @IsInt({ each: true })
  operatorIds: number[];

  @ApiProperty({ description: 'ID da execução de otimização que gerou os duties' })
  @IsInt()
  optimizationRunId: number;

  @ApiPropertyOptional({ description: 'Descanso mínimo inter-turno em minutos', default: 660 })
  @IsOptional()
  @IsInt()
  @Min(0)
  interShiftRestMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  companyId?: number;
}
