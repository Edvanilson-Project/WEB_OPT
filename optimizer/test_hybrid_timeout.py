#!/usr/bin/env python3
"""Test hybrid pipeline with timeout signal"""

import sys
import time
import signal
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException("Test timed out")

signal.signal(signal.SIGALRM, timeout_handler)

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

print(f"Testing HYBRID_PIPELINE with strict_hard_validation=False (5s timeout)")
print(f"Created {len(trips)} trips")

service = OptimizerService()

signal.alarm(5)  # 5 second timeout
start = time.time()
try:
    result = service.run(
        trips=list(trips),
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={"max_shift_minutes": 480, "strict_hard_validation": False},
        vsp_params={"min_layover_minutes": 10},
    )
    elapsed = time.time() - start
    signal.alarm(0)  # Cancel timeout
    print(f"\n✓ Hybrid pipeline completed in {elapsed:.2f}s")
    print(f"  Vehicles: {len(result.vsp.blocks)}")
    print(f"  Crew: {len(result.csp.duties)}")

except TimeoutException:
    elapsed = time.time() - start
    print(f"\n✗ Hybrid pipeline TIMED OUT after {elapsed:.2f}s")
    print("  (Killed by 5s timeout)")
except Exception as e:
    elapsed = time.time() - start
    signal.alarm(0)  # Cancel timeout
    print(f"\n✗ Hybrid pipeline failed after {elapsed:.2f}s: {type(e).__name__}: {e}")

print("\nNow testing with strict_hard_validation=True (5s timeout)...")
signal.alarm(5)  # 5 second timeout
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
    signal.alarm(0)  # Cancel timeout
    print(f"\n✓ Hybrid pipeline (strict=True) completed in {elapsed:.2f}s")
    print(f"  Vehicles: {len(result.vsp.blocks)}")
    print(f"  Crew: {len(result.csp.duties)}")

except TimeoutException:
    elapsed = time.time() - start
    print(f"\n✗ Hybrid pipeline (strict=True) TIMED OUT after {elapsed:.2f}s")
    print("  (Killed by 5s timeout)")
except Exception as e:
    elapsed = time.time() - start
    signal.alarm(0)  # Cancel timeout
    print(f"\n✗ Hybrid pipeline (strict=True) failed after {elapsed:.2f}s: {type(e).__name__}: {e}")

signal.alarm(0)  # Ensure timeout is cleared
print("\nDone.")