import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { TimetableRulesService } from './timetable-rules.service';
import { CreateTimetableRuleDto } from './dto/create-timetable-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('timetable-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timetable-rules')
export class TimetableRulesController {
  constructor(private readonly service: TimetableRulesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar regra de quadro horário' })
  create(@Body() dto: CreateTimetableRuleDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplas regras' })
  createBulk(@Body() dtos: CreateTimetableRuleDto[]) {
    return this.service.createBulk(dtos);
  }

  @Get()
  @ApiOperation({ summary: 'Listar regras por quadro horário' })
  @ApiQuery({ name: 'scheduleId', required: true })
  findBySchedule(@Query('scheduleId', ParseIntPipe) scheduleId: number) {
    return this.service.findBySchedule(scheduleId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateTimetableRuleDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
