import re

with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace('import {\n  Box, Grid, Typography, Button, Stack, Tooltip,\n  IconButton, Chip, Divider, LinearProgress, Alert, AlertTitle,\n  TextField, MenuItem, Card,',
'''import {
  Box, Grid, Typography, Button, Stack, Tooltip,
  IconButton, Chip, Divider, LinearProgress, Alert, AlertTitle,
  TextField, MenuItem, Card, Dialog, DialogTitle, DialogContent, DialogActions,''')

# 2. Add properties to state hook
state_hook = "const [selectedRun, setSelectedRun] = useState<OptimizationRun | null>(null);"
new_state = state_hook + "\n  const [runName, setRunName] = useState('');\n  const [openLaunchModal, setOpenLaunchModal] = useState(false);\n  const [historySearch, setHistorySearch] = useState('');"
content = content.replace(state_hook, new_state)

# 3. TripDetailTable meal break logic
old_tdt = """function TripDetailTable({ trips }: { trips: TripDetail[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 1, maxHeight: 300 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Duração</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>ID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trips.slice().sort((a,b) => (a.start_time ?? 0) - (b.start_time ?? 0)).map((t, i) => (
            <TableRow key={i} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{t.origin_name || t.origin_id || '--'}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{t.destination_name || t.destination_id || '--'}</TableCell>
              <TableCell sx={{ py: 0.75 }}>{minToDuration(t.duration)}</TableCell>
              <TableCell sx={{ py: 0.75 }}><Typography variant="caption" fontWeight={700}>#{t.id}</Typography></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}"""

new_tdt = """function TripDetailTable({ trips }: { trips: TripDetail[] }) {
  const sorted = trips.slice().sort((a,b) => (a.start_time ?? 0) - (b.start_time ?? 0));
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 1, maxHeight: 300 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Duração</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>ID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((t, i) => {
            const gap = i > 0 && sorted[i - 1].end_time && t.start_time ? (t.start_time - sorted[i - 1].end_time!) : 0;
            return (
              <React.Fragment key={i}>
                {gap > 0 && (
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell colSpan={6} sx={{ py: 0.5, textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, color: 'text.secondary' }}>
                        {gap >= 30 ? `Refeição / Descanso Ocioso: ${gap}min (Pausa Regulatória: ${Math.min(gap, 60)}min)` : `Intervalo Ocioso: ${gap}min`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{t.origin_name || t.origin_id || '--'}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{t.destination_name || t.destination_id || '--'}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToDuration(t.duration)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}><Typography variant="caption" fontWeight={700}>#{t.id}</Typography></TableCell>
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}"""
content = content.replace(old_tdt, new_tdt)

# 4. KpiStrip update
old_kpi = """function KpiStrip({ res }: { res: OptimizationResultSummary }) {
  const items = [
    { label: 'Custo Total', value: fmtCurrency(res.total_cost || res.totalCost), color: 'primary.main', icon: <IconCurrencyDollar size={20} /> },
    { label: 'Veículos (VSP)', value: res.vehicles ?? res.num_vehicles ?? '--', color: 'info.main', icon: <IconBus size={20} /> },
    { label: 'Tripulantes (CSP)', value: res.crew ?? res.num_crew ?? '--', color: 'success.main', icon: <IconUsers size={20} /> },
    { label: 'Violações CCT', value: res.cct_violations ?? res.cctViolations ?? 0, color: (res.cct_violations ?? res.cctViolations ?? 0) > 0 ? 'error.main' : 'success.main', icon: <IconShieldCheck size={20} /> },
  ];"""

new_kpi = """function KpiStrip({ res, run }: { res: OptimizationResultSummary; run: OptimizationRun }) {
  const items = [
    { label: 'Custo Total', value: fmtCurrency(run.totalCost ?? res.total_cost ?? res.totalCost), color: 'primary.main', icon: <IconCurrencyDollar size={20} /> },
    { label: 'Veículos (VSP)', value: run.totalVehicles ?? res.vehicles ?? res.num_vehicles ?? '--', color: 'info.main', icon: <IconBus size={20} /> },
    { label: 'Tripulantes (CSP)', value: run.totalCrew ?? res.crew ?? res.num_crew ?? '--', color: 'success.main', icon: <IconUsers size={20} /> },
    { label: 'Violações CCT', value: run.cctViolations ?? res.cct_violations ?? res.cctViolations ?? 0, color: (run.cctViolations ?? res.cct_violations ?? res.cctViolations ?? 0) > 0 ? 'error.main' : 'success.main', icon: <IconShieldCheck size={20} /> },
  ];"""
content = content.replace(old_kpi, new_kpi)
content = content.replace('<KpiStrip res={res} />', '<KpiStrip res={res} run={run} />')

# 5. HandleLaunch logic
old_handle_launch = """  const handleLaunch = async () => {
    if (!selectedLineIds.length) return notify.warning('Selecione ao menos uma linha.');
    setLaunching(true);
    try {
      const payload: any = {
        companyId: getSessionUser()?.companyId ?? 1,
        algorithm: algorithm as OptimizationAlgorithm,
        operationMode,
        timeBudgetSeconds: timeBudget,
      };
      if (selectedLineIds.length === 1) payload.lineId = selectedLineIds[0];
      else payload.lineIds = selectedLineIds;
      await optimizationApi.run(payload);
      notify.success(`Iniciado: ${algorithm} · ${operationMode === 'charter' ? 'Fretamento' : 'Urbano'} · ${timeBudget}s`);
      setSelectedLineIds([]);
      loadAll();"""

new_handle_launch = """  const handleLaunch = async () => {
    if (!selectedLineIds.length) return notify.warning('Selecione ao menos uma linha.');
    setLaunching(true);
    try {
      const payload: any = {
        name: runName || undefined,
        companyId: getSessionUser()?.companyId ?? 1,
        algorithm: algorithm as OptimizationAlgorithm,
        operationMode,
        timeBudgetSeconds: timeBudget,
      };
      if (selectedLineIds.length === 1) payload.lineId = selectedLineIds[0];
      else payload.lineIds = selectedLineIds;
      await optimizationApi.run(payload);
      notify.success('Otimização Iniciada com Sucesso');
      setSelectedLineIds([]);
      setRunName('');
      setOpenLaunchModal(false);
      loadAll();"""
content = content.replace(old_handle_launch, new_handle_launch)


# 6. Change left panel + Add modal to the end.
match = re.search(r'\{/\* LEFT: LAUNCH \+ HISTORY \*/\}.*?(?=\{/\* RIGHT: Multi-Tab View \*/\})', content, re.DOTALL)
left_menu_code = match.group(0)

new_left_menu = """{/* LEFT: HISTORY TABLE */}
          <Grid item xs={12} md={3}>
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" fontWeight={700}>Histórico</Typography>
              <Button size="small" variant="contained" startIcon={<IconPlayerPlay size={16} />} onClick={() => setOpenLaunchModal(true)} disabled={activeRun != null}>
                Otimizar
              </Button>
            </Box>
            
            <TextField 
              fullWidth size="small" placeholder="Buscar histórico..." sx={{ mb: 2 }}
              value={historySearch} onChange={e => setHistorySearch(e.target.value)}
            />
            
            {historyRuns.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Nenhuma execução.</Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 'calc(100vh - 200px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 1, fontWeight: 700 }}>ID/Nome</TableCell>
                      <TableCell sx={{ py: 1, fontWeight: 700 }} align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historyRuns
                      .filter(r => !historySearch || String(r.id).includes(historySearch) || (r as any).name?.toLowerCase().includes(historySearch.toLowerCase()))
                      .slice(0, 15).map((r) => (
                      <TableRow 
                        key={r.id} hover onClick={() => setSelectedRun(r)}
                        sx={{ cursor: 'pointer', bgcolor: selectedRun?.id === r.id ? 'primary.light' : 'inherit' }}
                      >
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="caption" fontWeight={700}>#{r.id}{(r as any).name ? ` - ${(r as any).name}` : ''}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">{new Date(r.createdAt || '').toLocaleString('pt-BR')}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1 }} align="right">
                          {r.status === 'failed' ? (
                            <Chip size="small" color="error" label="Falhou" sx={{ height: 20, fontSize: 11 }} />
                          ) : (
                            <Typography variant="caption" fontWeight={700} color="success.main">{fmtCurrency(r.totalCost)}</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>

          """
content = content.replace(left_menu_code, new_left_menu)

# Modal appending before </PageContainer>
modal_content = """
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
content = content.replace('      </PageContainer>', modal_content + '\n      </PageContainer>')

with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'w') as f:
    f.write(content)

