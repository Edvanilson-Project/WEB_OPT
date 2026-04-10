#!/usr/bin/env python3
"""Minimal test that mimics validation check without importing the module"""

import sys
import time
import math
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

def check_daily_shift_limit():
    """Copy of check_daily_shift_limit from qa_professional_validation_2026.py"""
    trips = [
        _trip(1, 360, 180, line=10, origin=1, dest=2),
        _trip(2, 560, 180, line=10, origin=2, dest=1),
        _trip(3, 780, 120, line=10, origin=1, dest=2),
    ]
    service = OptimizerService()
    result = service.run(
        trips=list(trips),
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={"max_shift_minutes": 480, "strict_hard_validation": True},
        vsp_params={"min_layover_minutes": 10},
        time_budget_s=30.0,  # Add timeout to match test_single_validation.py
    )
    spreads = [d.spread_time for d in result.csp.duties]
    ok = bool(spreads) and max(spreads) <= 480
    return ok, f"max_spread={max(spreads) if spreads else 0} duties={len(spreads)}"

print("Testing minimal validation check...")
start = time.time()

try:
    ok, detail = check_daily_shift_limit()
    elapsed = time.time() - start
    print(f"✓ Check completed in {elapsed:.2f}s")
    print(f"  Result: {ok}, Detail: {detail}")
except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Check failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")