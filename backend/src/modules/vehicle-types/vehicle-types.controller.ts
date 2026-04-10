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

@ApiTags('vehicle-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicle-types')
export class VehicleTypesController {
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar tipo de veículo' })
  create(@Body() dto: CreateVehicleTypeDto) {
    return this.vehicleTypesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tipos de veículo' })
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Query('companyId') companyId?: string) {
    return this.vehicleTypesService.findAll(companyId ? +companyId : undefined);
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
