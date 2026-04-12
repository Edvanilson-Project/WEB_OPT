import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('kpis/:companyId')
  @ApiOperation({ summary: 'KPIs gerais da empresa' })
  getKpis(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Request() req: AuthRequest,
  ) {
    return this.reportsService.getKpisByCompany(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get('history/:companyId')
  @ApiOperation({ summary: 'Histórico de otimizações' })
  @ApiQuery({ name: 'days', required: false })
  getHistory(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Request() req: AuthRequest,
    @Query('days') days?: string,
  ) {
    return this.reportsService.getOptimizationHistory(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
      days ? +days : 30,
    );
  }

  @Get('compare')
  @ApiOperation({ summary: 'Comparar duas execuções de otimização' })
  @ApiQuery({ name: 'run1', required: true })
  @ApiQuery({ name: 'run2', required: true })
  compare(
    @Query('run1', ParseIntPipe) run1: number,
    @Query('run2', ParseIntPipe) run2: number,
  ) {
    return this.reportsService.compareOptimizations(run1, run2);
  }
}
