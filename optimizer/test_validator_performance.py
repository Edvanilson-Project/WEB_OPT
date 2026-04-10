#!/usr/bin/env python3
"""Test validator performance with strict_hard_validation=True"""

import sys
import time
import logging
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

# Enable debug logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from src.domain.models import Trip, VehicleType, AlgorithmType
from src.services.optimizer_service import OptimizerService
from src.services.hard_constraint_validator import HardConstraintValidator

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

trips = [_trip(1, 360, 180), _trip(2, 560, 180), _trip(3, 780, 120)]
cct_params = {"max_shift_minutes": 480, "strict_hard_validation": True}
vsp_params = {"min_layover_minutes": 10}

print("Testing validator performance...")
validator = HardConstraintValidator()

print(f"\n1. Testing input audit with {len(trips)} trips, strict_hard_validation=True")
start = time.time()
input_report = validator.audit_input(trips, cct_params, vsp_params)
elapsed = time.time() - start
print(f"   Input audit took {elapsed:.3f}s: {input_report['ok']}")
if input_report['issues']:
    print(f"   Issues: {input_report['issues']}")

print(f"\n2. Testing hybrid pipeline with strict_hard_validation=True")
service = OptimizerService()
start = time.time()
try:
    result = service.run(
        trips=list(trips),
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params=cct_params,
        vsp_params=vsp_params,
        time_budget_s=5.0,
    )
    elapsed = time.time() - start
    print(f"   Hybrid pipeline completed in {elapsed:.2f}s")
    print(f"   Vehicles: {len(result.vsp.blocks)}, Crew: {len(result.csp.duties)}")

    print(f"\n3. Testing output audit")
    start = time.time()
    output_report = validator.audit_result(result, trips, cct_params, vsp_params)
    elapsed = time.time() - start
    print(f"   Output audit took {elapsed:.3f}s: {output_report['ok']}")
    if output_report['issues']:
        print(f"   Issues: {output_report['issues']}")

except Exception as e:
    elapsed = time.time() - start
    print(f"   Hybrid pipeline failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print(f"\n4. Testing with strict_hard_validation=False")
cct_params_false = {"max_shift_minutes": 480, "strict_hard_validation": False}
start = time.time()
try:
    result = service.run(
        trips=list(trips),
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params=cct_params_false,
        vsp_params=vsp_params,
        time_budget_s=5.0,
    )
    elapsed = time.time() - start
    print(f"   Hybrid pipeline completed in {elapsed:.2f}s")
    print(f"   Vehicles: {len(result.vsp.blocks)}, Crew: {len(result.csp.duties)}")

    print(f"\n5. Testing output audit (strict=False)")
    start = time.time()
    output_report = validator.audit_result(result, trips, cct_params_false, vsp_params)
    elapsed = time.time() - start
    print(f"   Output audit took {elapsed:.3f}s: {output_report['ok']}")

except Exception as e:
    elapsed = time.time() - start
    print(f"   Hybrid pipeline failed after {elapsed:.2f}s: {type(e).__name__}: {e}")

print("\nDone.")