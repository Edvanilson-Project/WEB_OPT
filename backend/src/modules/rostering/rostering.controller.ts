import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { RosteringService } from './rostering.service';
import { RosteringIntegrationService } from './rostering-integration.service';
import {
  CreateOperatorDto,
  UpdateOperatorDto,
  AddTagsDto,
  RemoveTagsDto,
  CreateRosteringRuleDto,
  UpdateRosteringRuleDto,
  RunRosteringDto,
} from './dto/rostering.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('rostering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ANALYST)
@Controller('rostering')
export class RosteringController {
  constructor(
    private readonly rosteringService: RosteringService,
    private readonly integrationService: RosteringIntegrationService,
  ) {}

  // ─── OPERADORES ───────────────────────────────────────────────────────

  @Post('operators')
  @ApiOperation({ summary: 'Cadastrar novo operador (motorista)' })
  createOperator(@Body() dto: CreateOperatorDto, @Request() req: AuthRequest) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId, req.user?.role);
    return this.rosteringService.createOperator(dto);
  }

  @Get('operators')
  @ApiOperation({ summary: 'Listar operadores ativos' })
  @ApiQuery({ name: 'companyId', required: false })
  findAllOperators(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.rosteringService.findAllOperators(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get('operators/:id')
  @ApiOperation({ summary: 'Detalhes de um operador' })
  findOperator(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.rosteringService.findOperatorById(id, req.user?.companyId);
  }

  @Patch('operators/:id')
  @ApiOperation({ summary: 'Atualizar operador' })
  updateOperator(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperatorDto,
  ) {
    return this.rosteringService.updateOperator(id, dto);
  }

  @Delete('operators/:id')
  @ApiOperation({ summary: 'Desativar operador (soft delete)' })
  deleteOperator(@Param('id', ParseIntPipe) id: number) {
    return this.rosteringService.deleteOperator(id);
  }

  @Post('operators/tags')
  @ApiOperation({ summary: 'Adicionar tags a múltiplos operadores em lote' })
  addTags(@Body() dto: AddTagsDto) {
    return this.rosteringService.addTagsToOperators(dto.operatorIds, dto.tags);
  }

  @Post('operators/tags/remove')
  @ApiOperation({ summary: 'Remover tags de múltiplos operadores em lote' })
  removeTags(@Body() dto: RemoveTagsDto) {
    return this.rosteringService.removeTagsFromOperators(dto.operatorIds, dto.tagKeys);
  }

  // ─── REGRAS DE ROSTERING ──────────────────────────────────────────────

  @Post('rules')
  @ApiOperation({ summary: 'Criar nova regra de rostering' })
  createRule(@Body() dto: CreateRosteringRuleDto, @Request() req: AuthRequest) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId, req.user?.role);
    return this.rosteringService.createRule(dto);
  }

  @Get('rules')
  @ApiOperation({ summary: 'Listar todas as regras de rostering' })
  @ApiQuery({ name: 'companyId', required: false })
  findAllRules(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.rosteringService.findAllRules(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get('rules/active')
  @ApiOperation({ summary: 'Listar apenas regras ativas' })
  @ApiQuery({ name: 'companyId', required: false })
  findActiveRules(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.rosteringService.findActiveRules(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Atualizar regra de rostering' })
  updateRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRosteringRuleDto,
  ) {
    return this.rosteringService.updateRule(id, dto);
  }

  @Patch('rules/:id/toggle')
  @ApiOperation({ summary: 'Ativar/Desativar regra' })
  toggleRule(@Param('id', ParseIntPipe) id: number) {
    return this.rosteringService.toggleRule(id);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Desativar regra (soft delete)' })
  deleteRule(@Param('id', ParseIntPipe) id: number) {
    return this.rosteringService.deleteRule(id);
  }

  // ─── EXECUÇÃO DO ROSTERING ────────────────────────────────────────────

  @Post('run')
  @ApiOperation({
    summary: 'Executar Rostering Nominal',
    description:
      'Busca operadores e regras do banco, monta o payload e envia para o motor Python. ' +
      'Requer um optimization_run COMPLETED para extrair os duties.',
  })
  runRostering(@Body() dto: RunRosteringDto, @Request() req: AuthRequest) {
    const companyId = resolveScopedCompanyId(
      req.user?.companyId,
      dto.companyId,
      req.user?.role,
    );
    return this.integrationService.executeRostering(
      dto.operatorIds,
      dto.optimizationRunId,
      companyId,
      dto.interShiftRestMinutes ?? 660,
    );
  }
}
