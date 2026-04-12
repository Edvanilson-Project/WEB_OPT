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
import { LineTripProfilesService } from './line-trip-profiles.service';
import { CreateLineTripProfileDto } from './dto/create-line-trip-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('line-trip-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('line-trip-profiles')
export class LineTripProfilesController {
  constructor(private readonly service: LineTripProfilesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar perfil de viagem (linha + sentido + faixa)' })
  create(@Body() dto: CreateLineTripProfileDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplos perfis de viagem' })
  createBulk(@Body() dtos: CreateLineTripProfileDto[]) {
    return this.service.createBulk(dtos);
  }

  @Get()
  @ApiOperation({ summary: 'Listar perfis por linha' })
  @ApiQuery({ name: 'lineId', required: true })
  findByLine(@Query('lineId', ParseIntPipe) lineId: number) {
    return this.service.findByLine(lineId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar perfil por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar perfil' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateLineTripProfileDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover perfil' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
