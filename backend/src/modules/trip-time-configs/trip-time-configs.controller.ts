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
import { TripTimeConfigsService } from './trip-time-configs.service';
import {
  CreateTripTimeConfigDto,
  SaveTripTimeBandDto,
} from './dto/create-trip-time-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('trip-time-configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trip-time-configs')
export class TripTimeConfigsController {
  constructor(private readonly service: TripTimeConfigsService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar configuração de tempo de viagem (com faixas auto-geradas)',
  })
  create(@Body() dto: CreateTripTimeConfigDto) {
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

  @Get(':id/bands')
  @ApiOperation({ summary: 'Listar faixas de uma configuração' })
  getBands(@Param('id', ParseIntPipe) id: number) {
    return this.service.getBands(id);
  }

  @Post(':id/bands')
  @ApiOperation({ summary: 'Salvar faixas (substitui todas)' })
  saveBands(
    @Param('id', ParseIntPipe) id: number,
    @Body() dtos: SaveTripTimeBandDto[],
  ) {
    return this.service.saveBands(id, dtos);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateTripTimeConfigDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
