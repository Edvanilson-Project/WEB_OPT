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
import { TerminalsService } from './terminals.service';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('terminals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar terminal' })
  create(@Body() dto: CreateTerminalDto, @Request() req: AuthRequest) {
    return this.terminalsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar terminais' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.terminalsService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
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
