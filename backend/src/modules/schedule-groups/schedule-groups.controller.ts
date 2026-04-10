import {
  Controller,
  Get,
  Post,
  Body,
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
import { ScheduleGroupsService } from './schedule-groups.service';
import { CreateScheduleGroupDto } from './dto/create-schedule-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('schedule-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedule-groups')
export class ScheduleGroupsController {
  constructor(private readonly service: ScheduleGroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar grupo de programação (multi-linha)' })
  create(@Body() dto: CreateScheduleGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar grupos de programação' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Query('companyId') companyId?: string) {
    return this.service.findAll(companyId ? +companyId : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar grupo por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/generate-trips')
  @ApiOperation({
    summary: 'Gerar viagens automaticamente a partir do quadro horário',
    description:
      'Gera trips com base nas timetable_rules e line_trip_profiles de cada schedule do grupo',
  })
  generateTrips(@Param('id', ParseIntPipe) id: number) {
    return this.service.generateTrips(id);
  }

  @Get(':id/trips')
  @ApiOperation({ summary: 'Listar viagens geradas do grupo (editáveis)' })
  getTrips(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTrips(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover grupo e itens' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
