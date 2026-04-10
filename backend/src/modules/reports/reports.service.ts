import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  OptimizationRunEntity,
  OptimizationStatus,
} from '../optimization/entities/optimization-run.entity';
import { TripEntity } from '../trips/entities/trip.entity';
import { LineEntity } from '../lines/entities/line.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OptimizationRunEntity)
    private readonly runRepo: Repository<OptimizationRunEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepo: Repository<TripEntity>,
    @InjectRepository(LineEntity)
    private readonly lineRepo: Repository<LineEntity>,
  ) {}

  async getKpisByCompany(companyId: number) {
    const [totalRuns, completedRuns, failedRuns] = await Promise.all([
      this.runRepo.count({ where: { companyId } }),
      this.runRepo.count({
        where: { companyId, status: OptimizationStatus.COMPLETED },
      }),
      this.runRepo.count({
        where: { companyId, status: OptimizationStatus.FAILED },
      }),
    ]);

    const lastCompleted = await this.runRepo.findOne({
      where: { companyId, status: OptimizationStatus.COMPLETED },
      order: { finishedAt: 'DESC' },
    });

    const totalTrips = await this.tripRepo.count({
      where: { companyId, isActive: true },
    });
    const totalLines = await this.lineRepo.count({ where: { companyId } });

    return {
      totalRuns,
      completedRuns,
      failedRuns,
      successRate:
        totalRuns > 0 ? ((completedRuns / totalRuns) * 100).toFixed(1) : '0',
      totalTrips,
      totalLines,
      lastOptimization: lastCompleted
        ? {
            id: lastCompleted.id,
            date: lastCompleted.finishedAt,
            vehicles: lastCompleted.totalVehicles,
            crew: lastCompleted.totalCrew,
            cost: lastCompleted.totalCost,
            cctViolations: lastCompleted.cctViolations,
          }
        : null,
    };
  }

  async getOptimizationHistory(companyId: number, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.runRepo.find({
      where: { companyId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async compareOptimizations(runId1: number, runId2: number) {
    const [run1, run2] = await Promise.all([
      this.runRepo.findOne({ where: { id: runId1 } }),
      this.runRepo.findOne({ where: { id: runId2 } }),
    ]);

    if (!run1 || !run2) {
      const missing = !run1 ? runId1 : runId2;
      throw new NotFoundException(
        `Optimization run #${missing} não encontrada`,
      );
    }

    return {
      run1: {
        id: run1.id,
        vehicles: run1.totalVehicles,
        crew: run1.totalCrew,
        cost: run1.totalCost,
        violations: run1.cctViolations,
      },
      run2: {
        id: run2.id,
        vehicles: run2.totalVehicles,
        crew: run2.totalCrew,
        cost: run2.totalCost,
        violations: run2.cctViolations,
      },
      delta: {
        vehicles: (run2.totalVehicles || 0) - (run1.totalVehicles || 0),
        crew: (run2.totalCrew || 0) - (run1.totalCrew || 0),
        cost: (Number(run2.totalCost) || 0) - (Number(run1.totalCost) || 0),
        violations: (run2.cctViolations || 0) - (run1.cctViolations || 0),
      },
    };
  }
}
