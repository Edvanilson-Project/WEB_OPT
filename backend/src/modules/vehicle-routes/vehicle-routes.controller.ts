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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiQuery,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { VehicleRoutesService } from './vehicle-routes.service';
import { CreateVehicleRouteDto } from './dto/create-vehicle-route.dto';
import { UpdateVehicleRouteDto } from './dto/update-vehicle-route.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';

@ApiTags('vehicle-routes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicle-routes')
export class VehicleRoutesController {
  constructor(private readonly vehicleRoutesService: VehicleRoutesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar rota de veículo' })
  @ApiResponse({ status: 201, description: 'Rota criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(@Body() dto: CreateVehicleRouteDto, @Request() req: any) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId);
    return this.vehicleRoutesService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplas rotas de uma vez' })
  @ApiResponse({ status: 201, description: 'Rotas criadas com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  createBulk(@Body() dtos: CreateVehicleRouteDto[], @Request() req: any) {
    const scopedCompanyId = resolveScopedCompanyId(
      req.user?.companyId,
      dtos[0]?.companyId,
    );
    dtos.forEach((dto) => {
      dto.companyId = resolveScopedCompanyId(scopedCompanyId, dto.companyId);
    });
    return this.vehicleRoutesService.createBulk(dtos);
  }

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'optimizationRunId', required: false })
  @ApiQuery({ name: 'lineId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOperation({ summary: 'Listar todas as rotas' })
  findAll(
    @Request() req: any,
    @Query('companyId') companyId?: string,
    @Query('optimizationRunId') optimizationRunId?: string,
    @Query('lineId') lineId?: string,
    @Query('status') status?: string,
  ) {
    return this.vehicleRoutesService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId),
      optimizationRunId ? +optimizationRunId : undefined,
      lineId ? +lineId : undefined,
      status,
    );
  }

  @Get('optimization-run/:optimizationRunId')
  @ApiOperation({ summary: 'Listar rotas por execução de otimização' })
  findByOptimizationRun(
    @Param('optimizationRunId', ParseIntPipe) optimizationRunId: number,
  ) {
    return this.vehicleRoutesService.findByOptimizationRun(optimizationRunId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter uma rota pelo ID' })
  @ApiResponse({ status: 200, description: 'Rota encontrada' })
  @ApiResponse({ status: 404, description: 'Rota não encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.vehicleRoutesService.findOne(id, req.user?.companyId);
  }

  @Get(':optimizationRunId/total-cost')
  @ApiOperation({
    summary: 'Calcular custo total de todas as rotas de uma execução',
  })
  calculateTotalCost(
    @Param('optimizationRunId', ParseIntPipe) optimizationRunId: number,
  ) {
    return this.vehicleRoutesService.calculateTotalCost(optimizationRunId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma rota' })
  @ApiResponse({ status: 200, description: 'Rota atualizada com sucesso' })
  @ApiResponse({ status: 404, description: 'Rota não encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleRouteDto,
    @Request() req: any,
  ) {
    return this.vehicleRoutesService.update(id, dto, req.user?.companyId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status de uma rota' })
  @ApiQuery({ name: 'status', required: true })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status: string,
    @Request() req: any,
  ) {
    return this.vehicleRoutesService.updateStatus(
      id,
      status,
      req.user?.companyId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover uma rota' })
  @ApiResponse({ status: 204, description: 'Rota removida com sucesso' })
  @ApiResponse({ status: 404, description: 'Rota não encontrada' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.vehicleRoutesService.remove(id, req.user?.companyId);
  }
}
