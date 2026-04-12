import { PartialType } from '@nestjs/swagger';
import { CreateVehicleRouteDto } from './create-vehicle-route.dto';

export class UpdateVehicleRouteDto extends PartialType(CreateVehicleRouteDto) {}
