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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OptimizationSettingsService } from './optimization-settings.service';
import { CreateOptimizationSettingsDto } from './dto/create-optimization-settings.dto';
import { UpdateOptimizationSettingsDto } from './dto/update-optimization-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('optimization-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('optimization-settings')
export class OptimizationSettingsController {
  constructor(private readonly service: OptimizationSettingsService) {}

  @Get()
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId ? +companyId : 1);
  }

  @Get('active')
  findActive(@Query('companyId') companyId: string) {
    return this.service.findActive(companyId ? +companyId : 1);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId') companyId: string,
  ) {
    return this.service.findOne(id, companyId ? +companyId : 1);
  }

  @Post()
  create(
    @Body() dto: CreateOptimizationSettingsDto,
    @Query('companyId') companyId: string,
  ) {
    return this.service.create(companyId ? +companyId : 1, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOptimizationSettingsDto,
    @Query('companyId') companyId: string,
  ) {
    return this.service.update(id, companyId ? +companyId : 1, dto);
  }

  @Patch(':id/activate')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId') companyId: string,
  ) {
    return this.service.setActive(id, companyId ? +companyId : 1);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId') companyId: string,
  ) {
    return this.service.remove(id, companyId ? +companyId : 1);
  }
}
