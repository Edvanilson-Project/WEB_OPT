import { PartialType } from '@nestjs/mapped-types';
import { CreateOptimizationSettingsDto } from './create-optimization-settings.dto';

export class UpdateOptimizationSettingsDto extends PartialType(CreateOptimizationSettingsDto) {}
