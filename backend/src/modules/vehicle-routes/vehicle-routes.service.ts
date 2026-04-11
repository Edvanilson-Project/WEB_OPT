import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VehicleRouteEntity,
  VehicleRouteStatus,
} from './entities/vehicle-route.entity';
import { CreateVehicleRouteDto } from './dto/create-vehicle-route.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class VehicleRoutesService {
  constructor(
    @InjectRepository(VehicleRouteEntity)
    private readonly vehicleRouteRepo: Repository<VehicleRouteEntity>,
  ) {}

  async create(dto: CreateVehicleRouteDto): Promise<VehicleRouteEntity> {
    const vehicleRoute = this.vehicleRouteRepo.create(dto);
    return this.vehicleRouteRepo.save(vehicleRoute);
  }

  async createBulk(
    dtos: CreateVehicleRouteDto[],
  ): Promise<VehicleRouteEntity[]> {
    const vehicleRoutes = dtos.map((dto) => this.vehicleRouteRepo.create(dto));
    return this.vehicleRouteRepo.save(vehicleRoutes);
  }

  async findAll(
    companyId?: number,
    optimizationRunId?: number,
    lineId?: number,
    status?: string,
  ): Promise<VehicleRouteEntity[]> {
    if (!companyId) throw new BadRequestException('companyId é obrigatório');

    const where: any = { companyId };
    if (optimizationRunId) where.optimizationRunId = optimizationRunId;
    if (lineId) where.lineId = lineId;
    if (status) where.status = status;

    return this.vehicleRouteRepo.find({
      where,
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findByOptimizationRun(
    optimizationRunId: number,
  ): Promise<VehicleRouteEntity[]> {
    return this.vehicleRouteRepo.find({
      where: { optimizationRunId },
      order: { startTimeMinutes: 'ASC' },
    });
  }

  async findOne(id: number, companyId?: number): Promise<VehicleRouteEntity> {
    const where: Record<string, number> =
      companyId != null ? { id, companyId } : { id };
    const vehicleRoute = await this.vehicleRouteRepo.findOne({ where });
    if (!vehicleRoute) throw new EntityNotFoundException('Rota de veículo', id);
    return vehicleRoute;
  }

  async update(
    id: number,
    dto: Partial<CreateVehicleRouteDto>,
    companyId?: number,
  ): Promise<VehicleRouteEntity> {
    const vehicleRoute = await this.findOne(id, companyId);
    Object.assign(vehicleRoute, dto);
    return this.vehicleRouteRepo.save(vehicleRoute);
  }

  async remove(id: number, companyId?: number): Promise<void> {
    const vehicleRoute = await this.findOne(id, companyId);
    await this.vehicleRouteRepo.remove(vehicleRoute);
  }

  async updateStatus(
    id: number,
    status: string,
    companyId?: number,
  ): Promise<VehicleRouteEntity> {
    const vehicleRoute = await this.findOne(id, companyId);
    vehicleRoute.status = status as any;
    return this.vehicleRouteRepo.save(vehicleRoute);
  }

  async calculateTotalCost(optimizationRunId: number): Promise<number> {
    const routes = await this.vehicleRouteRepo.find({
      where: { optimizationRunId },
    });
    return routes.reduce(
      (total, route) => total + (route.estimatedCost || 0),
      0,
    );
  }
}
