import re

path = '/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Add the missing Dialog
dialog_str = """
        <Dialog open={openLaunchModal} onClose={() => setOpenLaunchModal(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Nova Otimização</DialogTitle>
          <DialogContent dividers>
            <TextField 
              fullWidth size="small" label="Nome da Execução (Opcional)" value={runName}
              onChange={(e) => setRunName(e.target.value)} sx={{ mb: 2, mt: 1 }}
            />
            <TextField
              select fullWidth size="small" label="Linhas"
              SelectProps={{ multiple: true }} value={selectedLineIds}
              onChange={(e) => setSelectedLineIds(typeof e.target.value === 'string' ? [] : e.target.value as number[])}
              sx={{ mb: 2 }}
            >
              {lines.map((l) => <MenuItem key={l.id} value={l.id}>{l.code} — {l.name}</MenuItem>)}
            </TextField>
            <TextField
              select fullWidth size="small" label="Algoritmo" value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)} sx={{ mb: 2 }}
            >
              <MenuItem value="hybrid_pipeline">Hybrid Pipeline (Padrão)</MenuItem>
              <MenuItem value="greedy">Greedy (Rápido)</MenuItem>
              <MenuItem value="simulated_annealing">Simulated Annealing</MenuItem>
              <MenuItem value="tabu_search">Tabu Search</MenuItem>
              <MenuItem value="set_partitioning">Set Partitioning (ILP)</MenuItem>
              <MenuItem value="joint_solver">Joint Solver</MenuItem>
            </TextField>
            <TextField
              select fullWidth size="small" label="Modo de Operação" value={operationMode}
              onChange={(e) => setOperationMode(e.target.value as 'urban' | 'charter')} sx={{ mb: 2 }}
            >
              <MenuItem value="urban">🚍 Urbano (CCT padrão)</MenuItem>
              <MenuItem value="charter">🚌 Fretamento (turno flexível)</MenuItem>
            </TextField>
            <TextField
              fullWidth size="small" label="Budget (segundos)" type="number"
              value={timeBudget}
              onChange={(e) => setTimeBudget(Math.max(5, parseInt(e.target.value) || 30))}
              inputProps={{ min: 5, max: 600 }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenLaunchModal(false)} color="inherit">Cancelar</Button>
            <Button variant="contained" onClick={handleLaunch} disabled={launching} startIcon={launching ? <IconRefresh /> : <IconPlayerPlay />}>
              {launching ? "Iniciando..." : "Otimizar"}
            </Button>
          </DialogActions>
        </Dialog>
"""

content = content.replace('    </PageContainer>\n  );\n}', dialog_str + '    </PageContainer>\n  );\n}')

# 2, 3 & 4. Origins, Destinations, Duties mapping in Table!
old_trip_detail_table = """function TripDetailTable({ trips }: { trips: TripDetail[] }) {"""

new_trip_detail_table = """function TripDetailTable({ trips, dutyId, linesMap = {} }: { trips: TripDetail[]; dutyId?: string | number, linesMap?: Record<string, string> }) {"""
content = content.replace(old_trip_detail_table, new_trip_detail_table)

# Fixing the actual trip mapping variables
# Old
old_trip_row = """                  <TableCell sx={{ py: 0.75 }}>{t.origin_name || t.origin_id || '--'}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{t.destination_name || t.destination_id || '--'}</TableCell>"""

new_trip_row = """                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" display="block">{t.origin_name || t.origin_id || '--'}</Typography>
                    {(t as any).line_id && <Chip size="small" label={linesMap[(t as any).line_id] || (t as any).line_id} sx={{ height: 16, fontSize: 9 }} />}
                    {(t as any).direction && <Typography variant="caption" color="text.secondary" ml={0.5}>{(t as any).direction === 'ida' ? 'Ida' : 'Volta'}</Typography>}
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" display="block">{t.destination_name || t.destination_id || '--'}</Typography>
                  </TableCell>"""
content = content.replace(old_trip_row, new_trip_row)

old_trip_gap = """<Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, color: 'text.secondary' }}>
                        {gap >= 30 ? `Refeição / Descanso Ocioso: ${gap}min (Pausa Regulatória: ${Math.min(gap, 60)}min)` : `Intervalo Ocioso: ${gap}min`}
                      </Typography>"""

new_trip_gap = """<Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
                        <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, color: 'text.secondary' }}>
                          {gap >= 30 ? `Refeição/Descanso: Início ${minToHHMM(sorted[i - 1].end_time!)} — Fim ${minToHHMM(t.start_time!)} (${gap}min)` : `Intervalo Ocioso: Início ${minToHHMM(sorted[i - 1].end_time!)} — Fim ${minToHHMM(t.start_time!)} (${gap}min)`}
                        </Typography>
                        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                          Local: {sorted[i - 1].destination_name || sorted[i - 1].destination_id} → {t.origin_name || t.origin_id}
                        </Typography>
                      </Stack>"""
content = content.replace(old_trip_gap, new_trip_gap)

old_table_call = """<TripDetailTable trips={duty.trips as TripDetail[]} />"""
new_table_call = """<TripDetailTable trips={duty.trips as TripDetail[]} dutyId={duty.duty_id} linesMap={(window as any).__linesMap || {}} />"""
content = content.replace(old_table_call, new_table_call)

# Add line map global variable so we avoid prop drilling just for this quick fix
line_map_setup = """  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);"""
line_map_setup_new = """  const linesMap = useMemo(() => Object.fromEntries((lines ?? []).map(l => [l.id, l.code])), [lines]);
  useEffect(() => { (window as any).__linesMap = linesMap; }, [linesMap]);"""
content = content.replace(line_map_setup, line_map_setup_new)


with open(path, 'w') as f:
    f.write(content)

