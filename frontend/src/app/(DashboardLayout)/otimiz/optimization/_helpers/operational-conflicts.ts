import type { OptimizationResultSummary } from '../../_types';

export interface OperationalConflict {
  type: 'overlap' | 'time-violation' | 'no-return' | 'break-violation' | 'unrealistic';
  severity: 'error' | 'warning';
  blockId?: number;
  message: string;
  count: number;
}

/**
 * Detect operational conflicts in optimization result
 * Conflicts: overlapping trips, time violations, missing returns to depot, break violations
 */
export function detectOperationalConflicts(res: OptimizationResultSummary): OperationalConflict[] {
  const conflicts: OperationalConflict[] = [];
  const { blocks = [] } = res;

  // Check each block for conflicts
  blocks.forEach((block) => {
    const trips = (block.trips || [])
      .map(t => (typeof t === 'object' ? t : { id: t }))
      .filter(t => t && typeof t === 'object' && 'start_time' in t && 'end_time' in t)
      .sort((a, b) => ((a as any).start_time ?? 0) - ((b as any).start_time ?? 0));

    // Detect overlapping trips (impossible state)
    for (let i = 0; i < trips.length - 1; i++) {
      const current = trips[i] as any;
      const next = trips[i + 1] as any;
      
      if ((current.end_time ?? 0) > (next.start_time ?? 0)) {
        conflicts.push({
          type: 'overlap',
          severity: 'error',
          blockId: block.block_id,
          message: `Bloco ${block.block_id}: Viagens sobrepostas detectadas (impossível)`,
          count: 1,
        });
        break;
      }

      // Detect unrealistic gaps (< 2 minutes between trips)
      const gap = (next.start_time ?? 0) - (current.end_time ?? 0);
      if (gap < 2 && gap >= 0) {
        conflicts.push({
          type: 'unrealistic',
          severity: 'warning',
          blockId: block.block_id,
          message: `Bloco ${block.block_id}: Intervalo muito curto entre viagens (${gap}min)`,
          count: 1,
        });
        break;
      }
    }

    // Detect break violations (no break > 15 min in 6-hour window)
    if (trips.length >= 2) {
      const blockStart = (trips[0] as any).start_time ?? 0;
      const blockEnd = (trips[trips.length - 1] as any).end_time ?? 0;
      const blockDuration = blockEnd - blockStart;

      if (blockDuration >= 360) { // 6 hours
        let maxGap = 0;
        for (let i = 0; i < trips.length - 1; i++) {
          const gap = ((trips[i + 1] as any).start_time ?? 0) - ((trips[i] as any).end_time ?? 0);
          maxGap = Math.max(maxGap, gap);
        }

        if (maxGap < 15 && blockDuration >= 360) {
          conflicts.push({
            type: 'break-violation',
            severity: 'warning',
            blockId: block.block_id,
            message: `Bloco ${block.block_id}: Nenhum intervalo ≥15min em jornada de ${Math.round(blockDuration / 60)}h`,
            count: 1,
          });
        }
      }
    }

    // Detect missing return to depot (last trip not ending at depot)
    const lastTrip = trips[trips.length - 1] as any;
    if (lastTrip && lastTrip.destination_terminal_id && lastTrip.destination_terminal_id !== 1) {
      // Assuming terminal_id 1 is depot/garagem
      conflicts.push({
        type: 'no-return',
        severity: 'warning',
        blockId: block.block_id,
        message: `Bloco ${block.block_id}: Não retorna à garagem ao final do dia`,
        count: 1,
      });
    }
  });

  // Consolidate conflicts by type
  const consolidated: OperationalConflict[] = [];
  const typeMap = new Map<string, OperationalConflict>();

  conflicts.forEach((c) => {
    const key = `${c.type}-${c.severity}`;
    if (typeMap.has(key)) {
      const existing = typeMap.get(key)!;
      existing.count++;
    } else {
      typeMap.set(key, { ...c });
      consolidated.push({ ...c });
    }
  });

  return consolidated;
}
