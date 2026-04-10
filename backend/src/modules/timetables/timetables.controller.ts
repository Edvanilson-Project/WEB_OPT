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
import { TimetablesService } from './timetables.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('timetables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  findAll(@Query('companyId') companyId?: string) {
    return this.service.findAll(companyId ? +companyId : undefined);
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
