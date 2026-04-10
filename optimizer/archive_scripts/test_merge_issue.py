#!/usr/bin/env python3
"""
Teste para entender por que merge piora fitness.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import _fitness, _chromosome_from_blocks, _blocks_from_chromosome
from src.algorithms.utils import quick_cost_sorted, block_is_feasible
import random

def make_simple_trips():
    """Viagens que podem ser mescladas."""
    trips = []
    # Viagens sequenciais com deadhead curto
    times = [360, 480, 600, 720]  # 2h entre viagens
    for i in range(4):
        t = Trip(
            id=i + 1,
            line_id=1,
            start_time=times[i],
            end_time=times[i] + 60,
            origin_id=1,
            destination_id=2,
            duration=60,
            distance_km=20.0,
            deadhead_times={1: 5, 2: 5, 3: 5},  # Deadhead curto
        )
        trips.append(t)
    return trips

def make_vehicle_types():
    return [
        type('VehicleType', (), {
            'id': 1,
            'name': 'Bus Standard',
            'passenger_capacity': 40,
            'cost_per_km': 2.0,
            'cost_per_hour': 50.0,
            'fixed_cost': 800.0,
            'is_electric': False,
            'battery_capacity_kwh': 0.0,
            'minimum_soc': 0.15,
            'charge_rate_kw': 0.0,
            'energy_cost_per_kwh': 0.0,
            'depot_id': None,
        })()
    ]

def analyze_merge():
    """Analisa por que merge piora fitness."""
    print("=== Análise Merge vs Fitness ===")
    trips = make_simple_trips()
    vt = make_vehicle_types()

    # Criar solução com 2 blocos (2 veículos)
    chrom_2_blocks = [[1, 2], [3, 4]]

    # Criar solução com 1 bloco (1 veículo) - merge dos dois blocos
    chrom_1_block = [[1, 2, 3, 4]]

    trip_map = {t.id: t for t in trips}

    # Calcular fitness
    fitness_2 = _fitness(chrom_2_blocks, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    fitness_1 = _fitness(chrom_1_block, trip_map, vt, 800.0, 0.5, 480.0, 400.0)

    print(f"2 blocos (2 veículos): fitness = {fitness_2:.2f}")
    print(f"1 bloco (1 veículo): fitness = {fitness_1:.2f}")
    print(f"Merge melhorou fitness? {fitness_1 > fitness_2}")

    # Converter para blocos e analisar detalhadamente
    blocks_2 = _blocks_from_chromosome(chrom_2_blocks, trip_map, vt)
    blocks_1 = _blocks_from_chromosome(chrom_1_block, trip_map, vt)

    print("\n--- Análise detalhada 2 blocos ---")
    for i, block in enumerate(blocks_2):
        feasible = block_is_feasible(block)
        trips_in_block = [t.id for t in block.trips]
        print(f"  Bloco {i+1}: trips {trips_in_block}, factível? {feasible}")
        # Verificar gaps
        for j in range(len(block.trips) - 1):
            cur = block.trips[j]
            nxt = block.trips[j + 1]
            gap = nxt.start_time - cur.end_time
            needed = int(cur.deadhead_times.get(nxt.origin_id, 0))
            print(f"    Gap {cur.id}→{nxt.id}: {gap} min, needed: {needed}, ok? {gap >= max(8, needed)}")

    print("\n--- Análise detalhada 1 bloco ---")
    for i, block in enumerate(blocks_1):
        feasible = block_is_feasible(block)
        trips_in_block = [t.id for t in block.trips]
        print(f"  Bloco {i+1}: trips {trips_in_block}, factível? {feasible}")
        # Verificar gaps
        for j in range(len(block.trips) - 1):
            cur = block.trips[j]
            nxt = block.trips[j + 1]
            gap = nxt.start_time - cur.end_time
            needed = int(cur.deadhead_times.get(nxt.origin_id, 0))
            print(f"    Gap {cur.id}→{nxt.id}: {gap} min, needed: {needed}, ok? {gap >= max(8, needed)}")

    # Calcular custos reais (sem penalidades)
    cost_2 = quick_cost_sorted(blocks_2, 800.0, 0.5, 480.0, 400.0)
    cost_1 = quick_cost_sorted(blocks_1, 800.0, 0.5, 480.0, 400.0)

    print(f"\nCustos (sem penalidades):")
    print(f"  2 blocos: {cost_2:.2f}")
    print(f"  1 bloco: {cost_1:.2f}")
    print(f"  Redução de custo com merge: {cost_2 - cost_1:.2f}")

    # Verificar penalidades da fitness function
    print("\n--- Penalidades da fitness function ---")

    # 2 blocos
    covered_2 = {tid for seq in chrom_2_blocks for tid in seq}
    missing_2 = len(trip_map) - len(covered_2)
    all_tids_2 = [tid for seq in chrom_2_blocks for tid in seq]
    duplicates_2 = len(all_tids_2) - len(set(all_tids_2))
    infeasible_count_2 = sum(1 for b in blocks_2 if not block_is_feasible(b))

    print(f"2 blocos:")
    print(f"  Trips cobertas: {len(covered_2)}/{len(trip_map)}, missing: {missing_2}")
    print(f"  Duplicatas: {duplicates_2}")
    print(f"  Blocos infactíveis: {infeasible_count_2}")

    # 1 bloco
    covered_1 = {tid for seq in chrom_1_block for tid in seq}
    missing_1 = len(trip_map) - len(covered_1)
    all_tids_1 = [tid for seq in chrom_1_block for tid in seq]
    duplicates_1 = len(all_tids_1) - len(set(all_tids_1))
    infeasible_count_1 = sum(1 for b in blocks_1 if not block_is_feasible(b))

    print(f"1 bloco:")
    print(f"  Trips cobertas: {len(covered_1)}/{len(trip_map)}, missing: {missing_1}")
    print(f"  Duplicatas: {duplicates_1}")
    print(f"  Blocos infactíveis: {infeasible_count_1}")

    # Calcular penalidades
    penalty_2 = missing_2 * 5000.0 + duplicates_2 * 10000.0 + infeasible_count_2 * 3000.0
    penalty_1 = missing_1 * 5000.0 + duplicates_1 * 10000.0 + infeasible_count_1 * 3000.0

    print(f"\nPenalidades totais:")
    print(f"  2 blocos: {penalty_2:.2f}")
    print(f"  1 bloco: {penalty_1:.2f}")

    # Fitness breakdown
    fitness_calc_2 = -(cost_2 + penalty_2)
    fitness_calc_1 = -(cost_1 + penalty_1)

    print(f"\nFitness calculada:")
    print(f"  2 blocos: -(cost {cost_2:.2f} + penalty {penalty_2:.2f}) = {fitness_calc_2:.2f}")
    print(f"  1 bloco: -(cost {cost_1:.2f} + penalty {penalty_1:.2f}) = {fitness_calc_1:.2f}")
    print(f"  Função retorna: {fitness_2:.2f} e {fitness_1:.2f} (deve ser igual)")

    return fitness_1 > fitness_2

if __name__ == "__main__":
    analyze_merge()