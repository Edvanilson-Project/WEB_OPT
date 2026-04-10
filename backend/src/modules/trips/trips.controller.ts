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
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar viagem' })
  create(@Body() dto: CreateTripDto, @Request() req: any) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId);
    return this.tripsService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplas viagens de uma vez' })
  createBulk(@Body() dtos: CreateTripDto[], @Request() req: any) {
    const scopedCompanyId = resolveScopedCompanyId(
      req.user?.companyId,
      dtos[0]?.companyId,
    );
    dtos.forEach((dto) => {
      dto.companyId = resolveScopedCompanyId(scopedCompanyId, dto.companyId);
    });
    return this.tripsService.createBulk(dtos);
  }

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'lineId', required: false })
  findAll(
    @Request() req: any,
    @Query('companyId') companyId?: string,
    @Query('lineId') lineId?: string,
  ) {
    return this.tripsService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId),
      lineId ? +lineId : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.tripsService.findOne(id, req.user?.companyId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTripDto,
    @Request() req: any,
  ) {
    return this.tripsService.update(id, dto, req.user?.companyId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.tripsService.remove(id, req.user?.companyId);
  }
}
