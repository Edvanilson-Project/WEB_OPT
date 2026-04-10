import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimetableRuleEntity } from './entities/timetable-rule.entity';
import { TimetableRulesService } from './timetable-rules.service';
import { TimetableRulesController } from './timetable-rules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TimetableRuleEntity])],
  controllers: [TimetableRulesController],
  providers: [TimetableRulesService],
  exports: [TimetableRulesService],
})
export class TimetableRulesModule {}
