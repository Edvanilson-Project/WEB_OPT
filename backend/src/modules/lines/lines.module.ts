import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinesService } from './lines.service';
import { LinesController } from './lines.controller';
import { LineEntity } from './entities/line.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LineEntity])],
  controllers: [LinesController],
  providers: [LinesService],
  exports: [LinesService],
})
export class LinesModule {}
