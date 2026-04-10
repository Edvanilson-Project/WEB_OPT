import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimetableEntity } from './entities/timetable.entity';
import { TripTimeBandEntity } from '../trip-time-configs/entities/trip-time-band.entity';
import { PassengerBandEntity } from '../passenger-configs/entities/passenger-band.entity';
import { TripEntity } from '../trips/entities/trip.entity';
import { LineEntity } from '../lines/entities/line.entity';
import { TimetablesService } from './timetables.service';
import { TimetablesController } from './timetables.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimetableEntity,
      TripTimeBandEntity,
      PassengerBandEntity,
      TripEntity,
      LineEntity,
    ]),
  ],
  controllers: [TimetablesController],
  providers: [TimetablesService],
  exports: [TimetablesService],
})
export class TimetablesModule {}
