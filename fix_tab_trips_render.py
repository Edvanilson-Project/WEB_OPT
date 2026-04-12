import re

path = '/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx'
with open(path, 'r') as f:
    content = f.read()

# Modify TabTrips Header
old_header = """<TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Duração</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>ID</TableCell>"""

new_header = """<TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700 }}>Duração</TableCell>
                <TableCell sx={{ py: 1, fontWeight: 700, width: 80 }}>Identificadores</TableCell>"""
content = content.replace(old_header, new_header)

# Modify TabTrips Row Render
old_row = """<TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{t.origin_name || t.origin_id || '--'}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{t.destination_name || t.destination_id || '--'}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToDuration(t.duration)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}><Typography variant="caption" fontWeight={700}>#{t.id}</Typography></TableCell>"""

new_row = """<TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" display="block">{t.origin_name || t.origin_id || '--'}</Typography>
                    {(t as any).line_id && <Chip size="small" label={linesMap[(t as any).line_id] || (t as any).line_id} sx={{ height: 16, fontSize: 9 }} />}
                    {(t as any).direction && <Typography variant="caption" color="text.secondary" ml={0.5}>{(t as any).direction === 'ida' ? 'Ida' : 'Volta'}</Typography>}
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" display="block">{t.destination_name || t.destination_id || '--'}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToDuration(t.duration)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Typography variant="caption" fontWeight={700} display="block">V: #{t.id}</Typography>
                    {(t as any).duty_id && <Typography variant="caption" color="success.main" display="block">P: #{(t as any).duty_id}</Typography>}
                    {(t as any).block_id && <Typography variant="caption" color="info.main" display="block">B: #{(t as any).block_id}</Typography>}
                  </TableCell>"""
content = content.replace(old_row, new_row)
content = content.replace('<TabTrips res={res} />', '<TabTrips res={res} lines={lines} />')

with open(path, 'w') as f:
    f.write(content)

