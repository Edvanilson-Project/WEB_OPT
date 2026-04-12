'use client';
import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Stack, Paper, Tooltip, Button,
  alpha, useTheme,
} from '@mui/material';
import { List } from 'react-window';
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

export function TabGantt({
  res,
  lines,
  terminals,
  intervalPolicy,
}: {
  res: OptimizationResultSummary;
  lines: Line[];
  terminals: Terminal[];
  intervalPolicy: TripIntervalPolicy;
}) {
  const theme = useTheme();
  const [zoom, setZoom] = useState(1);
  const { blocks = [], duties = [] } = res;
  const ganttColors = useMemo(() => getGanttColors(theme), [theme]);

  // ─── Per-line color palette ───
  const LINE_PALETTE = useMemo(() => getLinePalette(theme), [theme]);
  const lineColorMap = useMemo(() => {
    const lineIds = new Set<number>();
    blocks.forEach(b => (b.trips || []).forEach(t => {
      const trip = typeof t === 'object' ? t : null;
      if (trip?.line_id) lineIds.add(trip.line_id);
    }));
    const map = new Map<number, string>();
    Array.from(lineIds).sort((a, b) => a - b).forEach((id, i) => {
      map.set(id, LINE_PALETTE[i % LINE_PALETTE.length]);
    });
    return map;
  }, [blocks, LINE_PALETTE]);
  
  // ─── Data Enrichment ───
  const tripMetadataMap = useMemo(() => {
    const map = new Map<number, TripDetail>();
    
    blocks.forEach(b => {
      (b.trips || []).forEach(t => {
         if (typeof t === 'object') map.set(t.id, t);
      });
    });
    
    duties.forEach(d => {
      (d.trips || []).forEach(t => {
         if (typeof t === 'object') {
           const existing = map.get(t.id);
           map.set(t.id, { ...existing, ...t });
         }
      });
    });

    return map;
  }, [blocks, duties]);

  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  const terminalsMap = useMemo(() => Object.fromEntries((terminals ?? []).map(t => [t.id, t.name])), [terminals]);

  const { processedBlocks, minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    const filtered = blocks.map((b) => {
      let blockMin = Infinity;
      let blockMax = -Infinity;
      const blockWindow = getBlockDisplayWindow(b);
      const validTrips = (b.trips || []).map(t => {
        const id = typeof t === 'number' ? t : t.id;
        const meta = tripMetadataMap.get(id);
        return { ...(typeof t === 'object' ? t : {}), ...meta, id } as TripDetail;
      }).filter(t => t.start_time !== undefined);

      validTrips.forEach((t) => {
        if (t.start_time !== undefined && t.start_time < min) min = t.start_time;
        if (t.end_time !== undefined && t.end_time > max) max = t.end_time;
        if (t.start_time !== undefined && t.start_time < blockMin) blockMin = t.start_time;
        if (t.end_time !== undefined && t.end_time > blockMax) blockMax = t.end_time;
      });

      const sortedTrips = validTrips.sort((left, right) => (left.start_time ?? 0) - (right.start_time ?? 0));
  const displayStart = blockWindow.start ?? (blockMin !== Infinity ? blockMin : 0);
  const displayEnd = blockWindow.end ?? (blockMax !== -Infinity ? blockMax : 0);

  if (displayStart < min) min = displayStart;
  if (displayEnd > max) max = displayEnd;

      // Group into cycles
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

        if (next && next.line_id === current.line_id && isCurrentOut && isNextIn && (next.start_time - current.end_time) < 30) {
          groups.push({ type: 'cycle', trips: [current, next] });
          i += 2;
        } else {
          groups.push({ type: 'single', trips: [current] });
          i++;
        }
      }

      const supportWindows: IdleWindow[] = groups
        .filter((group) => group.type === 'deadhead')
        .map((group) => {
          const start = group.trips[0].start_time ?? 0;
          const end = group.trips[group.trips.length - 1].end_time ?? start;
          return {
            start,
            end,
            duration: Math.max(0, end - start),
            kind: 'apoio',
          };
        });

      const gapWindows: IdleWindow[] = [];
      sortedTrips.slice(1).forEach((trip, index) => {
        const previousTrip = sortedTrips[index];
        const start = previousTrip.end_time ?? null;
        const end = trip.start_time ?? null;
        if (start == null || end == null || end <= start) return;

        gapWindows.push({
          start,
          end,
          duration: end - start,
          kind: classifyTripInterval({
            gapMinutes: end - start,
            isBoundary: false,
            isMealBreakWindow: false,
            viewScope: 'vehicle',
          }),
        });
      });

      const boundaryWindows: IdleWindow[] = [];
      const firstTrip = sortedTrips[0];
      const lastTrip = sortedTrips[sortedTrips.length - 1];
      if (firstTrip?.start_time != null && displayStart < firstTrip.start_time) {
        boundaryWindows.push({
          start: displayStart,
          end: firstTrip.start_time,
          duration: firstTrip.start_time - displayStart,
          kind: classifyTripInterval({
            gapMinutes: firstTrip.start_time - displayStart,
            isBoundary: true,
            isMealBreakWindow: false,
            viewScope: 'vehicle',
          }),
        });
      }
      if (lastTrip?.end_time != null && displayEnd > lastTrip.end_time) {
        boundaryWindows.push({
          start: lastTrip.end_time,
          end: displayEnd,
          duration: displayEnd - lastTrip.end_time,
          kind: classifyTripInterval({
            gapMinutes: displayEnd - lastTrip.end_time,
            isBoundary: true,
            isMealBreakWindow: false,
            viewScope: 'vehicle',
          }),
        });
      }

      const idleWindows: IdleWindow[] = [...boundaryWindows, ...supportWindows, ...gapWindows].sort(
        (left, right) => left.start - right.start,
      );

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
        lineLabels: Array.from(new Set(validTrips.map((trip) => trip.line_id ? String(linesMap[trip.line_id] || trip.line_id) : '').filter(Boolean))).slice(0, 3),
      };
    }).filter(b => (b.trips?.length || 0) > 0);

    return { processedBlocks: filtered, minTime: min, maxTime: max };
  }, [
    blocks,
    intervalPolicy,
    linesMap,
    tripMetadataMap,
  ]);

  if (processedBlocks.length === 0 || minTime === Infinity) {
    return <Typography color="text.secondary" py={4} textAlign="center">Sem dados suficientes para gerar o gráfico.</Typography>;
  }

  const padding = 30;
  const startScale = Math.max(0, minTime - padding);
  const endScale = maxTime + padding;
  const totalRange = endScale - startScale;
  const getPercent = (time: number) => Math.max(0, Math.min(100, ((time - startScale) / totalRange) * 100));

  const ticks = [];
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const GanttRow = useCallback(({ index, style }: any) => {
    const b = processedBlocks[index];
    return (
      <Box style={style}>
        <Stack direction="row" alignItems="stretch" spacing={0} sx={{ px: 0, height: ROW_HEIGHT - 4 }}>
          {/* Label do Bloco (Y-Axis) */}
                  <Box sx={{ width: SIDE_LABEL_WIDTH, flexShrink: 0, py: 1, pr: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Box sx={{ px: 2, py: 0.75, borderRadius: 0.75, bgcolor: alpha(theme.palette.action.hover, 0.5), border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" fontWeight={900} color="primary.main" sx={{ fontSize: 11 }}>BLOCO #{b.block_id}</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: 10, mt: 0.5, display: 'block' }}>{minToHHMM(b.min)} - {minToHHMM(b.max)}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{b.tripCount} percursos</Typography>
                      {b.idleSummary && (
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography variant="caption" display="block" fontWeight={800} sx={{ mb: 0.5 }}>
                                Janelas de ociosidade
                              </Typography>
                              <Stack spacing={0.25}>
                                {b.idleWindows.map((window: IdleWindow, index: number) => (
                                  <Typography key={`${b.block_id}-idle-${index}`} variant="caption">
                                    {formatIdleWindowLabel(window)}
                                  </Typography>
                                ))}
                              </Stack>
                            </Box>
                          }
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: 9,
                              mt: 0.35,
                              display: 'block',
                              color: 'warning.dark',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'help',
                            }}
                          >
                            {b.idleSummary}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {/* Área do Gráfico */}
                  <Box sx={{ flexGrow: 1, position: 'relative', height: BLOCK_HEIGHT, bgcolor: alpha(theme.palette.action.hover, 0.3), borderRadius: 0.75, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.5) }}>
                    {b.groups.map((group, gIdx) => {
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
                          height: '100%',
                          ...(group.type === 'cycle' && {
                            bgcolor: alpha(cycleColor ?? theme.palette.primary.main, 0.06),
                            borderRadius: 1,
                            border: '1.5px dashed',
                            borderColor: alpha(cycleColor ?? theme.palette.primary.main, 0.25),
                          })
                        }}>
                          {group.trips.map((t, i) => {
                            const groupStart = group.trips[0].start_time ?? 0;
                            const groupEnd = group.trips[group.trips.length - 1].end_time ?? 0;
                            const range = Math.max(groupEnd - groupStart, 1);
                            const startP = (((t.start_time ?? 0) - groupStart) / range) * 100;
                            const widthP = (((t.end_time ?? 0) - (t.start_time ?? 0)) / range) * 100;

                            const isDeadhead = !t.line_id;
                            const dir = t.direction?.toLowerCase();
                            const isVolta = dir === 'inbound' || dir === 'volta';
                            const lineColor = t.line_id ? lineColorMap.get(t.line_id) : undefined;
                            const barColor = isDeadhead
                              ? ganttColors.deadhead
                              : lineColor
                                ? (isVolta ? alpha(lineColor, 0.7) : lineColor)
                                : (isVolta ? ganttColors.volta : ganttColors.ida);
                            const barTextColor = isDeadhead ? 'text.secondary' : 'common.white';
                            const originName = terminalsMap[t.origin_id] || t.origin_name || t.origin_id;
                            const destinationName = terminalsMap[t.destination_id] || t.destination_name || t.destination_id;

                            return (
                              <Tooltip
                                key={i}
                                arrow
                                title={
                                  <Box sx={{ p: 0.5 }}>
                                    <Typography variant="caption" display="block" fontWeight={900} sx={{ color: 'primary.light', borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.5, mb: 0.5 }}>
                                      {isDeadhead ? 'VIAGEM DE APOIO' : `LINHA ${linesMap[t.line_id!] || t.line_id}`}
                                    </Typography>
                                    <Stack spacing={0.25}>
                                      <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Horário:</span> <b>{minToHHMM(t.start_time)} → {minToHHMM(t.end_time)}</b>
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Duração:</span> <b>{minToDuration(t.duration)}</b>
                                      </Typography>
                                      <Typography variant="caption" sx={{ mt: 0.5, opacity: 0.8 }}>
                                        {originName} ➔ {destinationName}
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontSize: 9, opacity: 0.6, pt: 0.5 }}>ID: #{t.id}</Typography>
                                    </Stack>
                                  </Box>
                                }
                              >
                                <Box sx={{
                                  position: 'absolute',
                                  left: `${startP}%`,
                                  width: `${widthP}%`,
                                  top: isDeadhead ? 13 : 6,
                                  bottom: isDeadhead ? 13 : 6,
                                  bgcolor: barColor,
                                  borderRadius: isDeadhead ? 999 : 0.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  boxShadow: isDeadhead ? 'none' : '0 1px 3px rgba(0,0,0,0.15)',
                                  border: isDeadhead ? '1px solid' : 'none',
                                  borderColor: isDeadhead ? ganttColors.deadheadBorder : 'divider',
                                  transition: 'all 0.2s',
                                  height: isDeadhead ? 4 : undefined,
                                  '&:hover': { 
                                    opacity: 0.9, 
                                    transform: isDeadhead ? 'none' : 'scaleY(1.06)',
                                    zIndex: 10,
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                                  },
                                }}>
                                  {!isDeadhead && (getPercent(t.end_time ?? 0) - getPercent(t.start_time ?? 0)) > (zoom * 5) && (
                                    <Typography variant="caption" sx={{ color: barTextColor, fontSize: 10, px: 0.5, whiteSpace: 'nowrap', fontWeight: 900 }}>
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
          }, [processedBlocks, getPercent, ganttColors, zoom, linesMap, terminalsMap, lineColorMap, BLOCK_HEIGHT, SIDE_LABEL_WIDTH, ROW_HEIGHT]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={1.5}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800} sx={{ letterSpacing: -0.5 }}>Gantt de Blocos e Viagens</Typography>
        </Box>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: alpha(theme.palette.divider, 0.05), p: 0.5, borderRadius: 2 }}>
            <Button size="small" variant={zoom === 1 ? 'contained' : 'text'} onClick={() => setZoom(1)} sx={{ minWidth: 60, height: 24, fontSize: 10, borderRadius: 1.5 }}>Compacto</Button>
            <Button size="small" variant={zoom === 1.5 ? 'contained' : 'text'} onClick={() => setZoom(1.5)} sx={{ minWidth: 60, height: 24, fontSize: 10, borderRadius: 1.5 }}>Normal</Button>
            <Button size="small" variant={zoom === 3 ? 'contained' : 'text'} onClick={() => setZoom(3)} sx={{ minWidth: 60, height: 24, fontSize: 10, borderRadius: 1.5 }}>Largo</Button>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {Array.from(lineColorMap.entries()).map(([lineId, color]) => (
              <Stack key={lineId} direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 12, height: 12, bgcolor: color, borderRadius: '50%' }} />
                <Typography variant="caption" fontWeight={600}>{linesMap[lineId] || `L${lineId}`}</Typography>
              </Stack>
            ))}
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: ganttColors.deadhead, borderRadius: '50%', border: '1px solid', borderColor: ganttColors.deadheadBorder }} />
              <Typography variant="caption" fontWeight={600}>Apoio/Ocioso</Typography>
            </Stack>
          </Stack>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Box sx={{ 
          overflowX: 'auto', 
          position: 'relative',
          padding: 2,
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 4 }
        }}>
          <Box sx={{ minWidth: SIDE_LABEL_WIDTH + timelineWidth, position: 'relative', pt: 5, pb: 2 }}>
            {/* Eixo de Tempo (Header) */}
            <Box sx={{ position: 'absolute', top: 0, left: SIDE_LABEL_WIDTH, right: 0, height: 32, borderBottom: '1px solid', borderColor: 'divider', zIndex: 10 }}>
              {ticks.map(t => (
                <Box key={t} sx={{ position: 'absolute', left: `${getPercent(t)}%`, transform: 'translateX(-50%)' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: 10 }}>
                    {minToHHMM(t)}
                  </Typography>
                  <Box sx={{ position: 'absolute', left: '50%', top: 24, height: listHeight + 40, width: '1px', bgcolor: alpha(theme.palette.divider, 0.4), zIndex: 0 }} />
                </Box>
              ))}
            </Box>

            <Box sx={{ position: 'relative', zIndex: 1, mt: 4 }}>
              <List
                style={{ height: listHeight, width: '100%' }}
                rowCount={processedBlocks.length}
                rowHeight={ROW_HEIGHT}
                overscanCount={4}
                rowComponent={GanttRow}
                rowProps={{}}
              />
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
