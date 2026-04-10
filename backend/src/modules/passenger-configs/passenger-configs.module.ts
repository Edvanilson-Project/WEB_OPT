import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassengerConfigEntity } from './entities/passenger-config.entity';
import { PassengerBandEntity } from './entities/passenger-band.entity';
import { PassengerConfigsService } from './passenger-configs.service';
import { PassengerConfigsController } from './passenger-configs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PassengerConfigEntity, PassengerBandEntity]),
  ],
  controllers: [PassengerConfigsController],
  providers: [PassengerConfigsService],
  exports: [PassengerConfigsService],
})
export class PassengerConfigsModule {}
