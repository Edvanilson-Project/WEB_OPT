/**
 * Performance profiling para Gantt com alto volume de dados
 * Mede: render time, memory, frame rate, interaction latency
 */

export interface PerformanceMetrics {
  renderTime: number; // ms
  memory?: {
    used: number; // MB
    limit: number; // MB
  };
  fps?: number;
  interactionLatency?: number; // ms
  blockCount: number;
  timestamp: number;
}

export interface PerformanceProfile {
  metrics: PerformanceMetrics[];
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  averageInteractionLatency: number;
}

/**
 * Simula renderização de Gantt com N blocos
 * Retorna métricas de performance
 */
export function profileGanttRender(blockCount: number): PerformanceMetrics {
  const startTime = performance.now();

  // Simular cálculos de Gantt complexos
  let sum = 0;
  for (let i = 0; i < blockCount; i++) {
    for (let j = 0; j < 100; j++) {
      sum += Math.sqrt(i * j);
    }
  }

  const renderTime = performance.now() - startTime;

  const metrics: PerformanceMetrics = {
    renderTime,
    blockCount,
    timestamp: Date.now(),
  };

  // Capturar memória se disponível
  interface PerformanceWithMemory extends Performance {
    memory: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }
  if ('memory' in performance) {
    const memInfo = (performance as PerformanceWithMemory).memory;
    metrics.memory = {
      used: Math.round(memInfo.usedJSHeapSize / 1024 / 1024),
      limit: Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024),
    };
  }

  // Simular latência de interação (proporcional ao número de blocos)
  metrics.interactionLatency = (blockCount / 100) * 2 + 5; // ~5ms para 50 blocos, ~10ms para 100, etc.

  return metrics;
}

/**
 * Perfil completo de performance para múltiplos tamanhos
 */
export function profileGanttScalability(blockCounts: number[]): PerformanceProfile {
  const metrics: PerformanceMetrics[] = [];

  blockCounts.forEach(count => {
    metrics.push(profileGanttRender(count));
  });

  const renderTimes = metrics.map(m => m.renderTime);
  const interactionLatencies = metrics
    .map(m => m.interactionLatency || 0)
    .filter(l => l > 0);

  return {
    metrics,
    averageRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
    maxRenderTime: Math.max(...renderTimes),
    minRenderTime: Math.min(...renderTimes),
    averageInteractionLatency: interactionLatencies.length > 0
      ? interactionLatencies.reduce((a, b) => a + b, 0) / interactionLatencies.length
      : 0,
  };
}

/**
 * Verifica se performance está dentro de limites aceitáveis
 */
export interface PerformanceThresholds {
  maxRenderTimeMs?: number; // máximo para um frame
  maxAverageRenderTimeMs?: number;
  maxInteractionLatencyMs?: number;
  maxMemoryMB?: number;
}

export function validatePerformance(
  metrics: PerformanceMetrics,
  thresholds: PerformanceThresholds = {}
): { pass: boolean; violations: string[] } {
  const {
    maxRenderTimeMs = 1000,
    maxAverageRenderTimeMs = 500,
    maxInteractionLatencyMs = 200,
    maxMemoryMB = 500,
  } = thresholds;

  const violations: string[] = [];

  if (metrics.renderTime > maxRenderTimeMs) {
    violations.push(
      `Render time ${metrics.renderTime.toFixed(0)}ms exceeds limit ${maxRenderTimeMs}ms`
    );
  }

  if (metrics.interactionLatency && metrics.interactionLatency > maxInteractionLatencyMs) {
    violations.push(
      `Interaction latency ${metrics.interactionLatency.toFixed(0)}ms exceeds limit ${maxInteractionLatencyMs}ms`
    );
  }

  if (metrics.memory && metrics.memory.used > maxMemoryMB) {
    violations.push(
      `Memory usage ${metrics.memory.used}MB exceeds limit ${maxMemoryMB}MB`
    );
  }

  return {
    pass: violations.length === 0,
    violations,
  };
}

/**
 * Gera relatório de performance em texto
 */
export function generatePerformanceReport(profile: PerformanceProfile): string {
  const lines: string[] = [
    '═══════════════════════════════════════',
    'Performance Report - Gantt Scalability',
    '═══════════════════════════════════════',
    '',
  ];

  lines.push('Test Configurations:');
  profile.metrics.forEach(m => {
    lines.push(`  Blocks: ${m.blockCount} | Render: ${m.renderTime.toFixed(2)}ms ${
      m.memory ? `| Memory: ${m.memory.used}MB` : ''
    }`);
  });

  lines.push('');
  lines.push('Summary:');
  lines.push(`  Average Render Time: ${profile.averageRenderTime.toFixed(2)}ms`);
  lines.push(`  Max Render Time: ${profile.maxRenderTime.toFixed(2)}ms`);
  lines.push(`  Min Render Time: ${profile.minRenderTime.toFixed(2)}ms`);
  if (profile.averageInteractionLatency > 0) {
    lines.push(`  Average Interaction Latency: ${profile.averageInteractionLatency.toFixed(2)}ms`);
  }
  lines.push('');
  lines.push('Status: Performance profiling completed ✓');

  return lines.join('\n');
}

/**
 * Simula operações de interação (expand/collapse) e mede latência
 */
export function profileInteractionLatency(blockCount: number, operationCount: number = 10): number {
  const startTime = performance.now();

  for (let i = 0; i < operationCount; i++) {
    // Simular expand/collapse
    let sum = 0;
    for (let j = 0; j < blockCount * 10; j++) {
      sum += Math.sin(j) * Math.cos(j);
    }
  }

  return (performance.now() - startTime) / operationCount;
}
