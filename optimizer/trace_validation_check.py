#!/usr/bin/env python3
"""Trace exactly what happens in validation check"""

import sys
import os
import time
import logging
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

# Enable detailed logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

print("Tracing validation check execution...")

# Recreate the exact check_daily_shift_limit function
def _trip(trip_id, start, duration):
    from src.domain.models import Trip
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

def _vehicle(electric=False):
    from src.domain.models import VehicleType
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

trips = [
    _trip(1, 360, 180),
    _trip(2, 560, 180),
    _trip(3, 780, 120),
]

print(f"Created {len(trips)} trips")

from src.services.optimizer_service import OptimizerService
from src.domain.models import AlgorithmType

print("\nCreating OptimizerService...")
service = OptimizerService()

print("\nRunning optimizer with EXACT validation parameters...")
print("Algorithm: HYBRID_PIPELINE")
print("cct_params: {'max_shift_minutes': 480, 'strict_hard_validation': True}")
print("vsp_params: {'min_layover_minutes': 10}")
print("electric: False")

start = time.time()
try:
    result = service.run(
        trips=list(trips),
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={"max_shift_minutes": 480, "strict_hard_validation": True},
        vsp_params={"min_layover_minutes": 10},
    )
    elapsed = time.time() - start
    print(f"\n✓ Optimization completed in {elapsed:.2f}s")
    print(f"  Vehicles: {len(result.vsp.blocks)}")
    print(f"  Crew: {len(result.csp.duties)}")

    spreads = [d.spread_time for d in result.csp.duties]
    print(f"  Spreads: {spreads}")
    print(f"  Max spread: {max(spreads) if spreads else 0}")

except Exception as e:
    elapsed = time.time() - start
    print(f"\n✗ Optimization failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nTrace complete.")