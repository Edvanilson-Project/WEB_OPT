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
import { resolveScopedCompanyId } from '../../common/utils/company-scope.util';

@ApiTags('optimization-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('optimization-settings')
export class OptimizationSettingsController {
  constructor(private readonly service: OptimizationSettingsService) {}

  @Get()
  findAll(@Request() req: any, @Query('companyId') companyId?: string) {
    return this.service.findAll(
      resolveScopedCompanyId(req.user?.companyId, companyId),
    );
  }

  @Get('active')
  findActive(@Request() req: any, @Query('companyId') companyId?: string) {
    return this.service.findActive(
      resolveScopedCompanyId(req.user?.companyId, companyId),
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.findOne(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId),
    );
  }

  @Post()
  create(
    @Body() dto: CreateOptimizationSettingsDto,
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.create(
      resolveScopedCompanyId(req.user?.companyId, companyId),
      dto,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOptimizationSettingsDto,
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.update(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId),
      dto,
    );
  }

  @Patch(':id/activate')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.setActive(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId),
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.remove(
      id,
      resolveScopedCompanyId(req.user?.companyId, companyId),
    );
  }
}
