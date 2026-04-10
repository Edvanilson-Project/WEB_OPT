import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineTripProfileEntity } from './entities/line-trip-profile.entity';
import { LineTripProfilesService } from './line-trip-profiles.service';
import { LineTripProfilesController } from './line-trip-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LineTripProfileEntity])],
  controllers: [LineTripProfilesController],
  providers: [LineTripProfilesService],
  exports: [LineTripProfilesService],
})
export class LineTripProfilesModule {}
