import re

with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'r') as f:
    c = f.read()

# 1. Update TripDetailTable
old_tdt = r'''function TripDetailTable\(\{ trips, linesMap, terminalsMap \}: \{ trips: TripDetail\[\]; linesMap: Record<number, Line>; terminalsMap: Record<number, string> \}\) \{
  const sorted = trips.slice\(\).sort\(\(a,b\) => \(a.start_time \?\? 0\) - \(b.start_time \?\? 0\)\);
  return \(
    <TableContainer component=\{Paper\} variant="outlined" sx=\{\{ borderRadius: 2, mt: 1, maxHeight: 300 \}\}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx=\{\{ py: 1, fontWeight: 700 \}\}>Início</TableCell>
            <TableCell sx=\{\{ py: 1, fontWeight: 700 \}\}>Fim</TableCell>
            <TableCell sx=\{\{ py: 1, fontWeight: 700 \}\}>Origem</TableCell>
            <TableCell sx=\{\{ py: 1, fontWeight: 700 \}\}>Destino</TableCell>
            <TableCell sx=\{\{ py: 1, fontWeight: 700 \}\}>Duração</TableCell>
            <TableCell sx=\{\{ py: 1, fontWeight: 700 \}\}>ID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          \{sorted.map\(\(t, i\) => \{
            const gap = i > 0 && sorted\[i - 1\].end_time && t.start_time \? \(t.start_time - sorted\[i - 1\].end_time!\) : 0;
            return \(
              <React.Fragment key=\{i\}>
                \{gap > 0 && \(
                  <TableRow sx=\{\{ bgcolor: 'grey.100' \}\}>
                    <TableCell colSpan=\{6\} sx=\{\{ py: 0.5, textAlign: 'center' \}\}>
                      <Typography variant="caption" sx=\{\{ fontStyle: 'italic', fontWeight: 600, color: 'text.secondary' \}\}>
                        \{gap >= 30 \? `Refeição / Descanso Ocioso: \$\{gap\}min \(Pausa Regulatória: \$\{Math.min\(gap, 60\)\}min\)` : `Intervalo Ocioso: \$\{gap\}min`\}
                      </Typography>
                    </TableCell>
                  </TableRow>
                \)\}
                <TableRow sx=\{\{ '&:last-child td': \{ border: 0 \} \}\}>
                  <TableCell sx=\{\{ py: 0.75 \}\}>\{minToHHMM\(t.start_time\)\}</TableCell>
                  <TableCell sx=\{\{ py: 0.75 \}\}>\{minToHHMM\(t.end_time\)\}</TableCell>
                  <TableCell sx=\{\{ py: 0.75 \}\}>\{t.origin_name \|\| t.origin_id || '--'\}</TableCell>
                  <TableCell sx=\{\{ py: 0.75 \}\}>\{t.destination_name \|\| t.destination_id \|\| '--'\}</TableCell>
                  <TableCell sx=\{\{ py: 0.75 \}\}>\{minToDuration\(t.duration\)\}</TableCell>
                  <TableCell sx=\{\{ py: 0.75 \}\}>
                    <Typography variant="caption" fontWeight=\{700\}>#\{t.id\}</Typography>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            \);
          \}\)}
        </TableBody>
      </Table>
    </TableContainer>
  \);
\}'''

new_tdt = """function TripDetailTable({ trips, linesMap, terminalsMap }: { trips: TripDetail[]; linesMap: Record<number, Line>; terminalsMap: Record<number, string> }) {
  const sorted = trips.slice().sort((a,b) => (a.start_time ?? 0) - (b.start_time ?? 0));

  const getTerminalName = (name?: string, id?: string|number) => {
    if (id && terminalsMap && terminalsMap[Number(id)]) return terminalsMap[Number(id)];
    return name || id || '--';
  };

  const getLineCode = (id?: number|null) => {
    if (!id) return '--';
    return linesMap && linesMap[id] ? linesMap[id].code : id;
  };

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 1, maxHeight: 300 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Início</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Fim</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Origem</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Destino</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Linha</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Sentido</TableCell>
            <TableCell sx={{ py: 1, fontWeight: 700 }}>Plantão</TableCell>
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
                    <TableCell sx={{ py: 0.5 }}>{minToHHMM(sorted[i - 1].end_time)}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{minToHHMM(t.start_time)}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{getTerminalName(sorted[i - 1].destination_name, sorted[i - 1].destination_id)}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{getTerminalName(t.origin_name, t.origin_id)}</TableCell>
                    <TableCell colSpan={3} sx={{ py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, color: 'text.secondary' }}>
                        {gap >= 30 ? `Refeição / Descanso (Pausa Regulatória: ${Math.min(gap, 60)}m)` : `Ocioso Tolerância`}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>{gap}min</TableCell>
                    <TableCell sx={{ py: 0.5 }}><Chip size="small" variant="outlined" label="Gap" sx={{ height: 20 }} /></TableCell>
                  </TableRow>
                )}
                <TableRow sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.start_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{minToHHMM(t.end_time)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{getTerminalName(t.origin_name, t.origin_id)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{getTerminalName(t.destination_name, t.destination_id)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{getLineCode(t.line_id)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{(t as any).direction === 'inbound' ? 'Volta' : (t as any).direction === 'outbound' ? 'Ida' : '--'}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{(t as any).duty_id ? `Plantão #${(t as any).duty_id}` : '--'}</TableCell>
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

c = re.sub(old_tdt, new_tdt, c, flags=re.DOTALL)
with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'w') as f:
    f.write(c)

