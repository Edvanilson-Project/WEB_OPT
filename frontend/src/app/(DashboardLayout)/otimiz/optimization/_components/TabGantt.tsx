'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Typography, Stack, Paper, Tooltip, Button, Drawer, Divider,
  IconButton, Alert, Snackbar,
  alpha, useTheme,
} from '@mui/material';
import { List, type RowComponentProps } from 'react-window';
import { IconInfoCircle } from '@tabler/icons-react';
import type {
  Line, Terminal, OptimizationResultSummary, TripDetail,
} from '../../_types';
import {
  minToHHMM, minToDuration,
  getBlockDisplayWindow,
  classifyTripInterval, formatIdleWindowLabel,
  type TripIntervalPolicy, type IdleWindow,
} from '../_helpers/formatters';
import { getLinePalette, getGanttColors } from '../../_tokens/design-tokens';
import { OperationalConflictIndicator } from './OperationalConflictIndicator';
import { optimizationApi } from '@/lib/api';

function isSameTerminal(previousTrip: TripDetail, nextTrip: TripDetail): boolean {
  const previousTerminal = previousTrip.destination_terminal_id ?? previousTrip.destination_id;
  const nextTerminal = nextTrip.origin_id;

  return previousTerminal != null && nextTerminal != null && String(previousTerminal) === String(nextTerminal);
}

function classifyGanttWindowKind({
  previousTrip,
  nextTrip,
  gapMinutes,
  intervalPolicy,
}: {
  previousTrip: TripDetail;
  nextTrip: TripDetail;
  gapMinutes: number;
  intervalPolicy: TripIntervalPolicy;
}): IdleWindow['kind'] {
  const qualifiesAsMealBreak =
    gapMinutes > 0 &&
    isSameTerminal(previousTrip, nextTrip) &&
    intervalPolicy.mealBreakMinutes > 0 &&
    gapMinutes + intervalPolicy.connectionToleranceMinutes >= intervalPolicy.mealBreakMinutes;

  return classifyTripInterval({
    gapMinutes,
    isBoundary: false,
    isMealBreakWindow: qualifiesAsMealBreak,
    viewScope: qualifiesAsMealBreak ? 'crew' : 'vehicle',
  });
}

export function TabGantt({
  res,
  lines,
  terminals,
  intervalPolicy,
  onWhatIfUpdate,
}: {
  res: OptimizationResultSummary;
  lines: Line[];
  terminals: Terminal[];
  intervalPolicy: TripIntervalPolicy;
  onWhatIfUpdate?: (cost: number | null) => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [zoom, setZoom] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [deltaResult, setDeltaResult] = useState<any>(null);
  const [deltaError, setDeltaError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: '', severity: 'info' });
  const [draggedTrip, setDraggedTrip] = useState<{ tripId: number; blockId: number; index: number } | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // ─── Local State for What-If Scenarios ───
  const [localBlocks, setLocalBlocks] = useState<any[]>(res?.blocks || []);
  const [baselineCost, setBaselineCost] = useState<number | null>(null);

  // Sync local state when parent props change (e.g., selecting a different run)
  useEffect(() => {
    setLocalBlocks(res?.blocks || []);
    setBaselineCost(null);
    setDeltaResult(null);
  }, [res?.blocks]);

  // Baseline: chama /evaluate-baseline no mount para estabelecer um prevCost
  // comparável ao resultado do what-if (mesmo pipeline de avaliação).
  // Sem isso, a 1ª comparação mistura cost_breakdown da otimização original
  // com GreedyCSP do what-if e produz delta falso (ex: 51983 → 14154).
  useEffect(() => {
    const blocks = res?.blocks || [];
    if (!blocks.length) return;

    const payload = {
      blocks: blocks.map((b: any) => ({
        id: Number(b.block_id ?? b.id),
        vehicle_type_id: b.vehicle_type_id ?? null,
        trips: (b.trips || []).map((t: any) => {
          const trip: any = typeof t === 'object' ? t : { id: t };
          const startTime = trip.start_time ?? 0;
          const endTime = trip.end_time ?? 0;
          return {
            id: Number(trip.id),
            line_id: trip.line_id ?? null,
            start_time: startTime,
            end_time: endTime,
            origin_id: trip.origin_id ?? trip.origin_terminal_id ?? null,
            destination_id: trip.destination_id ?? trip.destination_terminal_id ?? null,
            direction: trip.direction ?? null,
            distance_km: trip.distance_km ?? 0,
            deadhead_times: trip.deadhead_times || {},
            duration: trip.duration ?? (endTime - startTime),
            idle_before_minutes: trip.idle_before_minutes ?? 0,
            idle_after_minutes: trip.idle_after_minutes ?? 0,
            trip_group_id: trip.tripGroupId ?? trip.trip_group_id ?? null,
          };
        }),
      })),
    };

    let cancelled = false;
    optimizationApi
      .evaluateBaseline(payload)
      .then((result: any) => {
        if (cancelled) return;
        const baseline = result?.cost_breakdown?.total ?? null;
        setBaselineCost(baseline);
      })
      .catch((err: any) => {
        console.warn('[WhatIf] Falha ao obter baseline:', err?.message);
      });

    return () => {
      cancelled = true;
    };
  }, [res?.blocks]);

  const { duties = [] } = res;
  const blocks = localBlocks;
  const ganttColors = useMemo(() => getGanttColors(theme), [theme]);

  // ─── Per-line color palette ───
  const LINE_PALETTE = useMemo(() => getLinePalette(theme), [theme]);
  const lineColorMap = useMemo(() => {
    const lineIds = new Set<number>();
    blocks.forEach(b => (b.trips || []).forEach((t: TripDetail) => {
      const trip = typeof t === 'object' ? t : null;
      if (trip?.line_id) lineIds.add(trip.line_id);
    }));
    const map = new Map<number, string>();
    Array.from(lineIds).sort((a: number, b: number) => a - b).forEach((id: number, i: number) => {
      map.set(id, LINE_PALETTE[i % LINE_PALETTE.length]);
    });
    return map;
  }, [blocks, LINE_PALETTE]);
  const showLinesLegend = lineColorMap.size > 1;
  const listRowProps = useMemo<Record<string, never>>(() => ({}), []);
  
  // ─── Data Enrichment ───
  // IMPORTANT: built from res.blocks (original, permanent) NOT from localBlocks.
  // After a what-if response setLocalBlocks(result.blocks) replaces trip objects
  // with ID-only entries, so using localBlocks here would empty the map on every
  // subsequent drag and send zeroed data to the optimizer.
  const tripMetadataMap = useMemo(() => {
    const map = new Map<number, TripDetail>();

    (res?.blocks || []).forEach(b => {
      (b.trips || []).forEach((t: TripDetail | number) => {
        if (typeof t === 'object' && t !== null) map.set(t.id, t);
      });
    });

    duties.forEach(d => {
      (d.trips || []).forEach((t: TripDetail) => {
         if (typeof t === 'object') {
           const existing = map.get(t.id);
           map.set(t.id, { ...existing, ...t });
         }
      });
    });

    return map;
  }, [res?.blocks, duties]);

  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);

  const { processedBlocks, minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    const filtered = blocks.map((b: any) => {
      let blockMin = Infinity;
      let blockMax = -Infinity;
      const blockWindow = getBlockDisplayWindow(b);
      const validTrips = (b.trips || []).map((t: TripDetail | number) => {
        const id = typeof t === 'number' ? t : t.id;
        const meta = tripMetadataMap.get(id);
        return { ...(typeof t === 'object' ? t : {}), ...meta, id } as TripDetail;
      }).filter((t: TripDetail) => t.start_time !== undefined);

      validTrips.forEach((t: TripDetail) => {
        if (t.start_time !== undefined && t.start_time < min) min = t.start_time;
        if (t.end_time !== undefined && t.end_time > max) max = t.end_time;
        if (t.start_time !== undefined && t.start_time < blockMin) blockMin = t.start_time;
        if (t.end_time !== undefined && t.end_time > blockMax) blockMax = t.end_time;
      });

      const sortedTrips = validTrips.sort((left: TripDetail, right: TripDetail) => (left.start_time ?? 0) - (right.start_time ?? 0));
  const displayStart = blockWindow.start ?? (blockMin !== Infinity ? blockMin : 0);
  const displayEnd = blockWindow.end ?? (blockMax !== -Infinity ? blockMax : 0);

  if (displayStart < min) min = displayStart;
  if (displayEnd > max) max = displayEnd;

      // Group into cycles (Outbound + Inbound)
      const groups: { type: 'cycle' | 'single' | 'deadhead', trips: TripDetail[] }[] = [];
      let i = 0;
      while (i < sortedTrips.length) {
        const current = sortedTrips[i];
        const next = sortedTrips[i + 1];

        const isDeadhead = !current.line_id;
        
        if (isDeadhead) {
          if (groups.length > 0 && groups[groups.length - 1].type === 'deadhead') {
            groups[groups.length - 1].trips.push(current);
          } else {
            groups.push({ type: 'deadhead', trips: [current] });
          }
          i++;
          continue;
        }

        const direction = current.direction?.toLowerCase();
        const nextDirection = next?.direction?.toLowerCase();
        const isCurrentOut = direction === 'outbound' || direction === 'ida';
        const isNextIn = nextDirection === 'inbound' || nextDirection === 'volta';

        // Robust Cycle Detection: Same line, Out -> In, and reasonable gap
        if (next && next.line_id === current.line_id && isCurrentOut && isNextIn && (next.start_time - current.end_time) < 45) {
          groups.push({ type: 'cycle', trips: [current, next] });
          i += 2;
        } else {
          groups.push({ type: 'single', trips: [current] });
          i++;
        }
      }

      const idleWindows: IdleWindow[] = [];
      
      // 1. Boundary Windows (Start/End of block)
      if (sortedTrips.length > 0) {
        const firstTrip = sortedTrips[0];
        const lastTrip = sortedTrips[sortedTrips.length - 1];
        
        if (firstTrip.start_time !== undefined && displayStart < firstTrip.start_time) {
          idleWindows.push({
            start: displayStart,
            end: firstTrip.start_time,
            duration: firstTrip.start_time - displayStart,
            kind: 'ociosa',
          });
        }
        
        if (lastTrip.end_time !== undefined && displayEnd > lastTrip.end_time) {
          idleWindows.push({
            start: lastTrip.end_time,
            end: displayEnd,
            duration: displayEnd - lastTrip.end_time,
            kind: 'ociosa',
          });
        }
      }

      // 2. Internal Gaps & Deadheads
      groups.forEach((group, index) => {
        if (group.type === 'deadhead') {
          const start = group.trips[0].start_time ?? 0;
          const end = group.trips[group.trips.length - 1].end_time ?? start;
          idleWindows.push({
            start,
            end,
            duration: end - start,
            kind: 'apoio',
          });
        }

        const nextGroup = groups[index + 1];
        if (nextGroup) {
          const previousTrip = group.trips[group.trips.length - 1];
          const nextTrip = nextGroup.trips[0];
          const currentEnd = previousTrip.end_time ?? 0;
          const nextStart = nextTrip.start_time ?? 0;
          if (nextStart > currentEnd) {
            const gapMinutes = nextStart - currentEnd;
            idleWindows.push({
              start: currentEnd,
              end: nextStart,
              duration: gapMinutes,
              kind: classifyGanttWindowKind({
                previousTrip,
                nextTrip,
                gapMinutes,
                intervalPolicy,
              }),
            });
          }
        }
      });

      idleWindows.sort((a, b) => a.start - b.start);

      const idleSummary = idleWindows.length
        ? `${idleWindows.slice(0, 2).map((window) => formatIdleWindowLabel(window)).join(' · ')}${idleWindows.length > 2 ? ` +${idleWindows.length - 2}` : ''}`
        : null;

      return {
        ...b,
        groups,
        min: displayStart,
        max: displayEnd,
        idleWindows,
        idleSummary,
        tripCount: validTrips.length,
        lineLabels: Array.from(new Set(validTrips.map((trip: TripDetail) => trip.line_id ? String(linesMap[trip.line_id] || trip.line_id) : '').filter(Boolean))).slice(0, 3),
      };
    }).filter(b => (b.trips?.length || 0) > 0);

    return { processedBlocks: filtered, minTime: min, maxTime: max };
  }, [
    blocks,
    intervalPolicy,
    linesMap,
    tripMetadataMap,
  ]);

  // ─── What-If Delta Evaluation ───────────────────────────────────────────────
  const handleWhatIfDrop = useCallback(async (
    tripIds: (number | string)[],
    sourceBlockId: number | string,
    targetBlockId: number | string,
    targetIndex: number,
  ) => {
    setIsEvaluating(true);
    setDeltaError(null);

    // ─── REGRA DE OURO #1: Deep clone do estado atual ───────────────────────
    // Nenhuma mutação toca `localBlocks`. Toda lógica opera em `computedNewBlocks`,
    // que vira a Single Source of Truth para a UI E para o payload da API.
    const backupBlocks = JSON.parse(JSON.stringify(localBlocks));
    const computedNewBlocks: any[] = JSON.parse(JSON.stringify(localBlocks));

    const numericTripIds = tripIds.map(Number);
    const srcIdx = computedNewBlocks.findIndex(
      (b: any) => String(b.block_id ?? b.id) === String(sourceBlockId),
    );
    const tgtIdx = computedNewBlocks.findIndex(
      (b: any) => String(b.block_id ?? b.id) === String(targetBlockId),
    );

    if (srcIdx === -1 || tgtIdx === -1) {
      setIsEvaluating(false);
      setDeltaError('Bloco de origem ou destino não encontrado no estado local.');
      return;
    }

    // Hidrata trip (pode estar como INT após response do Python) com metadados.
    const hydrateTrip = (t: any) => {
      const id = Number(typeof t === 'number' ? t : t.id);
      const meta = (tripMetadataMap.get(id) || {}) as any;
      return { ...meta, ...(typeof t === 'object' ? t : {}), id };
    };

    const srcTripsHydrated: any[] = (computedNewBlocks[srcIdx].trips || [])
      .map(hydrateTrip)
      .sort((a: any, b: any) => (a.start_time ?? 0) - (b.start_time ?? 0));

    // ─── REGRA DE OURO #2: FALLBACK por tempo — Simples e confiável
    const expandedIdSet = new Set<number>(numericTripIds);
// Se só tem 1 trip, tenta encontrar o par (ida/volta) por tempo
    if (expandedIdSet.size === 1) {
      const tid = numericTripIds[0];
      const t = srcTripsHydrated.find(x => x.id === tid);
      if (t) {
        const tTime = t.start_time ?? 0;
        let bestGap = 9999;
        let bestTid = null;
        srcTripsHydrated.forEach((other: any) => {
          if (other.id === tid) return;
          const otherTime = other.start_time ?? 0;
          const gap = Math.abs(otherTime - tTime);
          if (gap > 0 && gap < 150 && gap < bestGap) {
            bestGap = gap;
            bestTid = other.id;
          }
        });
        if (bestTid) expandedIdSet.add(bestTid);
      }
    }
    
    const expandedTripIds = Array.from(expandedIdSet);
    console.log('[WhatIf] OUTPUT expandedTripIds:', expandedTripIds);

    // ─── REGRA DE OURO #3: Aplica move no clone (nunca em localBlocks) ──────
    const belongsToMove = (t: any): boolean => {
      const id = Number(typeof t === 'number' ? t : t.id);
      return expandedIdSet.has(id);
    };

    if (srcIdx === tgtIdx) {
      // Cenário A: reordenar dentro do mesmo bloco
      const block = computedNewBlocks[srcIdx];
      const extracted = (block.trips || []).filter(belongsToMove);
      const remaining = (block.trips || []).filter((t: any) => !belongsToMove(t));
      const ins = Math.min(targetIndex, remaining.length);
      remaining.splice(ins, 0, ...extracted);
      block.trips = remaining;
    } else {
      // Cenário B: mover para outro bloco — AMBAS Ida+Volta viajam juntas.
      const src = computedNewBlocks[srcIdx];
      const tgt = computedNewBlocks[tgtIdx];
      const extracted = (src.trips || []).filter(belongsToMove);
      
      // Verifica sobreposição de horário antes de mover
      const tgtTrips = tgt.trips || [];
      let hasOverlap = false;
      const overlapWarnings: string[] = [];
      extracted.forEach((mt: any) => {
        const mStart = mt.start_time ?? 0;
        const mEnd = mt.end_time ?? 0;
        tgtTrips.forEach((tt: any) => {
          const tStart = tt.start_time ?? 0;
          const tEnd = tt.end_time ?? 0;
          if (mStart < tEnd && mEnd > tStart) {
            hasOverlap = true;
            overlapWarnings.push(`Trip ${mt.id} sobres trip ${tt.id}`);
          }
        });
      });
      
      if (hasOverlap) {
        setIsEvaluating(false);
        setDeltaError('Não é permitido mover para intervalo com sobreposição. Escolha outro local.');
        setSnackbar({ open: true, message: `⚠️ Não é permitido sobresicionar!`, severity: 'error' });
        return;
      }
      
      src.trips = (src.trips || []).filter((t: any) => !belongsToMove(t));
      const ins = Math.min(targetIndex, (tgt.trips || []).length);
      const newTgtTrips = [...(tgt.trips || [])];
      newTgtTrips.splice(ins, 0, ...extracted);
      tgt.trips = newTgtTrips;
    }

    // ─── Single Source of Truth: computedNewBlocks ──────────────────────────
    // UI: mostra apenas blocos com trips (filtro visual).
    // Payload: preserva TODOS os blocos (incluindo source vazio) para o Python
    //          encontrar source_block_id mesmo quando esvaziou.
    const visibleBlocks = computedNewBlocks.filter((b: any) => (b.trips || []).length > 0);
    setLocalBlocks(visibleBlocks);

    try {
      const blocksPayload = computedNewBlocks.map((b: any) => ({
        id: Number(b.block_id || b.id),
        trips: (b.trips || []).map((t: any) => {
          const id = Number(typeof t === 'number' ? t : t.id);
          const trip: any = typeof t === 'object' ? t : (tripMetadataMap.get(id) || {});
          const startTime = trip.start_time ?? 0;
          const endTime = trip.end_time ?? 0;
          return {
            id,
            line_id: trip.line_id ?? null,
            start_time: startTime,
            end_time: endTime,
            origin_id: trip.origin_id ?? trip.origin_terminal_id ?? null,
            destination_id: trip.destination_id ?? trip.destination_terminal_id ?? null,
            direction: trip.direction ?? null,
            distance_km: trip.distance_km ?? 0,
            deadhead_times: trip.deadhead_times || {},
            duration: trip.duration ?? (endTime - startTime),
            idle_before_minutes: trip.idle_before_minutes ?? 0,
            idle_after_minutes: trip.idle_after_minutes ?? 0,
            trip_group_id: trip.tripGroupId ?? trip.trip_group_id ?? null,
          };
        }),
        vehicle_type_id: b.vehicle_type_id ?? null,
      }));

      console.log('[WhatIf] blocksPayload blocks:', blocksPayload.map((b: any) => ({id: b.id, trips: b.trips.length})));
      const payload = {
        blocks: blocksPayload,
        trip_id: expandedTripIds[0],
        source_block_id: Number(sourceBlockId),
        target_block_id: Number(targetBlockId),
        target_index: Math.max(0, Math.min(Number(targetIndex), (blocksPayload.find((b: any) => Number(b.id) === Number(targetBlockId))?.trips.length ?? 0))),
      };

      const result = await optimizationApi.evaluateDelta(payload);
      
      // Calcula custo ANTES de atualizar o deltaResult
      const newCost: number = result?.cost_breakdown?.total ?? result?.costBreakdown?.total ?? 0;
      console.log('[WhatIf] deltaResult ATUAL:', deltaResult?.cost_breakdown?.total);
      
      // Custo base comparável: deltaResult anterior → baseline do mesmo
      // pipeline (evaluator + GreedyCSP). NUNCA cai em res.cost_breakdown
      // porque aquele veio do optimizer full (CSP completo) e não é
      // comparável com a avaliação what-if.
      const prevCost = deltaResult?.cost_breakdown?.total
        ?? baselineCost
        ?? newCost;
      console.log('[WhatIf] Costs: prevCost:', prevCost, 'newCost:', newCost);
      const costDiff = newCost - prevCost;
      const sign = costDiff >= 0 ? '+' : '';

      // Atualiza o deltaResult DEPOIS de calcular o custo
      setDeltaResult(result);
      const newTotalCost: number | null = newCost;
      onWhatIfUpdate?.(newTotalCost);

      setSnackbar({
        open: true,
        message: costDiff === 0
          ? 'Sem alteração de custo'
          : `Custo ${costDiff > 0 ? 'aumentou' : 'reduzido'}: ${sign}${costDiff.toFixed(2)} (${prevCost.toFixed(2)} → ${newCost.toFixed(2)})`,
        severity: costDiff > 0 ? 'warning' : costDiff < 0 ? 'success' : 'info',
      });
    } catch (err: any) {
      console.error('[WhatIf] ERRO:', err);
      setDeltaError(err?.message || 'Erro ao avaliar delta');
      setSnackbar({
        open: true,
        message: `Erro What-If: ${err?.message || 'Erro desconhecido'}`,
        severity: 'error',
      });
      setLocalBlocks(backupBlocks);
      onWhatIfUpdate?.(null);
    } finally {
      setIsEvaluating(false);
    }
  }, [res, localBlocks, tripMetadataMap, onWhatIfUpdate]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    (window as any).__otimizWhatIf = handleWhatIfDrop;

    return () => {
      if ((window as any).__otimizWhatIf === handleWhatIfDrop) {
        delete (window as any).__otimizWhatIf;
      }
    };
  }, [handleWhatIfDrop]);

  if (processedBlocks.length === 0 || minTime === Infinity) {
    return <Typography color="text.secondary" py={4} textAlign="center">Sem dados suficientes para gerar o gráfico.</Typography>;
  }

  const padding = 30;
  const startScale = Math.max(0, minTime - padding);
  const endScale = maxTime + padding;
  const totalRange = endScale - startScale;
  const getPercent = (time: number) => Math.max(0, Math.min(100, ((time - startScale) / totalRange) * 100));

  const ticks: number[] = [];
  const tickStep = zoom > 1.5 ? 60 : 120;
  const startHour = Math.floor(startScale / 60);
  const endHour = Math.ceil(endScale / 60);
  for (let h = startHour; h <= endHour; h++) {
    const t = h * 60;
    if (t >= startScale && t <= endScale) {
       if (zoom > 1.5 || h % 2 === 0) ticks.push(t);
    }
  }

  // Visual constants for precise alignment
  const SIDE_LABEL_WIDTH = 180;
  const BLOCK_HEIGHT = 30;
  const ROW_HEIGHT = BLOCK_HEIGHT + 50; // block + label + padding
  const timelineWidth = 1920 * zoom;
  const VISIBLE_ROWS = Math.min(processedBlocks.length, 16);
  const listHeight = VISIBLE_ROWS * ROW_HEIGHT;

  const getIdleWindowVisuals = (kind: IdleWindow['kind']) => {
    switch (kind) {
      case 'apoio':
        return {
          backgroundColor: ganttColors.deadhead,
          borderColor: ganttColors.deadheadBorder,
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${alpha(theme.palette.warning.main, 0.08)} 5px, ${alpha(theme.palette.warning.main, 0.08)} 10px)`,
        };
      case 'descanso_refeicao':
        return {
          backgroundColor: ganttColors.mealBreak,
          borderColor: ganttColors.mealBreakBorder,
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 6px, ${alpha(theme.palette.success.main, 0.08)} 6px, ${alpha(theme.palette.success.main, 0.08)} 12px)`,
        };
      case 'ociosa':
        return {
          backgroundColor: ganttColors.idle,
          borderColor: ganttColors.idleBorder,
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${alpha(theme.palette.warning.dark, 0.06)} 5px, ${alpha(theme.palette.warning.dark, 0.06)} 10px)`,
        };
      default:
        return {
          backgroundColor: ganttColors.interval,
          borderColor: ganttColors.intervalBorder,
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 7px, ${alpha(theme.palette.info.main, 0.06)} 7px, ${alpha(theme.palette.info.main, 0.06)} 14px)`,
        };
    }
  };

  const GanttRow = ({ index, style }: RowComponentProps<Record<string, never>>) => {
    const b = processedBlocks[index];
    const summaryIndicatorColor = b.idleWindows.some((window: IdleWindow) => window.kind === 'ociosa')
      ? theme.palette.warning.main
      : b.idleWindows.some((window: IdleWindow) => window.kind === 'descanso_refeicao')
        ? theme.palette.success.main
        : b.idleWindows.some((window: IdleWindow) => window.kind === 'intervalo_normal')
          ? theme.palette.info.main
          : ganttColors.deadheadBorder;

    return (
      <Box style={style}>
        <Stack direction="row" alignItems="stretch" spacing={0} sx={{ px: 0, height: ROW_HEIGHT - 6 }}>
          {/* Label do Bloco (Y-Axis) */}
          <Box sx={{ width: SIDE_LABEL_WIDTH, flexShrink: 0, py: 1, pr: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ 
              px: 1.5, py: 1, 
              borderRadius: 2, 
              bgcolor: isDark ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.action.hover, 0.4), 
              border: '1px solid', 
              borderColor: alpha(theme.palette.divider, 0.5),
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <Typography variant="caption" fontWeight={900} color="primary.main" sx={{ letterSpacing: 0.5, fontSize: '0.6rem', textTransform: 'uppercase' }}>
                Bloco {b.block_id}
              </Typography>
              <Typography variant="caption" color="text.primary" fontWeight={800} sx={{ mt: 0.5, display: 'block', fontSize: '0.75rem' }}>
                {minToHHMM(b.min)} - {minToHHMM(b.max)}
              </Typography>
              
              <Stack direction="row" spacing={0.5} mt={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                  {b.tripCount} percursos
                </Typography>
                {b.idleSummary && (
                  <Tooltip
                    title={
                      <Box sx={{ p: 1 }}>
                        <Typography variant="caption" display="block" fontWeight={800} sx={{ mb: 1, color: 'info.light' }}>
                          JANELAS OPERACIONAIS
                        </Typography>
                        <Stack spacing={0.5}>
                          {b.idleWindows.map((window: IdleWindow, idx: number) => (
                            <Typography key={`${b.block_id}-idle-${idx}`} variant="caption" sx={{ display: 'block' }}>
                              {formatIdleWindowLabel(window)}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    }
                  >
                    <Box sx={{ 
                      width: 6, height: 6, borderRadius: '50%', 
                      bgcolor: summaryIndicatorColor, animation: 'pulse 2s infinite' 
                    }} />
                  </Tooltip>
                )}
              </Stack>
            </Box>
          </Box>

          {/* Área do Gráfico */}
          <Box
            onDragOver={(e) => {
              e.preventDefault(); // OBRIGATÓRIO PARA O NAVEGADOR PERMITIR O DROP
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault(); // EVITA QUE O NAVEGADOR ABRA O DADO COMO URL
              
              const dragData = e.dataTransfer.getData('text/plain');
              console.log("📥 DROP: Soltou o mouse! Dados recebidos:", dragData);
              
              if (dragData) {
                try {
                  const parsed = JSON.parse(dragData);
                  const targetBlockId = b.block_id || b.id;
                  
                  console.log(`🚀 ROTEANDO: Movendo Viagens ${parsed.tripIds} do Bloco ${parsed.blockId} para o Bloco ${targetBlockId}`);
                  
                  // Sempre permite mover (mesmo bloco ou outro)
                  // Se mesmo bloco, vai reordenar; se outro, vai mover
                  handleWhatIfDrop(parsed.tripIds, parsed.blockId, targetBlockId, 1000);
                } catch (err) {
                  console.error("❌ ERRO NO DROP: Falha ao ler os dados", err);
                }
              } else {
                console.warn("⚠️ DROP VAZIO: O React perdeu os dados no caminho.");
              }
            }}
            sx={{ 
              flexGrow: 1, 
              position: 'relative', 
              height: BLOCK_HEIGHT + 10, 
              my: 'auto',
              bgcolor: ganttColors.trackBg, 
              borderRadius: 2.5, 
              border: '1px solid',
              borderColor: alpha(theme.palette.divider, 0.3),
              overflow: 'hidden',
            }}
          >
            {/* Grid Lines (Subtle) */}
            {ticks.map(t => (
              <Box key={`grid-${t}`} sx={{ 
                position: 'absolute', 
                left: `${getPercent(t)}%`, 
                top: 0, bottom: 0, 
                width: '1px', 
                bgcolor: ganttColors.gridLine 
              }} />
            ))}

            {/* Faixas improdutivas (ociosas/deadhead) */}
            {b.idleWindows.map((window: IdleWindow, idleIdx: number) => {
              const left = getPercent(window.start);
              const right = getPercent(window.end);
              const width = Math.max(0, right - left);
              const visual = getIdleWindowVisuals(window.kind);
              if (width <= 0.1) return null;

              return (
                <Tooltip
                  key={`idle-${b.block_id}-${idleIdx}`}
                  title={formatIdleWindowLabel(window)}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 0, bottom: 0,
                      bgcolor: visual.backgroundColor,
                      backgroundImage: visual.backgroundImage,
                      borderRight: '1px solid',
                      borderLeft: '1px solid',
                      borderColor: visual.borderColor,
                      zIndex: 1
                    }}
                  />
                </Tooltip>
              );
            })}

            {/* Ciclos e Viagens */}
            {b.groups.map((group: any, gIdx: number) => {
              const containerStart = getPercent(group.trips[0].start_time ?? 0);
              const containerEnd = getPercent(group.trips[group.trips.length - 1].end_time ?? 0);
              const containerWidth = containerEnd - containerStart;

              const cycleLineId = group.type === 'cycle' ? group.trips[0].line_id : undefined;
              const cycleColor = cycleLineId ? lineColorMap.get(cycleLineId) : theme.palette.primary.main;

              return (
                <Box key={gIdx} sx={{ 
                  position: 'absolute', 
                  left: `${containerStart}%`, 
                  width: `${containerWidth}%`, 
                  top: 6, bottom: 6,
                  zIndex: 2,
                  ...(group.type === 'cycle' && {
                    bgcolor: alpha(cycleColor ?? theme.palette.primary.main, 0.15),
                    borderRadius: 99,
                    border: '1px solid',
                    borderColor: alpha(cycleColor ?? theme.palette.primary.main, 0.4),
                  })
                }}>
                  {group.trips.map((t: TripDetail, i: number) => {
                    const groupStart = group.trips[0].start_time ?? 0;
                    const groupEnd = group.trips[group.trips.length - 1].end_time ?? 0;
                    const range = Math.max(groupEnd - groupStart, 1);
                    const startP = (((t.start_time ?? 0) - groupStart) / range) * 100;
                    const widthP = (((t.end_time ?? 0) - (t.start_time ?? 0)) / range) * 100;

                    const isDeadhead = !t.line_id;
                    const dir = t.direction?.toLowerCase();
                    const isVolta = dir === 'inbound' || dir === 'volta' || dir === 'v';
                    const lineColor = t.line_id ? lineColorMap.get(t.line_id) : undefined;
                    const originLabel = t.origin_name ?? (t.origin_id != null ? terminalsMap[String(t.origin_id)] : undefined) ?? t.origin_id;
                    const destinationLabel = t.destination_name ?? (t.destination_id != null ? terminalsMap[String(t.destination_id)] : undefined) ?? t.destination_id;
                    
                    const barColor = isDeadhead
                      ? ganttColors.deadheadBorder
                      : lineColor || (isVolta ? ganttColors.volta : ganttColors.ida);

                    return (
                      <Tooltip
                        key={i}
                        arrow
                        title={
                          <Box sx={{ p: 0.5 }}>
                            <Typography variant="caption" display="block" fontWeight={900} sx={{ color: 'primary.light', mb: 0.5 }}>
                              {isDeadhead ? 'VIAGEM DE APOIO' : `LINHA ${linesMap[t.line_id!] || t.line_id}`}
                            </Typography>
                            <Typography variant="caption" component="div">
                              <b>{minToHHMM(t.start_time)} → {minToHHMM(t.end_time)}</b> ({minToDuration(t.duration)})
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}>
                              {originLabel} → {destinationLabel}
                            </Typography>
                          </Box>
                        }
                      >
                        <Box
                          draggable
                          onDragStart={(e) => {
                            const thisBlockId = b.block_id || b.id;
                            const tripIds = group.trips.map((gt: any) => gt.id);
                            const payload = JSON.stringify({ tripIds, blockId: thisBlockId, index: i });
                            
                            console.log(`📤 DRAG START: Segurou o ciclo contendo as viagens ${tripIds} do bloco ${thisBlockId}`);
                            
                            e.dataTransfer.setData('text/plain', payload);
                            e.dataTransfer.effectAllowed = 'move';
                            
                            // Hack para forçar o navegador a não perder a imagem fantasma
                            e.stopPropagation(); 
                          }}
                          onDragEnd={() => {
                            setDraggedTrip(null);
                            setDragOverBlockId(null);
                            setDragOverIndex(null);
                          }}
                          sx={{
                            position: 'absolute',
                            left: `${startP}%`,
                            width: `${widthP}%`,
                            top: group.type === 'cycle' ? 2 : 0,
                            bottom: group.type === 'cycle' ? 2 : 0,
                            bgcolor: barColor,
                            borderRadius: group.type === 'cycle' ? 99 : 1.5,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            transition: 'all 0.15s ease-out',
                            cursor: 'grab',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: draggedTrip?.tripId === t.id ? 0.5 : 1,
                            '&:hover': { 
                              filter: 'brightness(1.1)',
                              transform: 'scaleY(1.1)',
                              zIndex: 10,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                              cursor: 'grab'
                            },
                            '&:active': {
                              cursor: 'grabbing'
                            }
                          }}
                        >
                          {widthP > 8 && !isDeadhead && (
                            <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 800, px: 0.5, pointerEvents: 'none' }}>
                               {linesMap[t.line_id!] || t.line_id}
                            </Typography>
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        </Stack>
      </Box>
    );
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="flex-end" mb={3} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: -1, fontSize: '1.5rem', color: 'text.primary' }}>
            Visão Operacional (Gantt)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
            <OperationalConflictIndicator res={res} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              • {processedBlocks.length} veículos ativos
            </Typography>
          </Stack>
        </Box>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <Paper variant="outlined" sx={{ p: 0.5, borderRadius: 2.5, display: 'flex', gap: 0.5, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
            {[1, 1.5, 3].map((z) => (
              <Button 
                key={z}
                size="small" 
                variant={zoom === z ? 'contained' : 'text'} 
                onClick={() => setZoom(z)} 
                sx={{ 
                  minWidth: 70, height: 28, fontSize: '0.65rem', borderRadius: 2,
                  boxShadow: zoom === z ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  textTransform: 'none', fontWeight: 800
                }}
              >
                {z === 1 ? 'Compacto' : z === 1.5 ? 'Padrão' : 'Detalhado'}
              </Button>
            ))}
          </Paper>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Guia Visual">
              <IconButton onClick={() => setDetailsOpen(true)} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                <IconInfoCircle size={20} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Stack>

      {showLinesLegend && (
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap mb={3} sx={{ p: 2, bgcolor: alpha(theme.palette.action.hover, 0.3), borderRadius: 3 }}>
          {Array.from(lineColorMap.entries()).map(([lineId, color]) => (
            <Stack key={lineId} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: '50%' }} />
              <Typography variant="caption" fontWeight={800} sx={{ fontSize: '0.7rem' }}>{linesMap[lineId] || `L${lineId}`}</Typography>
            </Stack>
          ))}
        </Stack>
      )}

      <Box sx={{ position: 'relative' }}>
        {isEvaluating && (
          <Box
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              bgcolor: alpha(theme.palette.background.paper, 0.4),
              backdropFilter: 'blur(2px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
            }}
          >
            <Paper
              elevation={4}
              sx={{
                p: 2,
                px: 3,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                bgcolor: theme.palette.primary.main,
                color: '#fff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  border: '3px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <Typography variant="subtitle2" fontWeight={900} sx={{ letterSpacing: 1 }}>
                RECALCULANDO...
              </Typography>
            </Paper>
          </Box>
        )}
         <Paper variant="outlined" sx={{ 
           borderRadius: 4, 
           overflow: 'hidden', 
           bgcolor: isDark ? alpha(theme.palette.background.paper, 0.5) : '#fff',
           boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
           border: '1px solid',
           borderColor: alpha(theme.palette.divider, 0.6)
         }}>
           <Box sx={{ 
             overflowX: 'auto', 
             padding: 3,
             '&::-webkit-scrollbar': { height: 10 },
             '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.divider, 0.8), borderRadius: 5 }
           }}>
             <Box sx={{ minWidth: SIDE_LABEL_WIDTH + timelineWidth, position: 'relative', pt: 4 }}>
               {/* Time Axis (Floating Header Style) */}
               <Box sx={{ position: 'absolute', top: 0, left: SIDE_LABEL_WIDTH, right: 0, height: 30, zIndex: 10 }}>
                 {ticks.map(t => (
                   <Box key={t} sx={{ position: 'absolute', left: `${getPercent(t)}%`, transform: 'translateX(-50%)' }}>
                     <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ fontSize: '0.65rem', letterSpacing: 0.5 }}>
                       {minToHHMM(t)}
                     </Typography>
                   </Box>
                 ))}
               </Box>

               <Box sx={{ mt: 2 }}>
                 <List
                   defaultHeight={listHeight}
                   style={{ width: '100%', height: listHeight, overflow: 'hidden' }}
                   rowCount={processedBlocks.length}
                   rowHeight={ROW_HEIGHT}
                   overscanCount={5}
                   rowComponent={GanttRow}
                   rowProps={listRowProps}
                 />
               </Box>
             </Box>
           </Box>
         </Paper>
      </Box>

      <Drawer anchor="right" open={detailsOpen} onClose={() => setDetailsOpen(false)} PaperProps={{ sx: { width: 380, borderLeft: 'none', boxShadow: '-10px 0 40px rgba(0,0,0,0.05)' } }}>
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" fontWeight={900} mb={1}>Inteligência Visual</Typography>
          <Typography variant="body2" color="text.secondary" mb={4}>
            O Gantt do OTIMIZ utiliza heurísticas visuais para condensar a complexidade operacional em uma interface limpa e intuitiva.
          </Typography>
          
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary.main" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>Conceito de Ciclos</Typography>
              <Typography variant="body2">
                Viagens de <b>Ida + Volta</b> sequenciais são agrupadas em um único elemento visual (pílula). Isso reduz o ruído em operações de alta frequência.
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="warning.main" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>Eficiência de Percurso</Typography>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: theme.palette.primary.main }} /> <b>Produtivo:</b> Operação comercial, colorida por linha.
                </Typography>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: ganttColors.deadhead, border: '1px solid', borderColor: ganttColors.deadheadBorder }} /> <b>Apoio:</b> Deslocamentos técnicos (Deadhead).
                </Typography>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: ganttColors.interval, border: '1px solid', borderColor: ganttColors.intervalBorder }} /> <b>Intervalo:</b> Janela operacional normal entre viagens.
                </Typography>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: ganttColors.mealBreak, border: '1px solid', borderColor: ganttColors.mealBreakBorder }} /> <b>Descanso/Refeição:</b> Janela longa elegível para pausa regulatória.
                </Typography>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: ganttColors.idle, border: '1px solid', borderColor: ganttColors.idleBorder }} /> <b>Ociosidade:</b> Janela fora da operação produtiva no início ou fim do bloco.
                </Typography>
              </Stack>
            </Box>

            <Divider />

            <Box>
               <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                 Sistema otimizado para renderização de até 2.000 veículos simultâneos através de virtualização de DOM e memoização agressiva.
               </Typography>
            </Box>
          </Stack>
        </Box>
      </Drawer>
      
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
