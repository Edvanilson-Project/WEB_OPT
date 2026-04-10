#!/usr/bin/env python3
"""
Teste minimalista do GA completo para identificar o problema.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import (
    _fitness, _chromosome_from_blocks, _blocks_from_chromosome,
    _tournament, _crossover, _mutate, _repair_chromosome
)
from src.algorithms.utils import quick_cost_sorted, block_is_feasible
import random
from copy import deepcopy

def make_simple_trips():
    """Cria viagens simples para teste."""
    trips = []
    for i in range(6):
        t = Trip(
            id=i + 1,
            line_id=1,
            start_time=360 + i * 120,  # 2h entre viagens
            end_time=360 + i * 120 + 60,
            origin_id=(i % 3) + 1,
            destination_id=((i + 1) % 3) + 1,
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

def run_minimal_ga():
    """Executa GA minimalista para diagnóstico."""
    print("=== GA Minimalista para Diagnóstico ===")
    trips = make_simple_trips()
    vt = make_vehicle_types()
    trip_map = {t.id: t for t in trips}

    # Parâmetros reduzidos
    pop_size = 10
    generations = 5
    mutation_rate = 0.1
    elitism_n = 1

    # Semente greedy
    greedy = GreedyVSP()
    seed_sol = greedy.solve(trips, vt)
    seed_chrom = _chromosome_from_blocks(seed_sol.blocks)
    all_tids = {tid for seq in seed_chrom for tid in seq}

    print(f"Greedy solution: {len(seed_chrom)} bloco(s)")
    print(f"Seed chromosome: {seed_chrom}")

    # Fitness function simplificada
    fit_fn = lambda c: _fitness(c, trip_map, vt, 800.0, 0.5, 480.0, 400.0)

    # População inicial
    population = [seed_chrom]
    for p in range(pop_size - 1):
        variant = deepcopy(seed_chrom)
        n_moves = min(1 + p, len(trips) // 3)
        for _ in range(n_moves):
            if len(variant) == 1:
                if len(variant[0]) <= 1:
                    break
                src_block = variant[0]
                split_point = random.randint(1, len(src_block) - 1)
                new_block = src_block[split_point:]
                variant[0] = src_block[:split_point]
                variant.append(new_block)
            else:
                src = random.randint(0, len(variant) - 1)
                if not variant[src]:
                    continue
                tid = variant[src].pop(random.randint(0, len(variant[src]) - 1))
                dst = random.choice([i for i in range(len(variant)) if i != src])
                variant[dst].append(tid)
        variant = [seq for seq in variant if seq]
        if not variant:
            variant = deepcopy(seed_chrom)
        population.append(variant)

    print(f"\nPopulação inicial ({len(population)} indivíduos):")
    for i, chrom in enumerate(population):
        score = fit_fn(chrom)
        print(f"  Indivíduo {i}: {len(chrom)} blocos, fitness: {score:.2f}")

    # Executar algumas gerações
    best_chrom = deepcopy(seed_chrom)
    best_score = fit_fn(best_chrom)

    for gen in range(generations):
        print(f"\n--- Geração {gen} ---")
        scores = [fit_fn(c) for c in population]

        # Elitismo
        elite_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:elitism_n]
        new_pop = [deepcopy(population[i]) for i in elite_idx]

        print(f"Melhor fitness: {scores[elite_idx[0]]:.2f}, blocos: {len(population[elite_idx[0]])}")

        # Reprodução
        while len(new_pop) < pop_size:
            p1 = _tournament(population, scores, k=2)
            p2 = _tournament(population, scores, k=2)
            c1, c2 = _crossover(p1, p2, trip_map)
            new_pop.append(_mutate(c1, mutation_rate, trip_map))
            if len(new_pop) < pop_size:
                new_pop.append(_mutate(c2, mutation_rate, trip_map))

        # Analisar diversidade da nova população
        print(f"Nova população:")
        block_counts = []
        for i, chrom in enumerate(new_pop[:5]):  # Mostrar primeiros 5
            score = fit_fn(chrom)
            block_counts.append(len(chrom))
            print(f"  Indivíduo {i}: {len(chrom)} blocos, fitness: {score:.2f}")

        avg_blocks = sum(block_counts) / len(block_counts)
        print(f"Média de blocos: {avg_blocks:.2f}")

        population = new_pop
        gen_best_idx = max(range(len(population)), key=lambda i: fit_fn(population[i]))
        gen_best_score = fit_fn(population[gen_best_idx])
        if gen_best_score > best_score:
            best_score = gen_best_score
            best_chrom = deepcopy(population[gen_best_idx])
            print(f"Novo melhor encontrado: fitness {best_score:.2f}")

    # Resultado final
    print(f"\n=== Resultado Final ===")
    print(f"Melhor chromosome: {best_chrom}")
    print(f"Melhor fitness: {best_score:.2f}")
    print(f"Número de blocos: {len(best_chrom)}")

    # Comparar com greedy
    greedy_fitness = fit_fn(seed_chrom)
    print(f"Greedy fitness: {greedy_fitness:.2f}")
    print(f"GA melhorou? {best_score > greedy_fitness}")

    # Analisar operadores
    print(f"\n=== Análise dos Operadores ===")

    # Testar crossover
    print("Teste de crossover:")
    parent1 = [[1, 2, 3], [4, 5, 6]]
    parent2 = [[1, 4, 5], [2, 3, 6]]
    child1, child2 = _crossover(parent1, parent2, trip_map)
    print(f"  Parent1: {parent1}")
    print(f"  Parent2: {parent2}")
    print(f"  Child1: {child1}")
    print(f"  Child2: {child2}")
    print(f"  Child1 diferente de parent1? {child1 != parent1}")
    print(f"  Child2 diferente de parent2? {child2 != parent2}")

    # Testar mutação
    print("\nTeste de mutação (rate=1.0):")
    chrom = [[1, 2, 3], [4, 5, 6]]
    mutated = _mutate(chrom, mutation_rate=1.0, trip_map=trip_map)
    print(f"  Original: {chrom}")
    print(f"  Mutado: {mutated}")
    print(f"  Diferente? {mutated != chrom}")
    print(f"  Tipo de mutação: {'merge' if len(mutated) < len(chrom) else 'split' if len(mutated) > len(chrom) else 'move'}")

    # Testar repair_chromosome
    print("\nTeste de repair_chromosome após crossover:")
    # Simular crossover que cria duplicatas
    child_with_dup = [[1, 2, 3], [3, 4, 5]]
    repaired = _repair_chromosome(child_with_dup, all_tids, trip_map)
    print(f"  Com duplicatas: {child_with_dup}")
    print(f"  Reparado: {repaired}")

    return best_score > greedy_fitness

def analyze_parameter_effects():
    """Analisa efeito de parâmetros."""
    print("\n=== Análise de Parâmetros ===")

    # Mutation rate
    print("Mutation rate atual: 0.1")
    print("Com população 200, espera-se ~20 mutações/geração")
    print("Mas mutation só ocorre se random() < mutation_rate")
    print("E dentro de _mutate, há 50% chance de merge vs move")

    # Probabilidade real de merge
    mutation_rate = 0.1
    prob_merge_given_mutation = 0.5  # Dentro do else no _mutate
    prob_merge = mutation_rate * prob_merge_given_mutation
    print(f"Probabilidade de merge por indivíduo: {prob_merge:.3f}")
    print(f"Em população 200, merges esperados/geração: ~{200 * prob_merge:.1f}")

    # E se população tem apenas 1 bloco? (não pode merge)
    print("\nSe população inicial tem apenas 1 bloco:")
    print("- Mutação só pode fazer split (aumentar blocos)")
    print("- Nunca pode fazer merge (reduzir blocos)")
    print("- GA nunca consegue melhorar greedy (que tem 1 bloco)")

    # Verificar se greedy produz 1 bloco
    trips = make_simple_trips()
    vt = make_vehicle_types()
    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)
    print(f"\nGreedy com {len(trips)} trips produz: {len(sol.blocks)} bloco(s)")
    print(f"Trips por bloco: {[len(b.trips) for b in sol.blocks]}")

    # Com 6 trips espaçadas 2h, greedy provavelmente cria 1 bloco
    # Pois deadhead curto (5 min) permite conectar todas

if __name__ == "__main__":
    random.seed(42)
    improved = run_minimal_ga()
    analyze_parameter_effects()

    print("\n" + "=" * 60)
    print("DIAGNÓSTICO:")

    if improved:
        print("✅ GA minimalista funciona (melhora greedy)")
        print("   Problema pode ser em:")
        print("   1. Parâmetros reais (mutation_rate=0.1 muito baixo)")
        print("   2. Tempo de execução (generations=500 suficiente?)")
        print("   3. Fitness penalties muito grandes")
    else:
        print("❌ GA minimalista NÃO melhora greedy")
        print("   Causas possíveis:")
        print("   1. Greedy já ótimo para problema simples")
        print("   2. Operadores genéticos não funcionam")
        print("   3. População inicial sem diversidade")
        print("   4. Repair_chromosome remove diversidade")