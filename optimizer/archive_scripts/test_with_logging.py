#!/usr/bin/env python3
"""Test with detailed logging to find where it hangs"""

import sys
import os
import logging
import time
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

# Enable DEBUG logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

print("Starting test...")

# Import with logging
print("1. Importing modules...")
start = time.time()
try:
    from src.domain.models import Trip, VehicleType
    print(f"✓ Imported models in {time.time()-start:.2f}s")
except Exception as e:
    print(f"✗ Model import error: {e}")

print("\n2. Importing OptimizerService...")
start = time.time()
try:
    from src.services.optimizer_service import OptimizerService
    print(f"✓ Imported OptimizerService in {time.time()-start:.2f}s")
except Exception as e:
    print(f"✗ Service import error: {e}")

print("\n3. Creating test trips...")
def _trip(trip_id, start, duration):
    return Trip(
        id=trip_id,
        line_id=1,
        start_time=start,
        end_time=start + duration,
        origin_id=1,
        destination_id=2,
        duration=duration,
        distance_km=1.0,
        depot_id=1,
        is_relief_point=False,
        energy_kwh=0.0,
        elevation_gain_m=0.0,
        deadhead_times={1: 8, 2: 8},
    )

trips = [
    _trip(1, 360, 180),  # 6:00-9:00
    _trip(2, 560, 180),  # 9:20-12:20
    _trip(3, 780, 120),  # 13:00-15:00
]

print(f"✓ Created {len(trips)} trips")

print("\n4. Creating vehicle...")
vehicle = VehicleType(
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

print("\n5. Creating OptimizerService instance...")
start = time.time()
try:
    service = OptimizerService()
    print(f"✓ Created service in {time.time()-start:.2f}s")
except Exception as e:
    print(f"✗ Service creation error: {e}")
    import traceback
    traceback.print_exc()

print("\n6. Running optimizer with hybrid_pipeline...")
start = time.time()
try:
    result = service.run(
        trips=list(trips),
        vehicle_types=[vehicle],
        algorithm='hybrid_pipeline',
        cct_params={"max_shift_minutes": 480, "strict_hard_validation": True},
        vsp_params={"min_layover_minutes": 10, "time_budget_s": 5},
    )
    elapsed = time.time() - start
    print(f"✓ Optimization completed in {elapsed:.2f}s")
    print(f"  Vehicles: {len(result.vsp.blocks)}")
    print(f"  Crew: {result.csp.num_crew}")
except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Optimization failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nTest complete.")