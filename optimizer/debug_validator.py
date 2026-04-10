#!/usr/bin/env python3
"""Debug validator performance"""

import sys
import time
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

from src.domain.models import Trip, VehicleType, AlgorithmType, Block, Duty, VSPSolution, CSPSolution, OptimizationResult
from src.services.hard_constraint_validator import HardConstraintValidator
from src.services.optimizer_service import OptimizerService

def _trip(trip_id, start, duration):
    return Trip(
        id=trip_id,
        line_id=10,
        start_time=start,
        end_time=start + duration,
        origin_id=1,
        destination_id=2,
        duration=duration,
        distance_km=max(1.0, duration / 3),
        depot_id=1,
        is_relief_point=False,
        energy_kwh=0.0,
        elevation_gain_m=0.0,
        deadhead_times={1: 10, 2: 10, 3: 10, 4: 10},
    )

def _vehicle():
    return [
        VehicleType(
            id=1,
            name="Diesel",
            passenger_capacity=42,
            cost_per_km=2.0,
            cost_per_hour=50.0,
            fixed_cost=800.0,
            is_electric=False,
            battery_capacity_kwh=0.0,
            minimum_soc=0.0,
            charge_rate_kw=0.0,
            energy_cost_per_kwh=0.0,
            depot_id=1,
        )
    ]

print("Creating validator and test data...")
validator = HardConstraintValidator()

trips = [_trip(1, 360, 180), _trip(2, 560, 180), _trip(3, 780, 120)]
cct_params = {"max_shift_minutes": 480, "strict_hard_validation": True}
vsp_params = {"min_layover_minutes": 10}

print(f"Testing input audit with {len(trips)} trips...")
start = time.time()
input_report = validator.audit_input(trips, cct_params, vsp_params)
elapsed = time.time() - start
print(f"Input audit took {elapsed:.3f}s: {input_report['ok']}")

print("\nCreating mock result for output audit...")
# Create minimal mock result
block = Block(
    id=1,
    trips=trips,
    vehicle_type_id=1,
    start_time=trips[0].start_time,
    end_time=trips[-1].end_time,
    cost=1000.0
)

duty = Duty(
    id=1,
    block_ids=[1],
    tasks=[],  # Simplified
    spread_time=400,
    warnings=[],
    meta={"start_depot_id": 1, "end_depot_id": 1}
)

vsp_solution = VSPSolution(
    blocks=[block],
    unassigned_trips=[],
    cost=1000.0,
    warnings=[]
)

csp_solution = CSPSolution(
    duties=[duty],
    uncovered_blocks=[],
    cost=800.0,
    warnings=[]
)

result = OptimizationResult(
    vsp=vsp_solution,
    csp=csp_solution,
    algorithm=AlgorithmType.HYBRID_PIPELINE,
    total_cost=1800.0,
    meta={}
)

print(f"Testing output audit...")
start = time.time()
try:
    output_report = validator.audit_result(result, trips, cct_params, vsp_params)
    elapsed = time.time() - start
    print(f"Output audit took {elapsed:.3f}s: {output_report['ok']}")
    print(f"  Issues: {output_report['issues']}")
except Exception as e:
    elapsed = time.time() - start
    print(f"Output audit failed after {elapsed:.3f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nTesting with strict_hard_validation=False...")
cct_params_false = {"max_shift_minutes": 480, "strict_hard_validation": False}
start = time.time()
try:
    output_report = validator.audit_result(result, trips, cct_params_false, vsp_params)
    elapsed = time.time() - start
    print(f"Output audit (strict=False) took {elapsed:.3f}s: {output_report['ok']}")
    print(f"  Issues: {output_report['issues']}")
except Exception as e:
    elapsed = time.time() - start
    print(f"Output audit (strict=False) failed after {elapsed:.3f}s: {type(e).__name__}: {e}")

print("\nDone.")