import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleTypeEntity } from './entities/vehicle-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleTypeEntity])],
  exports: [TypeOrmModule],
})
export class VehicleTypesModule {}
