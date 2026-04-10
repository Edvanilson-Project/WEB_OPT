import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'endAfterStart', async: false })
class EndAfterStartConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as any;
    return obj.endMinutes > obj.startMinutes;
  }
  defaultMessage() {
    return 'endMinutes deve ser maior que startMinutes';
  }
}

export class CreateTimeBandDto {
  @ApiProperty({ example: 'Pico Manhã' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 300,
    description: 'Início em minutos desde 00:00 (ex: 300 = 05:00)',
  })
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinutes: number;

  @ApiProperty({
    example: 540,
    description: 'Fim em minutos desde 00:00 (ex: 540 = 09:00)',
  })
  @IsInt()
  @Min(0)
  @Max(1440)
  @Validate(EndAfterStartConstraint)
  endMinutes: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPeak?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiProperty()
  @IsInt()
  companyId: number;
}
