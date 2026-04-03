import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrewShiftEntity } from './entities/crew-shift.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CrewShiftEntity])],
  exports: [TypeOrmModule],
})
export class CrewShiftsModule {}
