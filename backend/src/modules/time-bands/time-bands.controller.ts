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
import { TimeBandsService } from './time-bands.service';
import { CreateTimeBandDto } from './dto/create-time-band.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('time-bands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('time-bands')
export class TimeBandsController {
  constructor(private readonly service: TimeBandsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar faixa horária' })
  create(@Body() dto: CreateTimeBandDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar faixas horárias' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Query('companyId') companyId?: string) {
    return this.service.findAll(companyId ? +companyId : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar faixa horária por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar faixa horária' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateTimeBandDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover faixa horária' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
