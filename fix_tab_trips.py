import re

path = '/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx'
with open(path, 'r') as f:
    content = f.read()

# TabTrips logic upgrade
old_tab_trips_start = """function TabTrips({ res }: { res: OptimizationResultSummary }) {"""
new_tab_trips_start = """function TabTrips({ res, lines }: { res: OptimizationResultSummary, lines: Line[] }) {"""
content = content.replace(old_tab_trips_start, new_tab_trips_start)

# Add trip tracking logic (duty and block) inside TabTrips
old_flatten = """  // Flatten all trips from blocks with their block assignment
  const assignedTrips: any[] = [];
  blocks.forEach((b) => {
    const rawTrips = b.trips || [];
    rawTrips.forEach((t) => {
      if (typeof t === 'number') {
        // Formato legado (runs antigos): apenas ID disponível
        assignedTrips.push({ id: t, trip_id: t, start_time: null, end_time: null, origin_id: '--', destination_id: '--', duration: 0, block_id: b.block_id, status: 'assigned' as const });
      } else {
        assignedTrips.push({ ...(t as TripDetail), block_id: b.block_id, status: 'assigned' as const });
      }
    });
  });
  
  // Also check duties for trips (legacy fallback)
  const duties = res.duties || [];
  if (assignedTrips.length === 0) {
    duties.forEach((d: OptimizationDuty) => {
      (d.trips || []).forEach((t: TripDetail) => {
        assignedTrips.push({ ...t, status: 'assigned' as const });
      });
    });
  }"""

new_flatten = """  const duties = res.duties || [];
  const linesMap = Object.fromEntries((lines ?? []).map(l => [l.id, l.code]));
  
  // Maps trip ID to duty ID and block ID
  const tripToDuty: Record<number, number | string> = {};
  duties.forEach(d => {
    (d.trips || []).forEach(t => {
      const tripId = typeof t === 'object' ? t.id : t;
      tripToDuty[tripId as number] = d.duty_id;
    });
  });

  const tripToBlock: Record<number, number | string> = {};
  blocks.forEach(b => {
    (b.trips || []).forEach(t => {
      const tripId = typeof t === 'object' ? t.id : t;
      tripToBlock[tripId as number] = b.block_id;
    });
  });

  const allTripObjects = new Map<number, any>();
  
  // Collect from blocks
  blocks.forEach(b => {
    (b.trips || []).forEach(t => {
      if (typeof t !== 'number') allTripObjects.set(t.id, t);
    });
  });
  // Collect from duties
  duties.forEach(d => {
    (d.trips || []).forEach(t => {
      if (typeof t !== 'number') allTripObjects.set(t.id, t);
    });
  });

  const assignedTrips = Array.from(allTripObjects.values()).map(t => ({
    ...t,
    status: 'assigned',
    duty_id: tripToDuty[t.id],
    block_id: tripToBlock[t.id],
  }));"""

content = content.replace(old_flatten, new_flatten)

with open(path, 'w') as f:
    f.write(content)

