import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeBandEntity } from './entities/time-band.entity';
import { TimeBandsService } from './time-bands.service';
import { TimeBandsController } from './time-bands.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TimeBandEntity])],
  controllers: [TimeBandsController],
  providers: [TimeBandsService],
  exports: [TimeBandsService],
})
export class TimeBandsModule {}
