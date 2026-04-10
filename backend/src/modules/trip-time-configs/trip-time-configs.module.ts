import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripTimeConfigEntity } from './entities/trip-time-config.entity';
import { TripTimeBandEntity } from './entities/trip-time-band.entity';
import { TripTimeConfigsService } from './trip-time-configs.service';
import { TripTimeConfigsController } from './trip-time-configs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TripTimeConfigEntity, TripTimeBandEntity]),
  ],
  controllers: [TripTimeConfigsController],
  providers: [TripTimeConfigsService],
  exports: [TripTimeConfigsService],
})
export class TripTimeConfigsModule {}
