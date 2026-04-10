#!/usr/bin/env python3
"""
Teste e implementação de merge operator para GA.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import GeneticVSP, _chromosome_from_blocks, _blocks_from_chromosome
from src.algorithms.vsp.genetic import _mutate, _fitness, _repair_chromosome
from src.algorithms.vsp.simulated_annealing import _merge
import random
from copy import deepcopy

def make_trips_for_merge_test(n: int = 10) -> list:
    """Gera viagens que permitem merge de blocos."""
    trips = []
    terminals = [1, 2, 3]

    for i in range(n):
        origin = terminals[i % len(terminals)]
        destination = terminals[(i + 1) % len(terminals)]
        start_time = 360 + (i * 90)  # 1h30 entre viagens - deadhead longo permite merges
        duration = 60
        end_time = start_time + duration

        # Deadhead curto para permitir merges
        deadhead_times = {1: 5, 2: 5, 3: 5}

        t = Trip(
            id=i + 1,
            line_id=1,
            start_time=start_time,
            end_time=end_time,
            origin_id=origin,
            destination_id=destination,
            duration=duration,
            distance_km=20.0,
            deadhead_times=deadhead_times,
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

def test_merge_operator():
    """Testa o operador de merge do simulated annealing."""
    print("=== Teste Merge Operator ===")
    trips = make_trips_for_merge_test(8)
    vt = make_vehicle_types()

    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)

    print(f"Greedy solution: {len(sol.blocks)} blocks")
    for i, block in enumerate(sol.blocks):
        print(f"  Block {i+1}: {len(block.trips)} trips")

    # Testar merge em blocos
    if len(sol.blocks) >= 2:
        merged = _merge(deepcopy(sol.blocks))
        print(f"\nApós merge: {len(merged)} blocks")

        # Calcular custos
        from src.algorithms.utils import quick_cost_sorted
        orig_cost = quick_cost_sorted(sol.blocks, 800.0, 0.5, 480.0, 400.0)
        merged_cost = quick_cost_sorted(merged, 800.0, 0.5, 480.0, 400.0)

        print(f"Custo original: {orig_cost:.2f}")
        print(f"Custo após merge: {merged_cost:.2f}")
        print(f"Merge reduziu custo? {merged_cost < orig_cost}")

        return merged_cost < orig_cost
    return False

def create_chromosome_with_multiple_blocks():
    """Cria um cromossomo com múltiplos blocos para testar merge em GA."""
    trips = make_trips_for_merge_test(12)
    vt = make_vehicle_types()

    # Forçar múltiplos blocos com deadhead curto
    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)

    # Se greedy só tem 1 bloco, dividir artificialmente
    chrom = _chromosome_from_blocks(sol.blocks)
    if len(chrom) == 1 and len(chrom[0]) > 2:
        # Dividir em 3 blocos
        block = chrom[0]
        split1 = len(block) // 3
        split2 = 2 * len(block) // 3
        chrom = [
            block[:split1],
            block[split1:split2],
            block[split2:]
        ]

    return chrom, trips, vt

def test_ga_needs_merge():
    """Demonstra que GA precisa de operador de merge."""
    print("\n=== Demonstração: GA precisa de Merge ===")

    chrom, trips, vt = create_chromosome_with_multiple_blocks()
    trip_map = {t.id: t for t in trips}

    print(f"Cromossomo inicial: {len(chrom)} blocos")
    for i, block in enumerate(chrom):
        print(f"  Block {i+1}: {len(block)} trips")

    original_fitness = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    print(f"\nFitness inicial: {original_fitness:.2f}")

    # Testar várias mutações
    print("\nTestando 10 mutações:")
    any_improvement = False
    for i in range(10):
        mutated = _mutate(chrom, mutation_rate=1.0, trip_map=trip_map)
        mutated_fitness = _fitness(mutated, trip_map, vt, 800.0, 0.5, 480.0, 400.0)

        same = str(sorted([sorted(seq) for seq in mutated])) == str(sorted([sorted(seq) for seq in chrom]))
        improved = mutated_fitness > original_fitness

        print(f"  Mutação {i+1}: {len(mutated)} blocos, fitness {mutated_fitness:.2f}, melhorou? {improved}")

        if improved:
            any_improvement = True

    print(f"\nAlguma mutação melhorou o fitness? {any_improvement}")

    if not any_improvement:
        print("\nANÁLISE: As mutações não melhoram porque:")
        print("1. Mutação só move viagens entre blocos existentes")
        print("2. Mutação só divide blocos (quando há 1 bloco)")
        print("3. NENHUMA mutação MERGE blocos (reduz número de veículos)")
        print("4. Para melhorar, GA precisa reduzir veículos, não só reorganizar")

    return any_improvement

def implement_merge_in_mutation():
    """Implementa operador de merge na função _mutate."""
    print("\n=== Implementando Merge na Mutação ===")

    def _mutate_with_merge(chrom, mutation_rate, trip_map=None):
        """Versão com merge operator."""
        if random.random() > mutation_rate:
            return deepcopy(chrom)

        all_tids = {tid for seq in chrom for tid in seq}
        chrom_copy = deepcopy(chrom)

        # Escolher aleatoriamente entre: split, move, merge
        # Se só tem 1 bloco: split ou não faz nada
        # Se tem 2+ blocos: 50% move, 50% merge
        if len(chrom_copy) == 1:
            if len(chrom_copy[0]) <= 1:
                return chrom_copy  # Não pode dividir bloco com 0 ou 1 viagem

            # Divide o bloco em dois
            src_block = chrom_copy[0]
            split_point = random.randint(1, len(src_block) - 1)
            new_block = src_block[split_point:]
            chrom_copy[0] = src_block[:split_point]
            chrom_copy.append(new_block)
        else:
            # Escolher aleatoriamente entre move (50%) e merge (50%)
            if random.random() < 0.5:
                # Move: move viagem entre blocos
                src = random.randint(0, len(chrom_copy) - 1)
                if not chrom_copy[src]:
                    return chrom_copy
                trip_idx = random.randint(0, len(chrom_copy[src]) - 1)
                trip_id = chrom_copy[src].pop(trip_idx)
                dst = random.randint(0, len(chrom_copy) - 1)
                chrom_copy[dst].append(trip_id)
            else:
                # Merge: combina dois blocos
                if len(chrom_copy) >= 2:
                    i, j = random.sample(range(len(chrom_copy)), 2)
                    # Garantir i < j para remoção correta
                    if i > j:
                        i, j = j, i
                    # Combinar blocos j em i
                    chrom_copy[i].extend(chrom_copy[j])
                    del chrom_copy[j]

            # Remove blocos vazios
            chrom_copy = [seq for seq in chrom_copy if seq]

        return _repair_chromosome(chrom_copy, all_tids, trip_map)

    # Testar a nova implementação
    chrom, trips, vt = create_chromosome_with_multiple_blocks()
    trip_map = {t.id: t for t in trips}

    print(f"Cromossomo inicial: {len(chrom)} blocos")
    original_fitness = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    print(f"Fitness inicial: {original_fitness:.2f}")

    print("\nTestando mutação com merge (10 tentativas):")
    improvements = 0
    for i in range(10):
        mutated = _mutate_with_merge(chrom, mutation_rate=1.0, trip_map=trip_map)
        mutated_fitness = _fitness(mutated, trip_map, vt, 800.0, 0.5, 480.0, 400.0)

        same = str(sorted([sorted(seq) for seq in mutated])) == str(sorted([sorted(seq) for seq in chrom]))
        improved = mutated_fitness > original_fitness

        print(f"  {i+1}: {len(chrom)} -> {len(mutated)} blocos, fitness {mutated_fitness:.2f}, melhorou? {improved}")

        if improved:
            improvements += 1

    print(f"\nMutações que melhoraram: {improvements}/10")

    if improvements > 0:
        print("✅ Merge operator funciona!")
    else:
        print("❌ Merge operator ainda não está melhorando. Pode ser:")
        print("   - Merge cria blocos inviáveis")
        print("   - Fitness penalty por viagens duplicadas/missing")
        print("   - Repair function desfaz o merge")

    return _mutate_with_merge

if __name__ == "__main__":
    print("Diagnóstico e Implementação de Merge Operator para GA")
    print("=" * 60)

    merge_works = test_merge_operator()
    ga_needs_merge = not test_ga_needs_merge()  # Invertido: Se não melhora, precisa de merge

    print("\n" + "=" * 60)
    print("CONCLUSÃO:")
    print(f"1. Merge operator do SA funciona: {'✅' if merge_works else '❌'}")
    print(f"2. GA atual não tem merge operator: {'✅' if ga_needs_merge else '❌'}")

    if ga_needs_merge:
        print("\nIMPLEMENTANDO merge operator no GA...")
        new_mutate_func = implement_merge_in_mutation()
        print("\nPróximo passo: Atualizar genetic.py com _mutate_with_merge")