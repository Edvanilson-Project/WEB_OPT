sed -i 's/allow_vehicle_split_shifts: true,/allow_vehicle_split_shifts: activeSettings?.allowVehicleSplitShifts ?? true,/g' backend/src/modules/optimization/optimization.service.ts
