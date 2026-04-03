import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('kpis/:companyId')
  @ApiOperation({ summary: 'KPIs gerais da empresa' })
  getKpis(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.reportsService.getKpisByCompany(companyId);
  }

  @Get('history/:companyId')
  @ApiOperation({ summary: 'Histórico de otimizações' })
  @ApiQuery({ name: 'days', required: false })
  getHistory(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('days') days?: string,
  ) {
    return this.reportsService.getOptimizationHistory(
      companyId,
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
