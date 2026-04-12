import re

path = '/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Add Gráfico de Gantt Tab Header
old_tab_headers = """          <Tab icon={<IconRoute size={16} />} iconPosition="start" label="Viagens" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconFileCode size={16} />} iconPosition="start" label="Auditoria" sx={{ textTransform: 'none', fontWeight: 600 }} />"""
new_tab_headers = """          <Tab icon={<IconRoute size={16} />} iconPosition="start" label="Viagens" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconChartBar size={16} />} iconPosition="start" label="Gantt" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<IconFileCode size={16} />} iconPosition="start" label="Auditoria" sx={{ textTransform: 'none', fontWeight: 600 }} />"""
content = content.replace(old_tab_headers, new_tab_headers)

# 2. Render TabGantt when tab is 4, moving Audit to 5.
old_tab_renders = """      {tab === 3 && <TabTrips res={res} lines={lines} />}
      {tab === 4 && <TabAudit res={res} run={run} />}"""
new_tab_renders = """      {tab === 3 && <TabTrips res={res} lines={lines} />}
      {tab === 4 && <TabGantt res={res} lines={lines} />}
      {tab === 5 && <TabAudit res={res} run={run} />}"""
content = content.replace(old_tab_renders, new_tab_renders)

# 3. Inject TabGantt component implementation
gantt_component = """// ─── Tab 4: Gráfico de Gantt ───
function TabGantt({ res, lines }: { res: OptimizationResultSummary; lines: Line[] }) {
  const blocks = res.blocks || [];
  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);

  // Flatten and calculate min/max times to scale the Gantt
  let minTime = Infinity;
  let maxTime = -Infinity;
  const processedBlocks = blocks.map(b => {
    let blockMin = Infinity;
    let blockMax = -Infinity;
    
    const validTrips = (b.trips || []).filter(t => typeof t !== 'number') as TripDetail[];
    
    validTrips.forEach(t => {
      if (t.start_time !== undefined && t.start_time < minTime) minTime = t.start_time;
      if (t.end_time !== undefined && t.end_time > maxTime) maxTime = t.end_time;
      if (t.start_time !== undefined && t.start_time < blockMin) blockMin = t.start_time;
      if (t.end_time !== undefined && t.end_time > blockMax) blockMax = t.end_time;
    });
    
    return {
      ...b,
      trips: validTrips.sort((a,b) => (a.start_time ?? 0) - (b.start_time ?? 0)),
      min: blockMin !== Infinity ? blockMin : 0,
      max: blockMax !== -Infinity ? blockMax : 0
    };
  }).filter(b => b.trips.length > 0);

  if (processedBlocks.length === 0 || minTime === Infinity) {
    return <Typography color="text.secondary" py={4} textAlign="center">Sem dados suficientes para gerar o gráfico.</Typography>;
  }

  // Provide some padding around the edges
  const padding = 30; // 30 mins
  const startScale = Math.max(0, minTime - padding);
  const endScale = maxTime + padding;
  const totalRange = endScale - startScale;

  // Helper to place items relative to totalRange
  const getPercent = (time: number) => Math.max(0, Math.min(100, ((time - startScale) / totalRange) * 100));

  // Time ticks (every 2 hours)
  const ticks = [];
  const startHour = Math.floor(startScale / 60);
  const endHour = Math.ceil(endScale / 60);
  for(let h = startHour; h <= endHour; h+=2) {
    if (h * 60 >= startScale && h * 60 <= endScale) {
       ticks.push(h * 60);
    }
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Gantt de Blocos e Viagens</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 14, height: 14, bgcolor: 'primary.main', borderRadius: 0.5 }} />
            <Typography variant="caption">Viagem Comercial</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 14, height: 14, bgcolor: 'grey.300', borderRadius: 0.5 }} />
            <Typography variant="caption">Viagem Vazia / Ociosidade</Typography>
          </Stack>
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, overflowX: 'auto', bgcolor: 'grey.50' }}>
        <Box sx={{ minWidth: 800, position: 'relative', pt: 3, pb: 2 }}>
          
          {/* Time scale header */}
          <Box sx={{ position: 'relative', height: 24, mb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            {ticks.map(t => (
              <Box key={t} sx={{ position: 'absolute', left: `${getPercent(t)}%`, transform: 'translateX(-50%)' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {String(Math.floor(t % 1440 / 60)).padStart(2, '0')}:{String(t % 60).padStart(2, '0')}
                </Typography>
                <Box sx={{ position: 'absolute', left: '50%', top: 20, height: processedBlocks.length * 48 + 10, width: '1px', bgcolor: 'divider', zIndex: 0 }} />
              </Box>
            ))}
          </Box>

          {/* Blocks */}
          <Stack spacing={1} sx={{ position: 'relative', zIndex: 1, mt: 2 }}>
            {processedBlocks.map((b, idx) => (
              <Stack direction="row" key={idx} alignItems="center">
                <Box sx={{ width: 80, flexShrink: 0 }}>
                  <Typography variant="caption" fontWeight={700}>Bloco #{b.block_id}</Typography>
                </Box>
                <Box sx={{ flexGrow: 1, position: 'relative', height: 40, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200', borderRadius: 1.5, overflow: 'hidden' }}>
                  {b.trips.map((t, i) => {
                    const startP = getPercent(t.start_time ?? 0);
                    const widthP = getPercent(t.end_time ?? 0) - startP;
                    const isDeadhead = !t.line_id; // Simples assumtion, viagem vazia (deslocamento) geralmente n tem linha se for deadhead
                    
                    return (
                      <Tooltip 
                        key={i} 
                        arrow 
                        title={
                          <Box>
                            <Typography variant="caption" display="block" fontWeight={700}>Viagem #{t.id}</Typography>
                            {t.line_id && <Typography variant="caption" display="block">Linha: {linesMap[t.line_id] || t.line_id} {t.direction === 'ida' ? '(Ida)' : t.direction === 'volta' ? '(Volta)' : ''}</Typography>}
                            <Typography variant="caption" display="block">Início: {minToHHMM(t.start_time)}</Typography>
                            <Typography variant="caption" display="block">Fim: {minToHHMM(t.end_time)}</Typography>
                            <Typography variant="caption" display="block">Origem: {t.origin_name || t.origin_id}</Typography>
                            <Typography variant="caption" display="block">Destino: {t.destination_name || t.destination_id}</Typography>
                          </Box>
                        }
                      >
                        <Box sx={{
                          position: 'absolute',
                          left: `${startP}%`,
                          width: `${Math.max(widthP, 0.5)}%`,
                          height: '100%',
                          bgcolor: isDeadhead ? 'grey.400' : 'primary.main',
                          borderRight: '1px solid white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}>
                          {widthP > 3 && (
                            <Typography variant="caption" sx={{ color: isDeadhead ? 'text.primary' : 'white', fontSize: 10, px: 0.5, whiteSpace: 'nowrap' }}>
                              {isDeadhead ? 'DH' : (linesMap[t.line_id as any] || t.id)}
                            </Typography>
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

"""

content = content.replace('// ─── Tab 4: Auditoria (Raw JSON) ───', gantt_component + '// ─── Tab 5: Auditoria (Raw JSON) ───')

with open(path, 'w') as f:
    f.write(content)

