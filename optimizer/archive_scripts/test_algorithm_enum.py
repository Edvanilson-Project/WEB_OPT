#!/usr/bin/env python3
"""Test algorithm enum vs string"""

import sys
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

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

print("Testing with STRING 'hybrid_pipeline':")
service = OptimizerService()
import time

try:
    start = time.time()
    result = service.run(
        trips=trips,
        vehicle_types=_vehicle(),
        algorithm='hybrid_pipeline',  # String!
        cct_params={'max_shift_minutes': 480, 'strict_hard_validation': True},
        vsp_params={'min_layover_minutes': 10},
    )
    elapsed = time.time() - start
    print(f"✓ String 'hybrid_pipeline': {elapsed:.2f}s, {len(result.vsp.blocks)} vehicles")
except Exception as e:
    elapsed = time.time() - start
    print(f"✗ String 'hybrid_pipeline': Failed after {elapsed:.2f}s: {type(e).__name__}: {e}")

print("\nTesting with ENUM AlgorithmType.HYBRID_PIPELINE:")
try:
    start = time.time()
    result = service.run(
        trips=trips,
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,  # Enum!
        cct_params={'max_shift_minutes': 480, 'strict_hard_validation': True},
        vsp_params={'min_layover_minutes': 10},
    )
    elapsed = time.time() - start
    print(f"✓ Enum HYBRID_PIPELINE: {elapsed:.2f}s, {len(result.vsp.blocks)} vehicles")
except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Enum HYBRID_PIPELINE: Failed after {elapsed:.2f}s: {type(e).__name__}: {e}")

print("\nTesting with ENUM but strict_hard_validation=False:")
try:
    start = time.time()
    result = service.run(
        trips=trips,
        vehicle_types=_vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={'max_shift_minutes': 480, 'strict_hard_validation': False},
        vsp_params={'min_layover_minutes': 10},
    )
    elapsed = time.time() - start
    print(f"✓ Enum with strict_hard_validation=False: {elapsed:.2f}s, {len(result.vsp.blocks)} vehicles")
except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Enum with strict_hard_validation=False: Failed after {elapsed:.2f}s: {type(e).__name__}: {e}")