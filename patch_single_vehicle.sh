sed -i 's/operator_single_vehicle_only: false,/operator_single_vehicle_only: activeSettings?.operatorSingleVehicleOnly ?? true,/g' backend/src/modules/optimization/optimization.service.ts
