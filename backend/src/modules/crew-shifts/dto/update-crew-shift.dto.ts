import { PartialType } from '@nestjs/swagger';
import { CreateCrewShiftDto } from './create-crew-shift.dto';

export class UpdateCrewShiftDto extends PartialType(CreateCrewShiftDto) {}