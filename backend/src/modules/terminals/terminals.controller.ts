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
import { TerminalsService } from './terminals.service';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('terminals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar terminal' })
  create(@Body() dto: CreateTerminalDto) {
    return this.terminalsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar terminais' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Query('companyId') companyId?: string) {
    return this.terminalsService.findAll(companyId ? +companyId : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar terminal por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.terminalsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar terminal' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTerminalDto,
  ) {
    return this.terminalsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desativar terminal' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.terminalsService.remove(id);
  }
}
