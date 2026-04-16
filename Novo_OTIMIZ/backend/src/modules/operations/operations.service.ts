import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { TripRepository } from '../database/repositories/operations.repository';
import { DriverRepository } from '../database/repositories/operations.repository';
import { TenantContext } from '../../common/context/tenant-context';

@Injectable()
export class OperationsService {
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly driverRepository: DriverRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async processUpload(fileBuffer: Buffer, type: 'trips' | 'drivers') {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const companyId = this.tenantContext.getCompanyId();
    if (!companyId) throw new BadRequestException('Tenant não identificado');

    if (type === 'trips') {
      return this.processTrips(data, companyId);
    } else {
      return this.processDrivers(data, companyId);
    }
  }

  private async processTrips(data: any[], companyId: number) {
    const tripsToSave = data.map((item) => {
      // Validação básica conforme diretrizes do Módulo 4
      if (!item.tripId || item.startTime === undefined || item.endTime === undefined) {
        throw new BadRequestException('Arquivo inválido: tripId, startTime e endTime são obrigatórios');
      }

      return this.tripRepository.create({
        companyId,
        tripId: Number(item.tripId),
        lineId: Number(item.lineId || 0),
        startTime: Number(item.startTime),
        endTime: Number(item.endTime),
        originId: Number(item.originId || 0),
        destinationId: Number(item.destinationId || 0),
        distanceKm: Number(item.distanceKm || 0),
        duration: Number(item.duration || Number(item.endTime) - Number(item.startTime)),
      });
    });

    // Limpeza opcional: O usuário pode querer resetar a escala antes de um novo upload
    // Por enquanto, apenas adicionamos
    return this.tripRepository.save(tripsToSave);
  }

  private async processDrivers(data: any[], companyId: number) {
    const driversToSave = data.map((item) => {
      if (!item.driverId || !item.name) {
        throw new BadRequestException('Arquivo inválido: driverId e name são obrigatórios');
      }

      return this.driverRepository.create({
        companyId,
        driverId: String(item.driverId),
        name: String(item.name),
        role: String(item.role || 'Motorista'),
        maxHoursPerDay: Number(item.maxHoursPerDay || 480),
        lastShiftEnd: Number(item.lastShiftEnd || 0),
        metadata: item.metadata || {},
      });
    });

    return this.driverRepository.save(driversToSave);
  }

  async getTrips(page: number = 1, limit: number = 100) {
    return this.tripRepository.find({
      skip: (page - 1) * limit,
      take: limit,
      order: { startTime: 'ASC' },
    });
  }

  async getDrivers() {
    return this.driverRepository.find({
        order: { name: 'ASC' }
    });
  }
}
