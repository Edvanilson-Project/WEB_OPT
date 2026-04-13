import { describe, it, expect } from 'vitest';
import {
  profileGanttRender,
  profileGanttScalability,
  validatePerformance,
  generatePerformanceReport,
  profileInteractionLatency,
  type PerformanceMetrics,
} from '../_helpers/performance-profiler';

describe('Performance Profiler', () => {
  describe('profileGanttRender', () => {
    it('retorna métricas válidas para 50 blocos', () => {
      const metrics = profileGanttRender(50);

      expect(metrics.blockCount).toBe(50);
      expect(metrics.renderTime).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('renderiza 100 blocos em tempo razoável (<1000ms)', () => {
      const metrics = profileGanttRender(100);

      expect(metrics.renderTime).toBeLessThan(1000);
      expect(metrics.blockCount).toBe(100);
    });

    it('renderiza 500 blocos em tempo aceitável (<2000ms)', () => {
      const metrics = profileGanttRender(500);

      expect(metrics.renderTime).toBeLessThan(2000);
      expect(metrics.blockCount).toBe(500);
    });

    it('renderiza 1000 blocos (stress extremo)', () => {
      const metrics = profileGanttRender(1000);

      expect(metrics.blockCount).toBe(1000);
      expect(metrics.renderTime).toBeGreaterThan(0);
      // Mesmo que demore mais, deve ser finito
      expect(metrics.renderTime).toBeLessThan(10000);
    });
  });

  describe('profileGanttScalability', () => {
    it('perfila múltiplos tamanhos progressivos', () => {
      const counts = [50, 100, 250, 500];
      const profile = profileGanttScalability(counts);

      expect(profile.metrics).toHaveLength(4);
      expect(profile.averageRenderTime).toBeGreaterThan(0);
      expect(profile.maxRenderTime).toBeGreaterThanOrEqual(profile.averageRenderTime);
      expect(profile.minRenderTime).toBeLessThanOrEqual(profile.averageRenderTime);
    });

    it('detecta degradação de performance com crescimento de blocos', () => {
      const counts = [50, 250, 500];
      const profile = profileGanttScalability(counts);

      // Espera-se que tempo aumente com mais blocos
      const times = profile.metrics.map(m => m.renderTime);
      expect(times[2]).toBeGreaterThanOrEqual(times[0]);
    });
  });

  describe('validatePerformance', () => {
    it('passa validação para performance dentro dos limites', () => {
      const metrics: PerformanceMetrics = {
        renderTime: 100,
        blockCount: 100,
        timestamp: Date.now(),
      };

      const result = validatePerformance(metrics, { maxRenderTimeMs: 500 });

      expect(result.pass).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('falha validação para render time fora do limite', () => {
      const metrics: PerformanceMetrics = {
        renderTime: 2000,
        blockCount: 500,
        timestamp: Date.now(),
      };

      const result = validatePerformance(metrics, { maxRenderTimeMs: 1000 });

      expect(result.pass).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('Render time');
    });

    it('falha validação para memory fora do limite', () => {
      const metrics: PerformanceMetrics = {
        renderTime: 100,
        blockCount: 100,
        timestamp: Date.now(),
        memory: {
          used: 600,
          limit: 1000,
        },
      };

      const result = validatePerformance(metrics, { maxMemoryMB: 500 });

      expect(result.pass).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('Memory');
    });

    it('falha validação para interaction latency fora do limite', () => {
      const metrics: PerformanceMetrics = {
        renderTime: 100,
        blockCount: 100,
        timestamp: Date.now(),
        interactionLatency: 300,
      };

      const result = validatePerformance(metrics, { maxInteractionLatencyMs: 200 });

      expect(result.pass).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('Interaction latency');
    });
  });

  describe('generatePerformanceReport', () => {
    it('gera relatório legível para múltiplas configurações', () => {
      const profile = profileGanttScalability([50, 100, 200]);
      const report = generatePerformanceReport(profile);

      expect(report).toContain('Performance Report');
      expect(report).toContain('Blocks: 50');
      expect(report).toContain('Blocks: 100');
      expect(report).toContain('Blocks: 200');
      expect(report).toContain('Average Render Time');
      expect(report).toContain('✓');
    });
  });

  describe('profileInteractionLatency', () => {
    it('mede latência de interação para 100 blocos', () => {
      const latency = profileInteractionLatency(100, 5);

      expect(latency).toBeGreaterThan(0);
      expect(latency).toBeLessThan(1000); // Deve ser rápido
    });

    it('latência sobe com número de blocos', () => {
      const latency50 = profileInteractionLatency(50, 3);
      const latency500 = profileInteractionLatency(500, 3);

      expect(latency500).toBeGreaterThanOrEqual(latency50);
    });
  });

  describe('Extreme scenarios', () => {
    it('suporta 1000 blocos sem crash', () => {
      const metrics = profileGanttRender(1000);
      expect(metrics.blockCount).toBe(1000);
      expect(metrics.renderTime).toBeLessThan(15000);
    });

    it('escalabilidade linear não é pior que O(n²)', () => {
      const m50 = profileGanttRender(50);
      const m200 = profileGanttRender(200); // 4x mais blocos

      // Se fosse O(n²), seria 16x mais lento; esperamos algo entre linear e quadrático
      const timeRatio = m200.renderTime / m50.renderTime;
      const blockRatio = 200 / 50;

      // timeRatio deve estar entre blockRatio e blockRatio²
      expect(timeRatio).toBeGreaterThanOrEqual(blockRatio * 0.5); // ao menos linear
      expect(timeRatio).toBeLessThan(blockRatio ** 2 * 2); // não pior que 2x quadrático
    });
  });
});
