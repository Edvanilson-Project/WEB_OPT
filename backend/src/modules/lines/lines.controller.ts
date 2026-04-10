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
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { LinesService } from './lines.service';
import { CreateLineDto } from './dto/create-line.dto';
import { UpdateLineDto } from './dto/update-line.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('lines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lines')
export class LinesController {
  constructor(private readonly linesService: LinesService) {}

  @Post()
  create(@Body() dto: CreateLineDto) {
    return this.linesService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  findAll(@Query('companyId') companyId?: string) {
    return this.linesService.findAll(companyId ? +companyId : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.linesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLineDto) {
    return this.linesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.linesService.remove(id);
  }
}
