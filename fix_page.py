import re

with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'r') as f:
    content = f.read()

# Replace left menu
left_menu_start = content.find('          {/* LEFT: LAUNCH + HISTORY */}')
left_menu_end = content.find('          {/* RIGHT: Multi-Tab View */}')

new_left_menu = """          {/* LEFT: HISTORY TABLE */}
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
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 600 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 1, fontWeight: 700 }}>ID/Nome</TableCell>
                      <TableCell sx={{ py: 1, fontWeight: 700 }} align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historyRuns
                      .filter(r => !historySearch || String(r.id).includes(historySearch) || (r as any).runName?.toLowerCase().includes(historySearch.toLowerCase()))
                      .slice(0, 15).map((r) => (
                      <TableRow 
                        key={r.id} hover onClick={() => setSelectedRun(r)}
                        sx={{ cursor: 'pointer', bgcolor: selectedRun?.id === r.id ? 'primary.light' : 'inherit' }}
                      >
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="caption" fontWeight={700}>#{r.id} {(r as any).runName ? `- ${(r as any).runName}` : ''}</Typography>
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

content = content[:left_menu_start] + new_left_menu + '\n' + content[left_menu_end:]

# Add Modal to end of file, before </PageContainer>
modal_start = content.find('      </PageContainer>')
modal_content = """        <Dialog open={openLaunchModal} onClose={() => setOpenLaunchModal(false)} maxWidth="xs" fullWidth>
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
          <DialogActions>
            <Button onClick={() => setOpenLaunchModal(false)} color="inherit">Cancelar</Button>
            <Button variant="contained" onClick={handleLaunch} disabled={launching} startIcon={launching ? <IconRefresh /> : <IconPlayerPlay />}>
              {launching ? "Iniciando..." : "Otimizar"}
            </Button>
          </DialogActions>
        </Dialog>
"""

content = content[:modal_start] + modal_content + content[modal_start:]

with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'w') as f:
    f.write(content)

