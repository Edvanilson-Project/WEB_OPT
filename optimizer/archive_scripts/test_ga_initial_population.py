#!/usr/bin/env python3
"""
Analisa a população inicial do GA.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import _fitness, _chromosome_from_blocks, _blocks_from_chromosome, _mutate
from src.algorithms.utils import block_is_feasible
import random
from copy import deepcopy

def make_trips_with_short_deadhead(n=10):
    """Viagens com deadhead curto (que permitem poucos blocos)."""
    trips = []
    for i in range(n):
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

def analyze_initial_population():
    """Analisa a população inicial do GA."""
    print("=== Análise População Inicial ===")
    trips = make_trips_with_short_deadhead(15)
    vt = make_vehicle_types()

    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)
    seed_chrom = _chromosome_from_blocks(sol.blocks)

    print(f"Greedy solution: {len(seed_chrom)} bloco(s)")
    print(f"Trips por bloco: {[len(block) for block in seed_chrom]}")

    trip_map = {t.id: t for t in trips}

    # Simular população inicial como o GA faz
    pop_size = 10
    all_tids = {tid for seq in seed_chrom for tid in seq}
    population = [seed_chrom]

    for p in range(pop_size - 1):
        variant = deepcopy(seed_chrom)
        n_moves = min(1 + p, len(trips) // 3)
        for _ in range(n_moves):
            # Se só tem 1 bloco, temos que criar um novo bloco (split)
            if len(variant) == 1:
                if len(variant[0]) <= 1:
                    break  # Não pode dividir bloco com 0 ou 1 viagem
                # Divide o bloco em dois
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

    # Analisar população
    print(f"\nAnálise da população ({len(population)} indivíduos):")

    block_counts = []
    fitness_values = []
    has_multiple_blocks = 0

    for i, chrom in enumerate(population):
        block_count = len(chrom)
        block_counts.append(block_count)
        fitness = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
        fitness_values.append(fitness)

        if block_count > 1:
            has_multiple_blocks += 1

        if i < 5:  # Mostrar primeiros 5
            print(f"  Indivíduo {i+1}: {block_count} blocos, fitness: {fitness:.2f}")
            print(f"    Blocos: {chrom}")

    avg_blocks = sum(block_counts) / len(block_counts)
    avg_fitness = sum(fitness_values) / len(fitness_values)

    print(f"\nResumo:")
    print(f"  Média de blocos: {avg_blocks:.2f}")
    print(f"  Média de fitness: {avg_fitness:.2f}")
    print(f"  Indivíduos com múltiplos blocos: {has_multiple_blocks}/{len(population)}")
    print(f"  Greedy tem {len(seed_chrom)} bloco(s)")

    # Verificar se mutação pode fazer merge
    if has_multiple_blocks > 0:
        print(f"\nMutação pode fazer merge em {has_multiple_blocks} indivíduos")
        # Testar mutação em um indivíduo com múltiplos blocos
        for i, chrom in enumerate(population):
            if len(chrom) >= 2:
                print(f"\nTestando mutação no indivíduo {i+1} ({len(chrom)} blocos):")
                print(f"  Cromossomo: {chrom}")

                # Testar várias mutações
                merge_count = 0
                split_count = 0
                move_count = 0
                for attempt in range(10):
                    mutated = _mutate(chrom, mutation_rate=1.0, trip_map=trip_map)
                    original_str = str(sorted([sorted(seq) for seq in chrom]))
                    mutated_str = str(sorted([sorted(seq) for seq in mutated]))

                    if original_str != mutated_str:
                        if len(mutated) < len(chrom):
                            merge_count += 1
                        elif len(mutated) > len(chrom):
                            split_count += 1
                        else:
                            move_count += 1

                print(f"  Em 10 mutações (rate=1.0):")
                print(f"    Merge: {merge_count}, Split: {split_count}, Move: {move_count}, Nenhuma: {10 - merge_count - split_count - move_count}")
                break
    else:
        print(f"\n⚠️  TODOS os indivíduos têm apenas 1 bloco!")
        print(f"  Mutação só pode fazer split (aumentar veículos), nunca merge (reduzir veículos)")
        print(f"  Para o GA melhorar, precisa criar soluções com múltiplos blocos que possam ser mesclados")

    return has_multiple_blocks > 0

def test_mutation_effect_on_fitness():
    """Testa como mutação afeta fitness."""
    print("\n=== Teste Efeito da Mutação na Fitness ===")

    trips = make_trips_with_short_deadhead(15)
    vt = make_vehicle_types()
    trip_map = {t.id: t for t in trips}

    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)
    chrom = _chromosome_from_blocks(sol.blocks)

    original_fitness = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    print(f"Greedy: {len(chrom)} blocos, fitness: {original_fitness:.2f}")

    # Criar variante com múltiplos blocos (forçar split)
    if len(chrom) == 1 and len(chrom[0]) > 2:
        variant = deepcopy(chrom)
        split_point = len(variant[0]) // 2
        new_block = variant[0][split_point:]
        variant[0] = variant[0][:split_point]
        variant.append(new_block)

        variant_fitness = _fitness(variant, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
        print(f"\nVariante (split): {len(variant)} blocos, fitness: {variant_fitness:.2f}")
        print(f"Split piorou fitness? {variant_fitness < original_fitness}")

        # Agora testar merge na variante
        print(f"\nTestando mutação (merge) na variante:")
        for i in range(10):
            mutated = _mutate(variant, mutation_rate=1.0, trip_map=trip_map)
            mutated_fitness = _fitness(mutated, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
            improved = mutated_fitness > variant_fitness
            print(f"  Tentativa {i+1}: {len(variant)} → {len(mutated)} blocos, fitness: {mutated_fitness:.2f}, melhorou? {improved}")

    return True

if __name__ == "__main__":
    random.seed(42)

    has_multi_blocks = analyze_initial_population()
    test_mutation_effect_on_fitness()

    print("\n" + "=" * 60)
    print("CONCLUSÃO:")

    if not has_multi_blocks:
        print("1. População inicial tem APENAS soluções com 1 bloco")
        print("2. Mutação só pode SPLIT (aumentar veículos), nunca MERGE")
        print("3. GA precisa de populações iniciais com múltiplos blocos")
        print("4. Solução: modificar inicialização para criar mais blocos")
    else:
        print("1. População inicial tem diversidade de blocos ✓")
        print("2. Merge operator está presente ✓")
        print("3. Problema pode ser: mutation rate baixo, fitness penalties, etc.")