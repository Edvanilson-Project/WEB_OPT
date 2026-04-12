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
} from '@nestjs/swagger';
import { PassengerConfigsService } from './passenger-configs.service';
import {
  CreatePassengerConfigDto,
  SavePassengerBandDto,
} from './dto/create-passenger-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('passenger-configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('passenger-configs')
export class PassengerConfigsController {
  constructor(private readonly service: PassengerConfigsService) {}

  @Post()
  create(@Body() dto: CreatePassengerConfigDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.service.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/bands')
  getBands(@Param('id', ParseIntPipe) id: number) {
    return this.service.getBands(id);
  }

  @Post(':id/bands')
  saveBands(
    @Param('id', ParseIntPipe) id: number,
    @Body() dtos: SavePassengerBandDto[],
  ) {
    return this.service.saveBands(id, dtos);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreatePassengerConfigDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
