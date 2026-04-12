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
  ParseEnumPipe,
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
import { RolesGuard } from '../../common/guards/roles.guard';
import { VehicleRouteStatus } from './entities/vehicle-route.entity';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('vehicle-routes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicle-routes')
export class VehicleRoutesController {
  constructor(private readonly vehicleRoutesService: VehicleRoutesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar rota de veículo' })
  @ApiResponse({ status: 201, description: 'Rota criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(@Body() dto: CreateVehicleRouteDto, @Request() req: AuthRequest) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId, req.user?.role);
    return this.vehicleRoutesService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplas rotas de uma vez' })
  @ApiResponse({ status: 201, description: 'Rotas criadas com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  createBulk(@Body() dtos: CreateVehicleRouteDto[], @Request() req: AuthRequest) {
    const scopedCompanyId = resolveScopedCompanyId(
      req.user?.companyId,
      dtos[0]?.companyId,
      req.user?.role,
    );
    dtos.forEach((dto) => {
      dto.companyId = resolveScopedCompanyId(scopedCompanyId, dto.companyId, req.user?.role);
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
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
    @Query('optimizationRunId') optimizationRunId?: string,
    @Query('lineId') lineId?: string,
    @Query('status') status?: string,
  ) {
    return this.vehicleRoutesService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
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
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
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
    @Request() req: AuthRequest,
  ) {
    return this.vehicleRoutesService.update(id, dto, req.user?.companyId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status de uma rota' })
  @ApiQuery({ name: 'status', required: true, enum: VehicleRouteStatus })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Query('status', new ParseEnumPipe(VehicleRouteStatus)) status: VehicleRouteStatus,
    @Request() req: AuthRequest,
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
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.vehicleRoutesService.remove(id, req.user?.companyId);
  }
}
