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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiQuery,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { TripsImportService } from './trips-import.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trips')
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly tripsImportService: TripsImportService,
  ) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importar viagens via CSV/Excel' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async importTrips(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthRequest,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    
    // O companyId é extraído do token JWT (Contexto Multi-Tenant)
    return this.tripsImportService.importFromBuffer(file.buffer, req.user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar viagem' })
  create(@Body() dto: CreateTripDto, @Request() req: AuthRequest) {
    dto.companyId = resolveScopedCompanyId(req.user?.companyId, dto.companyId, req.user?.role);
    return this.tripsService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplas viagens de uma vez' })
  createBulk(@Body() dtos: CreateTripDto[], @Request() req: AuthRequest) {
    const scopedCompanyId = resolveScopedCompanyId(
      req.user?.companyId,
      dtos[0]?.companyId,
      req.user?.role,
    );
    dtos.forEach((dto) => {
      dto.companyId = resolveScopedCompanyId(scopedCompanyId, dto.companyId, req.user?.role);
    });
    return this.tripsService.createBulk(dtos);
  }

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'lineId', required: false })
  findAll(
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
    @Query('lineId') lineId?: string,
  ) {
    return this.tripsService.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
      lineId ? +lineId : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.tripsService.findOne(id, req.user?.companyId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTripDto,
    @Request() req: AuthRequest,
  ) {
    return this.tripsService.update(id, dto, req.user?.companyId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.tripsService.remove(id, req.user?.companyId);
  }
}
