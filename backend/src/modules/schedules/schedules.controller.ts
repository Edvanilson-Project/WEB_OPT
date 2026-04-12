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
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar quadro horário' })
  create(@Body() dto: CreateScheduleDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar quadros horários' })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'lineId', required: false })
  findAll(
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
    @Query('lineId') lineId?: string,
  ) {
    return this.service.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
      lineId ? +lineId : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateScheduleDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
