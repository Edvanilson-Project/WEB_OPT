#!/usr/bin/env python3
"""
Teste específico para corrigir o problema de mutation.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import GeneticVSP, _chromosome_from_blocks, _blocks_from_chromosome
from src.algorithms.vsp.genetic import _mutate, _fitness, _repair_chromosome
import random
from copy import deepcopy

def make_trips_for_multiple_blocks(n: int = 20) -> list:
    """Gera viagens que forçarão múltiplos blocos."""
    trips = []
    terminals = [1, 2, 3, 4, 5]

    for i in range(n):
        origin = terminals[i % len(terminals)]
        destination = terminals[(i + 1) % len(terminals)]
        start_time = 360 + (i * 120)  # 2h entre viagens
        duration = 60
        end_time = start_time + duration

        deadhead_times = {tid: 30 for tid in terminals}  # Deadhead longo

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

def test_mutation_with_multiple_blocks():
    """Testa mutation quando há múltiplos blocos."""
    print("=== Teste Mutation com Múltiplos Blocos ===")
    trips = make_trips_for_multiple_blocks(15)
    vt = make_vehicle_types()

    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)
    chrom = _chromosome_from_blocks(sol.blocks)

    print(f"Total trips: {len(trips)}")
    print(f"Greedy solution: {len(chrom)} blocks")
    for i, block in enumerate(chrom):
        print(f"  Block {i+1}: {len(block)} trips")

    trip_map = {t.id: t for t in trips}

    # Testar mutation várias vezes
    improvements = 0
    changes = 0
    for i in range(20):
        mutated = _mutate(chrom, mutation_rate=1.0, trip_map=trip_map)
        same = str(sorted([sorted(seq) for seq in mutated])) == str(sorted([sorted(seq) for seq in chrom]))

        if not same:
            changes += 1
            f_orig = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
            f_mut = _fitness(mutated, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
            if f_mut > f_orig:
                improvements += 1

        if i < 5:  # Mostrar apenas primeiros 5
            print(f"\nTentativa {i+1}:")
            print(f"  Original: {chrom}")
            print(f"  Mutado: {mutated}")
            print(f"  Igual? {same}")

    print(f"\nResumo: {changes}/20 mutações criaram mudanças, {improvements} melhoraram fitness")

def analyze_mutation_function():
    """Analisa o código da função _mutate."""
    print("\n=== Análise da Função _mutate ===")

    # Ler o código
    import inspect
    from src.algorithms.vsp.genetic import _mutate as mutate_func

    source = inspect.getsource(mutate_func)
    print("Código da função _mutate:")
    print(source)

    print("\nProblemas identificados:")
    print("1. Linha 168: 'if len(chrom) < 2 or random.random() > mutation_rate:'")
    print("   - Retorna early se len(chrom) < 2")
    print("   - Para soluções com 1 bloco, nunca muta")
    print("2. Linha 176: 'trip_idx = random.randint(0, len(chrom[src]) - 1)'")
    print("   - Pode causar IndexError se chrom[src] estiver vazio")
    print("3. Linha 180: 'chrom = [seq for seq in chrom if seq]'")
    print("   - Remove blocos vazios, mas isso é bom")
    print("4. Linha 181: 'return _repair_chromosome(chrom, all_tids, trip_map)'")
    print("   - O repair pode reverter mudanças ao adicionar trips missing")

def test_improved_mutation():
    """Testa uma versão melhorada da mutation."""
    print("\n=== Teste Mutation Melhorada ===")

    def improved_mutate(chrom, mutation_rate, trip_map=None):
        """Versão melhorada que funciona mesmo com 1 bloco."""
        if random.random() > mutation_rate:
            return deepcopy(chrom)

        all_tids = {tid for seq in chrom for tid in seq}
        chrom_copy = deepcopy(chrom)

        # Se só tem 1 bloco, temos que criar um novo bloco
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
            # Mutação original: move viagem entre blocos
            src = random.randint(0, len(chrom_copy) - 1)
            if not chrom_copy[src]:
                return chrom_copy
            trip_idx = random.randint(0, len(chrom_copy[src]) - 1)
            trip_id = chrom_copy[src].pop(trip_idx)
            dst = random.randint(0, len(chrom_copy) - 1)
            chrom_copy[dst].append(trip_id)
            # Remove blocos vazios
            chrom_copy = [seq for seq in chrom_copy if seq]

        return _repair_chromosome(chrom_copy, all_tids, trip_map)

    # Testar
    trips = make_trips_for_multiple_blocks(10)
    vt = make_vehicle_types()

    greedy = GreedyVSP()
    sol = greedy.solve(trips, vt)
    chrom = _chromosome_from_blocks(sol.blocks)

    print(f"Solução original: {chrom}")
    print(f"Número de blocos: {len(chrom)}")

    trip_map = {t.id: t for t in trips}

    for i in range(5):
        mutated = improved_mutate(chrom, mutation_rate=1.0, trip_map=trip_map)
        same = str(sorted([sorted(seq) for seq in mutated])) == str(sorted([sorted(seq) for seq in chrom]))
        print(f"\nTentativa {i+1}:")
        print(f"  Mutado: {mutated}")
        print(f"  Igual? {same}")
        print(f"  Blocos: {len(mutated)}")

if __name__ == "__main__":
    test_mutation_with_multiple_blocks()
    analyze_mutation_function()
    test_improved_mutation()