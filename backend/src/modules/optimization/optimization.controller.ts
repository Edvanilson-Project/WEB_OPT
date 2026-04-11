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
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';

@ApiTags('optimization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('optimization')
export class OptimizationController {
  constructor(private readonly optimizationService: OptimizationService) {}

  @Post('run')
  @ApiOperation({ summary: 'Iniciar nova execução de otimização VSP+CSP' })
  run(@Body() dto: RunOptimizationDto, @Request() req: { user: { id: number; companyId: number } }) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId);
    return this.optimizationService.startOptimization(dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar execuções de otimização' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Request() req: { user: { companyId: number } }, @Query('companyId') companyId?: string) {
    return this.optimizationService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId),
    );
  }

  @Get('dashboard/:companyId')
  @ApiOperation({ summary: 'Estatísticas do dashboard de otimização' })
  getDashboard(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Request() req: { user: { companyId: number } },
  ) {
    return this.optimizationService.getDashboardStats(
      resolveScopedCompanyId(req.user?.companyId, companyId),
    );
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'Auditoria completa de uma execução' })
  audit(@Param('id', ParseIntPipe) id: number, @Request() req: { user: { companyId: number } }) {
    return this.optimizationService.getRunAudit(id, req.user?.companyId);
  }

  @Get(':id/compare/:otherId')
  @ApiOperation({ summary: 'Comparar duas execuções de otimização' })
  compare(
    @Param('id', ParseIntPipe) id: number,
    @Param('otherId', ParseIntPipe) otherId: number,
    @Request() req: { user: { companyId: number } },
  ) {
    return this.optimizationService.compareRuns(
      id,
      otherId,
      req.user?.companyId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma execução' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: { user: { companyId: number } }) {
    return this.optimizationService.findOne(id, req.user?.companyId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar execução em andamento' })
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req: { user: { companyId: number } }) {
    return this.optimizationService.cancel(id, req.user?.companyId);
  }
}
