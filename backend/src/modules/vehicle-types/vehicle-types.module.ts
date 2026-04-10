import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleTypeEntity } from './entities/vehicle-type.entity';
import { VehicleTypesService } from './vehicle-types.service';
import { VehicleTypesController } from './vehicle-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleTypeEntity])],
  controllers: [VehicleTypesController],
  providers: [VehicleTypesService],
  exports: [TypeOrmModule, VehicleTypesService],
})
export class VehicleTypesModule {}
