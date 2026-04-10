#!/usr/bin/env python3
"""Debug hybrid pipeline hanging"""

import sys
import time
import logging
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

# Enable debug logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from src.domain.models import Trip, VehicleType, AlgorithmType
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

trips = [_trip(1, 360, 180), _trip(2, 560, 180), _trip(3, 780, 120)]

print(f"Testing HYBRID_PIPELINE with explicit 2s time budget")
print(f"Created {len(trips)} trips")

service = OptimizerService()

start = time.time()
try:
    result = service.run(
        trips=list(trips),
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={"max_shift_minutes": 480, "strict_hard_validation": False},
        vsp_params={"min_layover_minutes": 10},
        time_budget_s=2.0,  # Explicit 2 second budget
    )
    elapsed = time.time() - start
    print(f"\n✓ Hybrid pipeline completed in {elapsed:.2f}s")
    print(f"  Vehicles: {len(result.vsp.blocks)}")
    print(f"  Crew: {len(result.csp.duties)}")
    print(f"  Meta: {result.meta.get('performance', {})}")

except Exception as e:
    elapsed = time.time() - start
    print(f"\n✗ Hybrid pipeline failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")