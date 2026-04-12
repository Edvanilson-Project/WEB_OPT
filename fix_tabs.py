import re

with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'r') as f:
    c = f.read()

c = c.replace(
    '{tab === 0 && <TabOverview res={res} />}',
    '{tab === 0 && <TabOverview res={res} linesMap={linesMap} terminalsMap={terminalsMap} />}'
)
c = c.replace(
    '{tab === 1 && <TabVehicles res={res} />}',
    '{tab === 1 && <TabVehicles res={res} linesMap={linesMap} terminalsMap={terminalsMap} />}'
)
c = c.replace(
    '{tab === 3 && <TabTrips res={res} />}',
    '{tab === 3 && <TabTrips res={res} linesMap={linesMap} terminalsMap={terminalsMap} />}'
)

c = c.replace(
    'function TabOverview({ res }: { res: OptimizationResultSummary }) {',
    'function TabOverview({ res, linesMap, terminalsMap }: { res: OptimizationResultSummary; linesMap: Record<number, Line>; terminalsMap: Record<number, string> }) {'
)
c = c.replace(
    'function TabVehicles({ res }: { res: OptimizationResultSummary }) {',
    'function TabVehicles({ res, linesMap, terminalsMap }: { res: OptimizationResultSummary; linesMap: Record<number, Line>; terminalsMap: Record<number, string> }) {'
)
c = c.replace(
    'function TabTrips({ res }: { res: OptimizationResultSummary }) {',
    'function TabTrips({ res, linesMap, terminalsMap }: { res: OptimizationResultSummary; linesMap: Record<number, Line>; terminalsMap: Record<number, string> }) {'
)

# And now I need to drill down to DutyTableRow
c = c.replace(
    'function DutyTableRow({ duty }: { duty: OptimizationDuty }) {',
    'function DutyTableRow({ duty, linesMap, terminalsMap }: { duty: OptimizationDuty; linesMap: Record<number, Line>; terminalsMap: Record<number, string> }) {'
)
c = c.replace(
    '<DutyTableRow key={duty.duty_id} duty={duty} />',
    '<DutyTableRow key={duty.duty_id} duty={duty} linesMap={linesMap} terminalsMap={terminalsMap} />'
)

# Drill down to VehicleTableRow
c = c.replace(
    'function VehicleTableRow({ block }: { block: any }) {',
    'function VehicleTableRow({ block, linesMap, terminalsMap }: { block: any; linesMap: Record<number, Line>; terminalsMap: Record<number, string> }) {'
)
c = c.replace(
    '<VehicleTableRow key={block.block_id ?? idx} block={block} />',
    '<VehicleTableRow key={block.block_id ?? idx} block={block} linesMap={linesMap} terminalsMap={terminalsMap} />'
)

# Drill down to TripDetailTable
c = c.replace(
    'function TripDetailTable({ trips }: { trips: TripDetail[] }) {',
    'function TripDetailTable({ trips, linesMap, terminalsMap }: { trips: TripDetail[]; linesMap: Record<number, Line>; terminalsMap: Record<number, string> }) {'
)
c = c.replace(
    '<TripDetailTable trips={duty.trips as TripDetail[]} />',
    '<TripDetailTable trips={duty.trips as TripDetail[]} linesMap={linesMap} terminalsMap={terminalsMap} />'
)
c = c.replace(
    '<TripDetailTable trips={block.trips as TripDetail[]} />',
    '<TripDetailTable trips={block.trips as TripDetail[]} linesMap={linesMap} terminalsMap={terminalsMap} />'
)

with open('/home/edvanilson/WEB_OPT/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx', 'w') as f:
    f.write(c)
