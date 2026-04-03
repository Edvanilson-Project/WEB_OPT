import {
  Controller,
  Get,
  Post,
  Body,
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
import { OptimizationService } from './optimization.service';
import { RunOptimizationDto } from './dto/run-optimization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('optimization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('optimization')
export class OptimizationController {
  constructor(private readonly optimizationService: OptimizationService) {}

  @Post('run')
  @ApiOperation({ summary: 'Iniciar nova execução de otimização VSP+CSP' })
  run(@Body() dto: RunOptimizationDto, @Request() req: any) {
    return this.optimizationService.startOptimization(dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar execuções de otimização' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Query('companyId') companyId?: string) {
    return this.optimizationService.findAll(
      companyId ? +companyId : undefined,
    );
  }

  @Get('dashboard/:companyId')
  @ApiOperation({ summary: 'Estatísticas do dashboard de otimização' })
  getDashboard(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.optimizationService.getDashboardStats(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma execução' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.optimizationService.findOne(id);
  }

  @Delete(':id/cancel')
  @ApiOperation({ summary: 'Cancelar execução em andamento' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.optimizationService.cancel(id);
  }
}
