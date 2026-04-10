#!/usr/bin/env python3
"""Teste simples da validação profissional"""

import sys
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

from src.domain.models import Trip, VehicleType
from src.services.optimizer_service import OptimizerService

def _trip(
    trip_id: int,
    start: int,
    duration: int,
    *,
    line: int = 1,
    origin: int = 1,
    dest: int = 2,
    depot: int | None = 1,
    energy: float = 0.0,
    elevation: float = 0.0,
    day: int = 0,
    relief: bool = False,
) -> Trip:
    start_time = day * 1440 + start
    return Trip(
        id=trip_id,
        line_id=line,
        start_time=start_time,
        end_time=start_time + duration,
        origin_id=origin,
        destination_id=dest,
        duration=duration,
        distance_km=max(1.0, duration / 3),
        depot_id=depot,
        is_relief_point=relief,
        energy_kwh=energy,
        elevation_gain_m=elevation,
        deadhead_times={origin: 8, dest: 8, 1: 10, 2: 10, 3: 10, 4: 10},
    )

def _vehicle(electric: bool = False) -> list[VehicleType]:
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

def _run_optimizer(trips, **kwargs):
    service = OptimizerService()
    return service.run(
        trips=list(trips),
        vehicle_types=_vehicle(kwargs.get('electric', False)),
        algorithm=kwargs.get('algorithm', 'hybrid_pipeline'),
        cct_params=kwargs.get('cct', {}),
        vsp_params=kwargs.get('vsp', {}),
    )

# Testar apenas o primeiro check
print("Testando check_daily_shift_limit...")
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
    print(f"Resultado: {'PASS' if ok else 'FAIL'}")
    print(f"max_spread={max(spreads) if spreads else 0} duties={len(spreads)}")
    print(f"Total vehicles: {result.vsp.num_vehicles}")
    print(f"Total crew: {result.csp.num_crew}")

except Exception as e:
    print(f"Erro: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nTeste concluído.")