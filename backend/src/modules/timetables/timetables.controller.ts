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
import { TimetablesService } from './timetables.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('timetables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('timetables')
export class TimetablesController {
  constructor(private readonly service: TimetablesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar carta horária' })
  create(@Body() dto: CreateTimetableDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.service.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/generate-trips')
  @ApiOperation({
    summary:
      'Gerar viagens da carta horária baseado em tempo de viagem + passageiros',
  })
  generateTrips(@Param('id', ParseIntPipe) id: number) {
    return this.service.generateTrips(id);
  }

  @Get(':id/trips')
  @ApiOperation({ summary: 'Listar viagens da carta horária' })
  getTrips(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTrips(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateTimetableDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
