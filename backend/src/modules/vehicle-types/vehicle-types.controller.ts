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
  ApiTags,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { VehicleTypesService } from './vehicle-types.service';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('vehicle-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicle-types')
export class VehicleTypesController {
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar tipo de veículo' })
  create(@Body() dto: CreateVehicleTypeDto, @Request() req: AuthRequest) {
    return this.vehicleTypesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tipos de veículo' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.vehicleTypesService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar tipo de veículo por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleTypesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar tipo de veículo' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleTypeDto,
  ) {
    return this.vehicleTypesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir tipo de veículo' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleTypesService.remove(id);
  }
}
