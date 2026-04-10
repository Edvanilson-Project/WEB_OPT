#!/usr/bin/env python3
"""
Debug para verificar os blocos gerados pelo VSP no diagnóstico de poda.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, VehicleType
from src.algorithms.vsp.greedy import GreedyVSP

def make_test_trips():
    """Cria as mesmas trips do test_diagnostic_pruning.py."""
    trips = []
    start = 360
    for i in range(6):
        t = Trip(
            id=i+1,
            line_id=1,
            start_time=start,
            end_time=start + 60,
            origin_id=1,
            destination_id=2,
            duration=60,
            distance_km=20.0,
        )
        trips.append(t)
        start += 800 if i % 2 == 0 else 100  # Alterna entre gaps grandes e normais
    return trips

def main():
    print("=== DEBUG DOS BLOCOS DO VSP ===")

    trips = make_test_trips()
    vehicle_types = [
        VehicleType(
            id=1,
            name="Bus Standard",
            passenger_capacity=40,
            cost_per_km=2.0,
            cost_per_hour=50.0,
            fixed_cost=800.0,
        )
    ]

    print(f"Trips criadas: {len(trips)}")
    for i, t in enumerate(trips):
        print(f"  Trip {t.id}: {t.start_time//60:02d}:{t.start_time%60:02d} - {t.end_time//60:02d}:{t.end_time%60:02d} "
              f"(dura {t.duration}min)")

    vsp = GreedyVSP().solve(trips, vehicle_types)

    print(f"\nVSP gerou {len(vsp.blocks)} blocos")
    for b in vsp.blocks:
        print(f"\nBloco {b.id}:")
        print(f"  Start: {b.start_time//60:02d}:{b.start_time%60:02d}")
        print(f"  End: {b.end_time//60:02d}:{b.end_time%60:02d}")
        print(f"  Duração total: {b.total_duration}min")
        print(f"  Trips: {[t.id for t in b.trips]}")

        # Verificar gaps internos
        for i in range(len(b.trips)-1):
            gap = b.trips[i+1].start_time - b.trips[i].end_time
            print(f"    Gap entre trip {b.trips[i].id} e {b.trips[i+1].id}: {gap}min")

    # Verificar se há gaps grandes (> max_shift) entre blocos
    print(f"\n=== ANÁLISE DE GAPS ENTRE BLOCOS ===")
    blocks_sorted = sorted(vsp.blocks, key=lambda b: b.start_time)
    max_shift = 480  # Valor padrão
    for i in range(len(blocks_sorted)-1):
        gap = blocks_sorted[i+1].start_time - blocks_sorted[i].end_time
        print(f"Gap entre bloco {blocks_sorted[i].id} e {blocks_sorted[i+1].id}: {gap}min")
        print(f"  Gap > max_shift ({max_shift}min)? {gap > max_shift}")

if __name__ == "__main__":
    main()