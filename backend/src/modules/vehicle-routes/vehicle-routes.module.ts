import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleRouteEntity } from './entities/vehicle-route.entity';
import { VehicleRoutesService } from './vehicle-routes.service';
import { VehicleRoutesController } from './vehicle-routes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleRouteEntity])],
  controllers: [VehicleRoutesController],
  providers: [VehicleRoutesService],
  exports: [VehicleRoutesService],
})
export class VehicleRoutesModule {}
