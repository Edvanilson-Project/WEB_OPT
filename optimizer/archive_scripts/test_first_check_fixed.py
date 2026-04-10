#!/usr/bin/env python3
"""Test first validation check with fixed timeout"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import only what's needed
from src.domain.models import Trip
from src.services.optimizer_service import OptimizerService

def _trip(trip_id, start_min, duration_min, line, origin, dest):
    return Trip(
        trip_id=str(trip_id),
        line_id=str(line),
        origin_terminal_id=str(origin),
        destination_terminal_id=str(dest),
        start_time_minutes=start_min,
        duration_minutes=duration_min,
        passenger_count=0,
        operational_cost=100,
        revenue=200,
    )

def _vehicle(electric=False):
    from src.domain.models import VehicleType
    return [
        VehicleType(
            vehicle_type_id="BUS_40",
            capacity=40,
            cost_per_km=2.0,
            cost_per_minute=0.5,
            min_layover_minutes=5,
            fixed_cost=100.0,
            electric=electric,
            charging_time_minutes=30 if electric else 0,
            consumption_kwh_per_km=1.5 if electric else 0,
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

print("Testing check_daily_shift_limit...")
trips = [
    _trip(1, 360, 180, line=10, origin=1, dest=2),
    _trip(2, 560, 180, line=10, origin=2, dest=1),
    _trip(3, 780, 120, line=10, origin=1, dest=2),
]
try:
    result = _run_optimizer(
        trips,
        cct={"max_shift_minutes": 480, "strict_hard_validation": True},
        vsp={"min_layover_minutes": 10},
        time_budget_s=30.0,
    )
    print(f"Success! Got result with {len(result.csp.duties)} duties")
    spreads = [d.spread_time for d in result.csp.duties]
    print(f"Spreads: {spreads}")
    print(f"Max spread: {max(spreads) if spreads else 0}")
    print(f"Passes check: {bool(spreads) and max(spreads) <= 480}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()