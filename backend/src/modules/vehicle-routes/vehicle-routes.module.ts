import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleRouteEntity } from './entities/vehicle-route.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleRouteEntity])],
  exports: [TypeOrmModule],
})
export class VehicleRoutesModule {}
