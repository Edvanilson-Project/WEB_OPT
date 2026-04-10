#!/usr/bin/env python3
"""Test first validation check with detailed error reporting"""

import sys
import os
import traceback

# Add project root
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

print("=== Testing check_daily_shift_limit with detailed error handling ===")

try:
    # Import only what's needed
    from src.domain.models import Trip, VehicleType
    from src.services.optimizer_service import OptimizerService

    print("✓ Imports successful")

    def _trip(trip_id, start_min, duration_min, line, origin, dest):
        return Trip(
            id=int(trip_id),
            line_id=int(line),
            start_time=start_min,
            end_time=start_min + duration_min,
            origin_id=int(origin),
            destination_id=int(dest),
            duration=duration_min,
            distance_km=max(1.0, duration_min / 3),
            deadhead_times={int(origin): 8, int(dest): 8, 1: 10, 2: 10, 3: 10, 4: 10},
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

    def _run_optimizer(trips, *, algorithm=None, cct=None, vsp=None, electric=False, time_budget_s=30.0):
        service = OptimizerService()
        return service.run(
            trips=list(trips),
            vehicle_types=_vehicle(electric=electric),
            algorithm=algorithm,
            cct_params=cct or {},
            vsp_params=vsp or {},
            time_budget_s=time_budget_s,
        )

    print("\nCreating trips...")
    trips = [
        _trip(1, 360, 180, line=10, origin=1, dest=2),
        _trip(2, 560, 180, line=10, origin=2, dest=1),
        _trip(3, 780, 120, line=10, origin=1, dest=2),
    ]
    print(f"Created {len(trips)} trips")

    print("\nRunning optimizer...")
    result = _run_optimizer(
        trips,
        cct={"max_shift_minutes": 480, "strict_hard_validation": True},
        vsp={"min_layover_minutes": 10},
        time_budget_s=30.0,
    )

    print(f"\n✓ Success! Got result with {len(result.csp.duties)} duties")
    spreads = [d.spread_time for d in result.csp.duties]
    print(f"Spreads: {spreads}")
    print(f"Max spread: {max(spreads) if spreads else 0}")
    print(f"Passes check: {bool(spreads) and max(spreads) <= 480}")

except Exception as e:
    print(f"\n✗ Error: {type(e).__name__}: {e}")
    print("\nFull traceback:")
    traceback.print_exc()

    # Check for specific module issues
    print("\n=== Checking for missing attributes ===")
    if "module" in str(e):
        import importlib
        error_str = str(e)
        if "'" in error_str:
            module_name = error_str.split("'")[1]
            print(f"Trying to examine module: {module_name}")
            try:
                module = importlib.import_module(module_name)
                print(f"Module exists: {module.__file__}")
                print(f"Attributes: {dir(module)[:20]}")
            except:
                print(f"Could not import {module_name}")