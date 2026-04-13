import { describe, expect, it } from 'vitest';
import {
  buildAlgorithmAuditRows,
  buildAlgorithmBenchmarks,
  buildHistoricalSummary,
  buildHistoryPoints,
  buildOperationalBaseline,
  normalizeDashboardStats,
  normalizeKpiData,
  normalizeOptimizationRuns,
} from '../_helpers/run-history';

describe('run-history helpers', () => {
  it('normaliza aliases do backend para campos padronizados de execução', () => {
    const [run] = normalizeOptimizationRuns([
      {
        id: 42,
        status: 'completed',
        algorithm: 'greedy',
        line_id: 16,
        line_ids: [16, 21],
        schedule_id: 7,
        profile_id: 4,
        profile_name: 'Perfil Expresso',
        operation_mode: 'urban',
        createdAt: '2026-04-10T08:00:00.000Z',
        vehicles: 9,
        crew: 18,
        cost: '18250.40',
        duration: 8450,
      },
    ]);

    expect(run.id).toBe(42);
    expect(run.totalVehicles).toBe(9);
    expect(run.totalCrew).toBe(18);
    expect(run.totalCost).toBe(18250.4);
    expect(run.durationMs).toBe(8450);
    expect(run.algorithm).toBe('greedy');
    expect(run.lineId).toBe(16);
    expect(run.lineIds).toEqual([16, 21]);
    expect(run.scheduleId).toBe(7);
    expect(run.profileId).toBe(4);
    expect(run.profileName).toBe('Perfil Expresso');
    expect(run.operationMode).toBe('urban');
  });

  it('extrai métricas operacionais da resultSummary para pontos históricos', () => {
    const [point] = buildHistoryPoints(normalizeOptimizationRuns([
      {
        id: 77,
        status: 'completed',
        algorithm: 'hybrid_pipeline',
        lineId: 12,
        lineIds: [12, 18],
        scheduleId: 31,
        operationMode: 'charter',
        createdAt: '2026-04-11T09:00:00.000Z',
        totalVehicles: 11,
        totalCrew: 24,
        totalCost: 30120,
        durationMs: 15000,
        params: {
          settingsSnapshot: {
            id: 9,
            name: 'Perfil Pico Manhã',
          },
        },
        resultSummary: {
          cct_violations: 2,
          unassigned_trips: [{ id: 1 }],
          solverExplanation: {
            issues: {
              soft: [{ code: 'MEAL_BREAK_MISSING' }, { code: 'SPREAD_WARNING' }],
            },
          },
          tripGroupAudit: {
            same_roster_ratio: 0.96,
          },
        },
      },
    ]));

    expect(point.cctViolations).toBe(2);
    expect(point.softIssues).toBe(2);
    expect(point.unassignedTrips).toBe(1);
    expect(point.sameRosterRatio).toBe(0.96);
    expect(point.lineId).toBe(12);
    expect(point.lineIds).toEqual([12, 18]);
    expect(point.scheduleId).toBe(31);
    expect(point.profileId).toBe(9);
    expect(point.profileName).toBe('Perfil Pico Manhã');
    expect(point.operationMode).toBe('charter');
  });

  it('calcula resumo histórico e tendências com melhora de custo e limpeza operacional', () => {
    const points = buildHistoryPoints(normalizeOptimizationRuns([
      {
        id: 1,
        status: 'completed',
        algorithm: 'hybrid_pipeline',
        createdAt: '2026-04-01T08:00:00.000Z',
        totalVehicles: 12,
        totalCrew: 25,
        totalCost: 12000,
        durationMs: 12000,
        cctViolations: 1,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.92 } },
      },
      {
        id: 2,
        status: 'completed',
        algorithm: 'hybrid_pipeline',
        createdAt: '2026-04-02T08:00:00.000Z',
        totalVehicles: 11,
        totalCrew: 23,
        totalCost: 10000,
        durationMs: 10000,
        cctViolations: 0,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.95 } },
      },
      {
        id: 3,
        status: 'completed',
        algorithm: 'greedy',
        createdAt: '2026-04-03T08:00:00.000Z',
        totalVehicles: 10,
        totalCrew: 21,
        totalCost: 8000,
        durationMs: 9000,
        cctViolations: 0,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.98 } },
      },
      {
        id: 4,
        status: 'completed',
        algorithm: 'greedy',
        createdAt: '2026-04-04T08:00:00.000Z',
        totalVehicles: 10,
        totalCrew: 20,
        totalCost: 9000,
        durationMs: 8000,
        cctViolations: 0,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.99 } },
      },
    ]));

    const summary = buildHistoricalSummary(points);

    expect(summary.totalRuns).toBe(4);
    expect(summary.completedRuns).toBe(4);
    expect(summary.cleanRunRate).toBe(75);
    expect(summary.avgSameRosterRatio).toBeCloseTo(0.96, 2);
    expect(summary.bestCostRun?.runId).toBe(3);
    expect(summary.trends.avgCost).toBeGreaterThan(0);
    expect(summary.trends.avgDurationMs).toBeGreaterThan(0);
    expect(summary.trends.cleanRunRate).toBeGreaterThan(0);
  });

  it('normaliza snapshots de dashboard e KPI com campos opcionais do backend', () => {
    const dashboard = normalizeDashboardStats({
      totalRuns: 18,
      completedRuns: 15,
      total_lines: 9,
      total_terminals: 4,
      totalVehicleTypes: 3,
      lastOptimization: {
        id: 88,
        date: '2026-04-12T10:00:00.000Z',
        vehicles: 10,
        crew: 22,
        cost: '45200.50',
        cctViolations: 0,
      },
    });
    const kpis = normalizeKpiData({
      totalRuns: 18,
      completedRuns: 15,
      failedRuns: 3,
      avgVehicles: 10.5,
      avgCrew: 21.2,
      avgCost: 43800,
      avgDurationMs: 13500,
      successRate: '83.3',
    });

    expect(dashboard.totalLines).toBe(9);
    expect(dashboard.totalTerminals).toBe(4);
    expect(dashboard.totalOptimizationRuns).toBe(18);
    expect(dashboard.lastOptimization?.cost).toBe(45200.5);
    expect(kpis.failedRuns).toBe(3);
    expect(kpis.successRate).toBe(83.3);
  });

  it('gera benchmark por algoritmo com score operacional e ordenacao por qualidade', () => {
    const points = buildHistoryPoints(normalizeOptimizationRuns([
      {
        id: 10,
        status: 'completed',
        algorithm: 'hybrid_pipeline',
        createdAt: '2026-04-01T08:00:00.000Z',
        totalVehicles: 11,
        totalCrew: 24,
        totalCost: 15000,
        durationMs: 12000,
        cctViolations: 0,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.98 } },
      },
      {
        id: 11,
        status: 'completed',
        algorithm: 'hybrid_pipeline',
        createdAt: '2026-04-02T08:00:00.000Z',
        totalVehicles: 10,
        totalCrew: 22,
        totalCost: 14200,
        durationMs: 11000,
        cctViolations: 0,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.99 } },
      },
      {
        id: 12,
        status: 'completed',
        algorithm: 'greedy',
        createdAt: '2026-04-03T08:00:00.000Z',
        totalVehicles: 12,
        totalCrew: 25,
        totalCost: 16000,
        durationMs: 8000,
        cctViolations: 2,
        resultSummary: {
          warnings: ['MEAL_BREAK_MISSING'],
          tripGroupAudit: { same_roster_ratio: 0.9 },
        },
      },
      {
        id: 13,
        status: 'failed',
        algorithm: 'greedy',
        createdAt: '2026-04-04T08:00:00.000Z',
      },
    ]));

    const benchmarks = buildAlgorithmBenchmarks(points);

    expect(benchmarks).toHaveLength(2);
    expect(benchmarks[0].algorithm).toBe('hybrid_pipeline');
    expect(benchmarks[0].successRate).toBe(100);
    expect(benchmarks[0].cleanRunRate).toBe(100);
    expect(benchmarks[0].bestRun?.runId).toBe(11);
    expect(benchmarks[0].operationalScore).toBeGreaterThan(benchmarks[1].operationalScore ?? 0);
    expect(benchmarks[1].failedRuns).toBe(1);
    expect(benchmarks[1].avgSoftIssues).toBe(1);
  });

  it('gera auditoria por algoritmo contra o baseline operacional do periodo', () => {
    const points = buildHistoryPoints(normalizeOptimizationRuns([
      {
        id: 20,
        status: 'completed',
        algorithm: 'hybrid_pipeline',
        createdAt: '2026-04-05T08:00:00.000Z',
        totalVehicles: 10,
        totalCrew: 21,
        totalCost: 10000,
        durationMs: 10000,
        cctViolations: 0,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.99 } },
      },
      {
        id: 21,
        status: 'completed',
        algorithm: 'hybrid_pipeline',
        createdAt: '2026-04-06T08:00:00.000Z',
        totalVehicles: 10,
        totalCrew: 20,
        totalCost: 9800,
        durationMs: 9200,
        cctViolations: 0,
        resultSummary: { tripGroupAudit: { same_roster_ratio: 0.98 } },
      },
      {
        id: 22,
        status: 'completed',
        algorithm: 'greedy',
        createdAt: '2026-04-07T08:00:00.000Z',
        totalVehicles: 12,
        totalCrew: 25,
        totalCost: 14000,
        durationMs: 8000,
        cctViolations: 2,
        resultSummary: {
          warnings: ['MEAL_BREAK_MISSING', 'SPREAD_WARNING'],
          tripGroupAudit: { same_roster_ratio: 0.91 },
        },
      },
      {
        id: 23,
        status: 'failed',
        algorithm: 'greedy',
        createdAt: '2026-04-08T08:00:00.000Z',
      },
    ]));

    const baseline = buildOperationalBaseline(points);
    const audit = buildAlgorithmAuditRows(points);

    expect(baseline.completedRuns).toBe(3);
    expect(baseline.avgCost).toBeCloseTo(11266.67, 1);
    expect(audit.rows).toHaveLength(2);
    expect(audit.rows[0].algorithm).toBe('hybrid_pipeline');
    expect(audit.rows[0].baselineTag).toBe('above');
    expect(audit.rows[0].costDeltaPct).toBeLessThan(0);
    expect(audit.rows[0].operationalScoreGap).toBeGreaterThan(0);
    expect(audit.rows[1].algorithm).toBe('greedy');
    expect(audit.rows[1].baselineTag).toBe('below');
    expect(audit.rows[1].softIssuesGap).toBeGreaterThan(0);
    expect(audit.rows[1].cctGap).toBeGreaterThan(0);
  });
});