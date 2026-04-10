#!/usr/bin/env python3
"""
Diagnóstico detalhado dos operadores genéticos.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import GeneticVSP, _chromosome_from_blocks, _blocks_from_chromosome
from src.algorithms.vsp.genetic import _crossover, _mutate, _repair_chromosome, _fitness
import random

def make_trips(n: int = 10) -> list:
    """Gera n viagens."""
    trips = []
    start = 360  # 06:00
    for i in range(n):
        t = Trip(
            id=i + 1,
            line_id=1,
            start_time=start,
            end_time=start + 60,
            origin_id=(i % 3) + 1,
            destination_id=((i + 1) % 3) + 1,
            duration=60,
            distance_km=20.0,
            deadhead_times={1: 10, 2: 15, 3: 20},
        )
        trips.append(t)
        start += 90  # 1h30 de intervalo
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

def test_crossover_effect():
    """Testa se crossover cria diversidade real."""
    print("=== Teste Crossover ===")
    trips = make_trips(12)
    vt = make_vehicle_types()

    # Criar duas soluções greedy com seeds diferentes
    greedy1 = GreedyVSP()
    sol1 = greedy1.solve(trips, vt)
    chrom1 = _chromosome_from_blocks(sol1.blocks)

    # Criar segunda solução shuffleando viagens
    chrom2 = deepcopy(chrom1)
    if len(chrom2) >= 2:
        # Move algumas viagens entre blocos
        n_moves = 3
        for _ in range(n_moves):
            src = random.randint(0, len(chrom2) - 1)
            if not chrom2[src]:
                continue
            tid = chrom2[src].pop(random.randint(0, len(chrom2[src]) - 1))
            dst = random.choice([i for i in range(len(chrom2)) if i != src])
            chrom2[dst].append(tid)
        chrom2 = [seq for seq in chrom2 if seq]

    print(f"Parent 1 blocks: {chrom1}")
    print(f"Parent 2 blocks: {chrom2}")
    print(f"Parent 1 tem {len(chrom1)} blocos, Parent 2 tem {len(chrom2)} blocos")

    trip_map = {t.id: t for t in trips}
    child1, child2 = _crossover(chrom1, chrom2, trip_map)

    print(f"\nChild 1 blocks: {child1}")
    print(f"Child 2 blocks: {child2}")
    print(f"Child 1 tem {len(child1)} blocos, Child 2 tem {len(child2)} blocos")

    # Verificar se filhos são diferentes dos pais
    same_as_p1 = str(sorted([sorted(seq) for seq in child1])) == str(sorted([sorted(seq) for seq in chrom1]))
    same_as_p2 = str(sorted([sorted(seq) for seq in child2])) == str(sorted([sorted(seq) for seq in chrom2]))
    print(f"Child 1 igual ao Parent 1? {same_as_p1}")
    print(f"Child 2 igual ao Parent 2? {same_as_p2}")

    # Verificar fitness
    f1 = _fitness(chrom1, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    f2 = _fitness(chrom2, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    fc1 = _fitness(child1, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    fc2 = _fitness(child2, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    print(f"\nFitness Parent 1: {f1:.2f}")
    print(f"Fitness Parent 2: {f2:.2f}")
    print(f"Fitness Child 1: {fc1:.2f}")
    print(f"Fitness Child 2: {fc2:.2f}")
    print(f"Algum filho melhor que pais? {(fc1 > f1 or fc1 > f2) or (fc2 > f1 or fc2 > f2)}")

def test_mutation_effect():
    """Testa se mutation cria diversidade real."""
    print("\n=== Teste Mutation ===")
    trips = make_trips(10)
    vt = make_vehicle_types()

    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)
    chrom = _chromosome_from_blocks(sol.blocks)

    print(f"Original blocks: {chrom}")
    print(f"Original tem {len(chrom)} blocos")

    trip_map = {t.id: t for t in trips}

    # Testar múltiplas mutações
    for i in range(5):
        mutated = _mutate(chrom, mutation_rate=1.0, trip_map=trip_map)  # Force mutation
        same = str(sorted([sorted(seq) for seq in mutated])) == str(sorted([sorted(seq) for seq in chrom]))
        print(f"\nMutação {i+1}: {mutated}")
        print(f"  Igual ao original? {same}")
        print(f"  Número de blocos: {len(mutated)}")

        f_orig = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
        f_mut = _fitness(mutated, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
        print(f"  Fitness original: {f_orig:.2f}")
        print(f"  Fitness mutado: {f_mut:.2f}")
        print(f"  Melhorou? {f_mut > f_orig}")

def test_repair_function():
    """Testa se _repair_chromosome está removendo diversidade."""
    print("\n=== Teste Repair Function ===")
    trips = make_trips(8)
    vt = make_vehicle_types()
    trip_map = {t.id: t for t in trips}

    # Criar um cromossomo com duplicatas e missing trips
    chrom = [[1, 2, 3], [3, 4, 5], [6, 7]]  # Trip 3 duplicada, Trip 8 faltando
    all_tids = set(range(1, 9))

    print(f"Cromossomo original: {chrom}")
    print(f"Trip IDs: {all_tids}")

    repaired = _repair_chromosome(chrom, all_tids, trip_map)
    print(f"Cromossomo reparado: {repaired}")

    # Verificar viagens cobertas
    covered = {tid for seq in repaired for tid in seq}
    print(f"Viagens cobertas após repair: {sorted(covered)}")
    print(f"Todas viagens cobertas? {covered == all_tids}")

def test_fitness_gradient():
    """Testa se fitness tem gradiente suficiente."""
    print("\n=== Teste Fitness Gradient ===")
    trips = make_trips(6)
    vt = make_vehicle_types()
    trip_map = {t.id: t for t in trips}

    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)
    chrom = _chromosome_from_blocks(sol.blocks)

    # Criar várias soluções com número diferente de veículos
    variants = []

    # Mais veículos (pior)
    worse = deepcopy(chrom)
    if len(worse) > 0 and len(worse[0]) > 1:
        first_block = worse[0]
        split_point = len(first_block) // 2
        new_block = first_block[split_point:]
        worse[0] = first_block[:split_point]
        worse.append(new_block)
        variants.append(("Mais veículos", worse))

    # Menos veículos (melhor, se possível)
    if len(chrom) > 1:
        better = deepcopy(chrom)
        merged = better[0] + better[1]
        better = [merged] + better[2:]
        variants.append(("Menos veículos", better))

    # Solução aleatória
    random_chrom = [[1, 3, 5], [2, 4, 6]]
    variants.append(("Aleatório", random_chrom))

    # Calcular fitness
    base_fitness = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    print(f"Fitness base (greedy): {base_fitness:.2f}")

    for name, var_chrom in variants:
        var_fitness = _fitness(var_chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
        diff = var_fitness - base_fitness
        print(f"{name}: {var_fitness:.2f} (diferença: {diff:+.2f})")

# Helper para deepcopy
from copy import deepcopy

if __name__ == "__main__":
    print("Diagnóstico dos Operadores Genéticos")
    print("=" * 50)

    test_crossover_effect()
    test_mutation_effect()
    test_repair_function()
    test_fitness_gradient()