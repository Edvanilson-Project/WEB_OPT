#!/usr/bin/env python3
"""
Teste focado apenas na função _mutate.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Simple mocks to avoid import issues
class MockTrip:
    def __init__(self, tid, start_time, origin_id):
        self.id = tid
        self.start_time = start_time
        self.end_time = start_time + 60
        self.origin_id = origin_id
        self.destination_id = (origin_id + 1) % 3 or 3
        self.duration = 60
        self.deadhead_times = {1: 5, 2: 5, 3: 5}

class MockBlock:
    def __init__(self, id, trips):
        self.id = id
        self.trips = trips

# Import genetic module and inject mocks
import src.algorithms.vsp.genetic as genetic_module

# Monkey patch block_is_feasible to always return True for testing
def mock_block_is_feasible(block):
    return True

genetic_module.block_is_feasible = mock_block_is_feasible

# Now import the actual function
from src.algorithms.vsp.genetic import _mutate, _repair_chromosome
import random
from copy import deepcopy

def test_merge_operator():
    """Testa se o merge operator funciona."""
    print("=== Teste Merge Operator ===")

    # Criar trip_map simples
    trip_map = {}
    for i in range(1, 7):
        t = MockTrip(i, 360 + i*60, (i % 3) + 1)
        trip_map[i] = t

    # Cromossomo com 2 blocos que podem ser mesclados
    chrom = [[1, 2, 3], [4, 5, 6]]

    print(f"Cromossomo original: {chrom} (2 blocos)")

    # Testar várias mutações forçadas (mutation_rate=1.0)
    merge_count = 0
    move_count = 0
    split_count = 0

    for i in range(20):
        mutated = _mutate(chrom, mutation_rate=1.0, trip_map=trip_map)

        original_str = str(sorted([sorted(seq) for seq in chrom]))
        mutated_str = str(sorted([sorted(seq) for seq in mutated]))

        if original_str != mutated_str:
            if len(mutated) < len(chrom):
                print(f"Tentativa {i+1}: Merge! {len(chrom)} -> {len(mutated)} blocos")
                print(f"  Original: {chrom}")
                print(f"  Mutado: {mutated}")
                merge_count += 1
            elif len(mutated) > len(chrom):
                print(f"Tentativa {i+1}: Split! {len(chrom)} -> {len(mutated)} blocos")
                split_count += 1
            else:
                # Mesmo número de blocos - provavelmente move
                move_count += 1

    print(f"\nResumo (20 tentativas):")
    print(f"  Merge ocorreu: {merge_count} vezes")
    print(f"  Split ocorreu: {split_count} vezes")
    print(f"  Move ocorreu: {move_count} vezes")

    if merge_count > 0:
        print("✅ Merge operator está funcionando!")
    else:
        print("❌ Merge operator NÃO está funcionando")
        print("   Possíveis causas:")
        print("   - block_is_feasible retornando False")
        print("   - Trip ordering issue")
        print("   - Mutation operator não está sendo chamado (random > mutation_rate)")

    return merge_count > 0

def test_single_block_mutation():
    """Testa mutação quando há apenas 1 bloco."""
    print("\n=== Teste Single Block Mutation ===")

    # Cromossomo com 1 bloco
    chrom = [[1, 2, 3, 4, 5, 6]]

    trip_map = {}
    for i in range(1, 7):
        t = MockTrip(i, 360 + i*60, (i % 3) + 1)
        trip_map[i] = t

    print(f"Cromossomo original: {chrom} (1 bloco)")

    split_count = 0
    for i in range(10):
        mutated = _mutate(chrom, mutation_rate=1.0, trip_map=trip_map)
        if len(mutated) > len(chrom):
            split_count += 1
            print(f"Tentativa {i+1}: Split! {len(chrom)} -> {len(mutated)} blocos")
            print(f"  Mutado: {mutated}")

    print(f"Split ocorreu em {split_count}/10 tentativas")

    if split_count > 0:
        print("✅ Single block mutation está funcionando!")
    else:
        print("❌ Single block mutation NÃO está funcionando")

    return split_count > 0

if __name__ == "__main__":
    random.seed(42)  # Para resultados reproduzíveis

    merge_works = test_merge_operator()
    single_works = test_single_block_mutation()

    print("\n" + "=" * 50)
    print("CONCLUSÃO:")
    print(f"1. Merge operator funciona: {'✅' if merge_works else '❌'}")
    print(f"2. Single block mutation funciona: {'✅' if single_works else '❌'}")