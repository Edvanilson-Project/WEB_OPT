#!/usr/bin/env python3
"""Test exact validation logic with timeout"""

import sys
import time
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

from src.domain.models import AlgorithmType, Trip, VehicleType
from src.services.optimizer_service import OptimizerService

def _trip(trip_id, start, duration, line=10, origin=1, dest=2, depot=1):
    return Trip(
        id=trip_id,
        line_id=line,
        start_time=start,
        end_time=start + duration,
        origin_id=origin,
        destination_id=dest,
        duration=duration,
        distance_km=max(1.0, duration / 3),
        depot_id=depot,
        is_relief_point=False,
        energy_kwh=0.0,
        elevation_gain_m=0.0,
        deadhead_times={origin: 8, dest: 8, 1: 10, 2: 10, 3: 10, 4: 10},
    )

def _vehicle(electric=False):
    return [
        VehicleType(
            id=1,
            name="EV" if electric else "Diesel",
            passenger_capacity=42,
            cost_per_km=2.0,
            cost_per_hour=50.0,
            fixed_cost=800.0,
            is_electric=electric,
            battery_capacity_kwh=60.0 if electric else 0.0,
            minimum_soc=0.2 if electric else 0.0,
            charge_rate_kw=60.0 if electric else 0.0,
            energy_cost_per_kwh=0.9 if electric else 0.0,
            depot_id=1,
        )
    ]

def _run_optimizer(trips, algorithm=AlgorithmType.HYBRID_PIPELINE, cct=None, vsp=None, electric=False):
    service = OptimizerService()
    return service.run(
        trips=list(trips),
        vehicle_types=_vehicle(electric=electric),
        algorithm=algorithm,
        cct_params=cct or {},
        vsp_params=vsp or {},
        time_budget_s=30.0,  # ADD TIMEOUT
    )

print("Testing exact validation logic with timeout...")
start = time.time()

try:
    trips = [
        _trip(1, 360, 180, line=10, origin=1, dest=2),
        _trip(2, 560, 180, line=10, origin=2, dest=1),
        _trip(3, 780, 120, line=10, origin=1, dest=2),
    ]
    result = _run_optimizer(
        trips,
        cct={"max_shift_minutes": 480, "strict_hard_validation": True},
        vsp={"min_layover_minutes": 10},
    )
    spreads = [d.spread_time for d in result.csp.duties]
    ok = bool(spreads) and max(spreads) <= 480

    elapsed = time.time() - start
    print(f"✓ Completed in {elapsed:.2f}s")
    print(f"  Result: {ok}, max_spread={max(spreads) if spreads else 0} duties={len(spreads)}")

except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")