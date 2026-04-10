#!/usr/bin/env python3
"""
Testa se a fitness function tem gradiente suficiente para guiar o GA.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import _fitness, _chromosome_from_blocks
from src.algorithms.utils import quick_cost_sorted
import random

def make_test_trips():
    """Cria viagens para teste."""
    trips = []
    for i in range(5):
        t = Trip(
            id=i + 1,
            line_id=1,
            start_time=360 + i * 120,
            end_time=360 + i * 120 + 60,
            origin_id=(i % 3) + 1,
            destination_id=((i + 1) % 3) + 1,
            duration=60,
            distance_km=20.0,
            deadhead_times={1: 5, 2: 5, 3: 5},
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

def analyze_fitness_gradient():
    """Analisa se pequenas melhorias geram gradiente na fitness."""
    print("=== Análise Gradient da Fitness ===")
    trips = make_test_trips()
    vt = make_vehicle_types()
    trip_map = {t.id: t for t in trips}

    # Criar solução com 2 blocos
    chrom_2 = [[1, 2, 3], [4, 5]]

    # Criar solução melhor: 1 bloco (reduz veículos)
    chrom_1 = [[1, 2, 3, 4, 5]]

    fitness_2 = _fitness(chrom_2, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    fitness_1 = _fitness(chrom_1, trip_map, vt, 800.0, 0.5, 480.0, 400.0)

    print(f"2 blocos (2 veículos): fitness = {fitness_2:.2f}")
    print(f"1 bloco (1 veículo): fitness = {fitness_1:.2f}")
    print(f"Diferença de fitness: {fitness_1 - fitness_2:.2f}")
    print(f"Melhoria? {fitness_1 > fitness_2}")

    # Calcular custos reais
    from src.algorithms.vsp.genetic import _blocks_from_chromosome
    blocks_2 = _blocks_from_chromosome(chrom_2, trip_map, vt)
    blocks_1 = _blocks_from_chromosome(chrom_1, trip_map, vt)

    cost_2 = quick_cost_sorted(blocks_2, 800.0, 0.5, 480.0, 400.0)
    cost_1 = quick_cost_sorted(blocks_1, 800.0, 0.5, 480.0, 400.0)

    print(f"\nCustos reais:")
    print(f"  2 blocos: {cost_2:.2f}")
    print(f"  1 bloco: {cost_1:.2f}")
    print(f"  Economia: {cost_2 - cost_1:.2f}")

    # Verificar se gradiente é proporcional
    fitness_diff = fitness_1 - fitness_2
    cost_diff = cost_2 - cost_1

    print(f"\nRelação gradiente/custo:")
    print(f"  Diferença de fitness: {fitness_diff:.2f}")
    print(f"  Diferença de custo: {cost_diff:.2f}")
    print(f"  Relação: {abs(fitness_diff / cost_diff if cost_diff != 0 else 0):.2f}")

    # Testar sensibilidade a pequenas mudanças
    print("\n=== Sensibilidade a pequenas mudanças ===")

    # Criar 3 soluções com custos ligeiramente diferentes
    # Solução A: [[1, 2, 3, 4], [5]] - 2 veículos
    # Solução B: [[1, 2, 3], [4, 5]] - 2 veículos
    # Solução C: [[1, 2], [3, 4, 5]] - 2 veículos

    solutions = {
        'A': [[1, 2, 3, 4], [5]],
        'B': [[1, 2, 3], [4, 5]],
        'C': [[1, 2], [3, 4, 5]],
    }

    for name, chrom in solutions.items():
        fitness = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
        blocks = _blocks_from_chromosome(chrom, trip_map, vt)
        cost = quick_cost_sorted(blocks, 800.0, 0.5, 480.0, 400.0)
        print(f"  Solução {name}: fitness={fitness:.2f}, cost={cost:.2f}, blocos={len(chrom)}")

    # Verificar se há gradiente entre soluções similares
    print("\nDiferenças entre soluções similares:")
    fitness_A = _fitness(solutions['A'], trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    fitness_B = _fitness(solutions['B'], trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    fitness_C = _fitness(solutions['C'], trip_map, vt, 800.0, 0.5, 480.0, 400.0)

    print(f"  A-B: {fitness_A - fitness_B:.2f}")
    print(f"  B-C: {fitness_B - fitness_C:.2f}")
    print(f"  A-C: {fitness_A - fitness_C:.2f}")

    # O problema pode ser que as penalidades são muito grandes
    # Verificar se soluções factíveis têm penalidades
    from src.algorithms.utils import block_is_feasible

    print("\n=== Análise de penalidades ===")
    for name, chrom in solutions.items():
        blocks = _blocks_from_chromosome(chrom, trip_map, vt)
        covered = {tid for seq in chrom for tid in seq}
        missing = len(trip_map) - len(covered)
        all_tids = [tid for seq in chrom for tid in seq]
        duplicates = len(all_tids) - len(set(all_tids))
        infeasible = sum(1 for b in blocks if not block_is_feasible(b))

        penalty = missing * 5000.0 + duplicates * 10000.0 + infeasible * 3000.0

        print(f"  Solução {name}:")
        print(f"    Missing: {missing}, Duplicates: {duplicates}, Infeasible: {infeasible}")
        print(f"    Penalidade total: {penalty:.2f}")

    # Testar com mutation rate baixo (0.1) - quantas mutações realmente acontecem?
    print("\n=== Análise Mutation Rate ===")
    mutation_rate = 0.1
    attempts = 1000
    mutations = 0

    for i in range(attempts):
        if random.random() < mutation_rate:
            mutations += 1

    print(f"  Mutation rate: {mutation_rate}")
    print(f"  Em {attempts} tentativas, mutações esperadas: {mutation_rate * attempts}")
    print(f"  Mutações observadas: {mutations}")
    print(f"  Probabilidade de mutação por indivíduo: {mutations/attempts:.3f}")

    # Com população 200, quantos indivíduos sofrem mutação por geração?
    pop_size = 200
    expected_mutated = pop_size * mutation_rate
    print(f"  População: {pop_size}, indivíduos mutados/geração: ~{expected_mutated:.1f}")

    return fitness_1 > fitness_2 and abs(fitness_1 - fitness_2) > 0.1

if __name__ == "__main__":
    random.seed(42)
    has_gradient = analyze_fitness_gradient()

    print("\n" + "=" * 60)
    print("CONCLUSÃO:")
    if has_gradient:
        print("✅ Fitness function tem gradiente suficiente")
        print("   Problema pode ser em operadores genéticos ou parâmetros")
    else:
        print("❌ Fitness function NÃO tem gradiente suficiente")
        print("   Penalidades muito grandes ou custos muito pequenos")
        print("   GA não consegue diferenciar soluções melhores")