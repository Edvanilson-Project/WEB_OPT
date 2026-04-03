import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  Length,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatus } from '../entities/company.entity';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Empresa de Transporte Salvador' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '12.345.678/0001-99' })
  @IsNotEmpty()
  @IsString()
  cnpj: string;

  @ApiPropertyOptional({ example: 'ETS Salvador' })
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fleetSize?: number;
}
