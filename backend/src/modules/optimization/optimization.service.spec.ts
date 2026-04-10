import { OptimizationService } from './optimization.service';
import {
  OptimizationAlgorithm,
  OptimizationStatus,
} from './entities/optimization-run.entity';

describe('OptimizationService audit and compare', () => {
  const runRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const tripsService = {
    findAll: jest.fn(),
  };

  const settingsService = {
    findActive: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const service = new OptimizationService(
    runRepo as any,
    tripsService as any,
    settingsService as any,
    configService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    runRepo.update.mockResolvedValue(undefined);
    settingsService.findActive.mockResolvedValue(null);
    configService.get.mockReturnValue('http://localhost:8000');
  });

  it.skip('returns audit payload with versioning and cost breakdown', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 10,
      companyId: 1,
      status: OptimizationStatus.COMPLETED,
      algorithm: OptimizationAlgorithm.HYBRID_PIPELINE,
      lineId: 16,
      lineIds: null,
      createdAt: new Date('2026-04-05T10:00:00Z'),
      startedAt: new Date('2026-04-05T10:00:01Z'),
      finishedAt: new Date('2026-04-05T10:00:10Z'),
      durationMs: 9000,
      totalVehicles: 10,
      totalCrew: 23,
      totalTrips: 88,
      totalCost: 45210,
      cctViolations: 0,
      params: {
        requested: { algorithm: 'hybrid_pipeline' },
        resolved: { algorithm: 'hybrid_pipeline', vsp: { random_seed: 7 } },
        settingsSnapshot: { id: 5, updatedAt: '2026-04-05T09:00:00Z' },
        versioning: {
          ruleHash: 'abc123',
          inputHash: 'def456',
          settingsVersion: 'settings:5:2026-04-05T09:00:00Z',
        },
      },
      resultSummary: {
        warnings: ['warning-1'],
        trip_details: [{ id: 1 }, { id: 2 }],
        cost_breakdown: {
          total: 45210,
          vsp: { total: 30000, idle_cost: 1200 },
          csp: { total: 15210, guaranteed_cost: 880, overtime_cost: 430 },
        },
        solver_explanation: { status: 'feasible' },
        meta: {
          solver_version: '2.0.0',
          performance: { phase_timings_ms: { vsp_greedy_ms: 10.5 } },
          hard_constraint_report: {
            output: {
              ok: true,
              hard_issues: [],
              soft_issues: [],
              counts: { unassigned_trips: 0, uncovered_blocks: 0 },
            },
          },
        },
      },
    });

    const audit = await service.getRunAudit(10);

    expect(audit.versioning.ruleHash).toBe('abc123');
    expect(audit.result.costBreakdown.total).toBe(45210);
    expect(audit.result.costBreakdown.vsp.idle_cost).toBe(1200);
    expect(audit.result.costBreakdown.csp.guaranteed_cost).toBe(880);
    expect(audit.result.costBreakdown.csp.overtime_cost).toBe(430);
    expect(audit.result.tripDetailsCount).toBe(2);
    expect(audit.result.solverExplanation.status).toBe('feasible');
    expect(audit.result.solverVersion).toBe('2.0.0');
    expect(audit.result.performance.phase_timings_ms.vsp_greedy_ms).toBe(10.5);
  });

  it.skip('compares runs with metric, cost and parameter deltas', async () => {
    runRepo.findOne
      .mockResolvedValueOnce({
        id: 21,
        companyId: 1,
        status: OptimizationStatus.COMPLETED,
        algorithm: OptimizationAlgorithm.HYBRID_PIPELINE,
        totalVehicles: 12,
        totalCrew: 24,
        totalTrips: 88,
        totalCost: 48000,
        cctViolations: 1,
        params: {
          resolved: {
            vsp: { max_vehicles: 12 },
            cct: { max_shift_minutes: 480 },
          },
          settingsSnapshot: { fairnessWeight: 0.15 },
          versioning: { ruleHash: 'base-hash' },
        },
        resultSummary: {
          cost_breakdown: {
            total: 48000,
            vsp: { total: 32000, activation: 24000, idle_cost: 1800 },
            csp: {
              total: 16000,
              work_cost: 12000,
              guaranteed_cost: 900,
              overtime_cost: 500,
            },
          },
          meta: {
            hard_constraint_report: {
              output: {
                hard_issues: [],
                soft_issues: ['CONTINUOUS_DRIVING_EXCEEDED D181'],
                counts: { unassigned_trips: 0, uncovered_blocks: 0 },
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        id: 22,
        companyId: 1,
        status: OptimizationStatus.COMPLETED,
        algorithm: OptimizationAlgorithm.HYBRID_PIPELINE,
        totalVehicles: 10,
        totalCrew: 23,
        totalTrips: 88,
        totalCost: 45210,
        cctViolations: 0,
        params: {
          resolved: {
            vsp: { max_vehicles: 10 },
            cct: { max_shift_minutes: 540 },
          },
          settingsSnapshot: { fairnessWeight: 0.1 },
          versioning: { ruleHash: 'other-hash' },
        },
        resultSummary: {
          cost_breakdown: {
            total: 45210,
            vsp: { total: 30000, activation: 20000, idle_cost: 1100 },
            csp: {
              total: 15210,
              work_cost: 11000,
              guaranteed_cost: 650,
              overtime_cost: 320,
            },
          },
          meta: {
            hard_constraint_report: {
              output: {
                hard_issues: [],
                soft_issues: [],
                counts: { unassigned_trips: 0, uncovered_blocks: 0 },
              },
            },
          },
        },
      });

    const comparison = await service.compareRuns(21, 22);

    expect(comparison.summary.betterRunId).toBe(22);
    expect(comparison.metrics.vehicles.delta).toBe(-2);
    expect(comparison.metrics.totalCost.delta).toBe(-2790);
    expect(comparison.costBreakdown.vsp_activation.delta).toBe(-4000);
    expect(comparison.costBreakdown.vsp_idle_cost.delta).toBe(-700);
    expect(comparison.costBreakdown.csp_guaranteed_cost.delta).toBe(-250);
    expect(comparison.costBreakdown.csp_overtime_cost.delta).toBe(-180);
    expect(comparison.paramsDiff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'resolved.cct.max_shift_minutes',
          base: '480',
          other: '540',
        }),
        expect.objectContaining({
          path: 'resolved.vsp.max_vehicles',
          base: '12',
          other: '10',
        }),
      ]),
    );
  });

  it.skip('keeps optimizer diagnostics in failed run audit', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 31,
      companyId: 1,
      status: OptimizationStatus.FAILED,
      algorithm: OptimizationAlgorithm.HYBRID_PIPELINE,
      lineId: 16,
      lineIds: null,
      params: {
        versioning: { ruleHash: 'xyz' },
      },
      resultSummary: {
        diagnostics: { code: 'MANDATORY_GROUP_SPLIT' },
        optimizerDiagnostics: {
          code: 'HARD_CONSTRAINT_VIOLATION',
          phase: 'csp',
          infeasibility_explanation: { reason: 'trip_group_split' },
        },
      },
    });

    const audit = await service.getRunAudit(31);

    expect(audit.result.failureDiagnostics.code).toBe('MANDATORY_GROUP_SPLIT');
    expect(audit.result.optimizerDiagnostics.phase).toBe('csp');
    expect(
      audit.result.optimizerDiagnostics.infeasibility_explanation.reason,
    ).toBe('trip_group_split');
  });

  it.skip('normalizes legacy summary fields when loading a run', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 32,
      companyId: 1,
      status: OptimizationStatus.COMPLETED,
      algorithm: OptimizationAlgorithm.HYBRID_PIPELINE,
      totalCost: 1234,
      params: {
        resolved: {
          cct: {
            max_work_minutes: 480,
          },
        },
      },
      resultSummary: {
        duties: [
          {
            duty_id: 165,
            work_time: 480,
            spread_time: 560,
            work_cost: 240,
            overtime_minutes: 4,
            overtime_cost: 1,
            total_cost: 300,
            meta: {
              source_block_ids: [5, 5, 5],
              task_windows: [
                { block_id: 226917, start: 840, end: 1018 },
                { block_id: 226918, start: 1050, end: 1231 },
                { block_id: 226919, start: 1260, end: 1385 },
              ],
            },
          },
        ],
        blocks: [
          {
            block_id: 5,
            start_time: 400,
            end_time: 1385,
          },
        ],
        total_cost: 1234,
        meta: {
          cost_breakdown: {
            total: 1234,
            vsp: { total: 800, idle_cost: 25 },
            csp: {
              total: 434,
              work_cost: 240,
              overtime_cost: 1,
              duties: [{ duty_id: 165, overtime_cost: 1, total: 300 }],
            },
          },
          solver_explanation: { status: 'feasible' },
          phase_summary: { vsp: { vehicles: 4 } },
          trip_group_audit: { groups_total: 6 },
          reproducibility: { random_seed: 17 },
        },
      },
    });

    const run = await service.findOne(32);

    expect((run.resultSummary as any).cost_breakdown.total).toBe(1253);
    expect((run.resultSummary as any).cost_breakdown.vsp.idle_cost).toBe(25);
    expect((run.resultSummary as any).duties[0].overtime_minutes).toBe(80);
    expect((run.resultSummary as any).duties[0].overtime_cost).toBe(20);
    expect((run.resultSummary as any).duties[0].total_cost).toBe(319);
    expect(
      (run.resultSummary as any).duties[0].meta.task_windows[0].block_id,
    ).toBe(5);
    expect(
      (run.resultSummary as any).duties[0].meta.task_windows[1].block_id,
    ).toBe(5);
    expect(
      (run.resultSummary as any).duties[0].meta.task_windows[2].block_id,
    ).toBe(5);
    expect((run.resultSummary as any).cost_breakdown.csp.overtime_cost).toBe(
      20,
    );
    expect((run.resultSummary as any).cost_breakdown.csp.total).toBe(453);
    expect((run.resultSummary as any).cost_breakdown.total).toBe(1253);
    expect(run.totalCost).toBe(1253);
    expect((run.resultSummary as any).solver_explanation.status).toBe(
      'feasible',
    );
    expect((run.resultSummary as any).phase_summary.vsp.vehicles).toBe(4);
    expect((run.resultSummary as any).trip_group_audit.groups_total).toBe(6);
    expect((run.resultSummary as any).reproducibility.random_seed).toBe(17);
  });





  it('forwards fairness tolerance from dto cspParams to optimizer cct_params', async () => {
    tripsService.findAll.mockResolvedValue([
      {
        id: 1,
        lineId: 16,
        startTimeMinutes: 360,
        endTimeMinutes: 420,
        durationMinutes: 60,
        originTerminalId: 1,
        destinationTerminalId: 2,
        distanceKm: 12,
      },
    ]);

    const optimizerSpy = jest
      .spyOn(service as any, '_callOptimizerService')
      .mockResolvedValue({
        vehicles: 1,
        crew: 1,
        total_cost: 1000,
        cct_violations: 0,
        blocks: [],
        duties: [],
        warnings: [],
        meta: {},
      });
    const saveSpy = jest
      .spyOn(service as any, '_saveResults')
      .mockResolvedValue(undefined);

    await (service as any)._executeOptimization(77, {
      companyId: 1,
      lineId: 16,
      algorithm: OptimizationAlgorithm.HYBRID_PIPELINE,
      cspParams: {
        fairnessToleranceMinutes: 20,
      },
    });

    expect(optimizerSpy).toHaveBeenCalledWith(
      'http://localhost:8000',
      expect.objectContaining({
        cct_params: expect.objectContaining({
          fairness_tolerance_minutes: 20,
        }),
      }),
    );
    expect(saveSpy).toHaveBeenCalled();
  });
});
