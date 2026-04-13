import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
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
import { OptimizationService } from './optimization.service';
import { RunOptimizationDto } from './dto/run-optimization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('optimization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ANALYST)
@Controller('optimization')
export class OptimizationController {
  constructor(private readonly optimizationService: OptimizationService) {}

  @Post('run')
  @ApiOperation({ summary: 'Iniciar nova execução de otimização VSP+CSP' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ANALYST)
  run(@Body() dto: RunOptimizationDto, @Request() req: AuthRequest) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId, req.user?.role);
    return this.optimizationService.startOptimization(dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar execuções de otimização' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.optimizationService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get('dashboard/:companyId')
  @ApiOperation({ summary: 'Estatísticas do dashboard de otimização' })
  getDashboard(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Request() req: AuthRequest,
  ) {
    return this.optimizationService.getDashboardStats(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'Auditoria completa de uma execução' })
  audit(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.optimizationService.getRunAudit(id, req.user?.companyId);
  }

  @Get(':id/compare/:otherId')
  @ApiOperation({ summary: 'Comparar duas execuções de otimização' })
  compare(
    @Param('id', ParseIntPipe) id: number,
    @Param('otherId', ParseIntPipe) otherId: number,
    @Request() req: AuthRequest,
  ) {
    return this.optimizationService.compareRuns(
      id,
      otherId,
      req.user?.companyId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma execução' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.optimizationService.findOne(id, req.user?.companyId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar execução em andamento' })
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.optimizationService.cancel(id, req.user?.companyId);
  }

  @Post('evaluate-delta')
  @ApiOperation({ summary: 'Recálculo what-if após rearranjo de trips no Gantt' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.ANALYST)
  evaluateDelta(@Body() body: any, @Request() req: AuthRequest) {
    const companyId = resolveScopedCompanyId(req.user?.companyId, body?.companyId, req.user?.role);
    return this.optimizationService.evaluateDelta(body, companyId);
  }
}
