import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrewShiftEntity } from './entities/crew-shift.entity';
import { CrewShiftsService } from './crew-shifts.service';
import { CrewShiftsController } from './crew-shifts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CrewShiftEntity])],
  controllers: [CrewShiftsController],
  providers: [CrewShiftsService],
  exports: [CrewShiftsService],
})
export class CrewShiftsModule {}
