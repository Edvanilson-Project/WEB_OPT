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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OptimizationSettingsService } from './optimization-settings.service';
import { CreateOptimizationSettingsDto } from './dto/create-optimization-settings.dto';
import { UpdateOptimizationSettingsDto } from './dto/update-optimization-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';
import { AuthRequest } from '../../common/interfaces/auth.interface';

@ApiTags('optimization-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('optimization-settings')
export class OptimizationSettingsController {
  constructor(private readonly service: OptimizationSettingsService) {}

  @Get()
  findAll(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.service.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get('active')
  findActive(@Request() req: AuthRequest, @Query('companyId') companyId?: string) {
    return this.service.findActive(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.findOne(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Post()
  create(
    @Body() dto: CreateOptimizationSettingsDto,
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.create(
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
      dto,
      req.user?.role,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOptimizationSettingsDto,
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.update(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
      dto,
      req.user?.role,
    );
  }

  @Patch(':id/activate')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.setActive(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthRequest,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.remove(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId, req.user?.role),
    );
  }
}
