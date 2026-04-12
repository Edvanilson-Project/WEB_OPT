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
import { CrewShiftsService } from './crew-shifts.service';
import { CreateCrewShiftDto } from './dto/create-crew-shift.dto';
import { UpdateCrewShiftDto } from './dto/update-crew-shift.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ShiftStatus } from './entities/crew-shift.entity';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('crew-shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crew-shifts')
export class CrewShiftsController {
  constructor(private readonly crewShiftsService: CrewShiftsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar turno de tripulação' })
  @ApiResponse({ status: 201, description: 'Turno criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(@Body() dto: CreateCrewShiftDto, @Request() req: AuthRequest) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId, req.user?.role);
    return this.crewShiftsService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplos turnos de uma vez' })
  @ApiResponse({ status: 201, description: 'Turnos criados com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  createBulk(@Body() dtos: CreateCrewShiftDto[], @Request() req: AuthRequest) {
    const scopedCompanyId = resolveScopedCompanyId(
      req.user?.companyId,
      dtos[0]?.companyId,
      req.user?.role,
    );
    dtos.forEach((dto) => {
      dto.companyId = resolveScopedCompanyId(scopedCompanyId, dto.companyId, req.user?.role);
    });
    return this.crewShiftsService.createBulk(dtos);
  }

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'optimizationRunId', required: false })
  @ApiQuery({ name: 'lineId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOperation({ summary: 'Listar todos os turnos' })
  findAll(
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
    @Query('optimizationRunId') optimizationRunId?: string,
    @Query('lineId') lineId?: string,
    @Query('status') status?: string,
  ) {
    return this.crewShiftsService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
      optimizationRunId ? +optimizationRunId : undefined,
      lineId ? +lineId : undefined,
      status,
    );
  }

  @Get('optimization-run/:optimizationRunId')
  @ApiOperation({ summary: 'Listar turnos por execução de otimização' })
  findByOptimizationRun(
    @Param('optimizationRunId', ParseIntPipe) optimizationRunId: number,
  ) {
    return this.crewShiftsService.findByOptimizationRun(optimizationRunId);
  }

  @Get('vehicle-route/:vehicleRouteId')
  @ApiOperation({ summary: 'Listar turnos por rota de veículo' })
  findByVehicleRoute(
    @Param('vehicleRouteId', ParseIntPipe) vehicleRouteId: number,
  ) {
    return this.crewShiftsService.findByVehicleRoute(vehicleRouteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter um turno pelo ID' })
  @ApiResponse({ status: 200, description: 'Turno encontrado' })
  @ApiResponse({ status: 404, description: 'Turno não encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.crewShiftsService.findOne(id, req.user?.companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar um turno' })
  @ApiResponse({ status: 200, description: 'Turno atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Turno não encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCrewShiftDto,
    @Request() req: AuthRequest,
  ) {
    return this.crewShiftsService.update(id, dto, req.user?.companyId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status de um turno' })
  @ApiQuery({ name: 'status', required: true, enum: ShiftStatus })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Query('status', new ParseEnumPipe(ShiftStatus)) status: ShiftStatus,
    @Request() req: AuthRequest,
  ) {
    return this.crewShiftsService.updateStatus(id, status, req.user?.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover um turno' })
  @ApiResponse({ status: 204, description: 'Turno removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Turno não encontrado' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.crewShiftsService.remove(id, req.user?.companyId);
  }
}
