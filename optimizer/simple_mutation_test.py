#!/usr/bin/env python3
"""
Teste minimalista para verificar mutação.
"""
import random
import sys

# Simple implementation to test logic
def test_mutation_logic():
    print("Testando lógica de mutação...")

    # Simulando o código atual da função _mutate
    def simulate_mutation(chrom, mutation_rate=0.1, has_trip_map=True):
        if random.random() > mutation_rate:
            return chrom, "no mutation"

        # Se só tem 1 bloco: split ou não faz nada
        if len(chrom) == 1:
            if len(chrom[0]) <= 1:
                return chrom, "single trip, no split"
            # Divide o bloco em dois
            return [[chrom[0][0]], chrom[0][1:]], "split"
        else:
            # Escolher aleatoriamente entre move (50%) e merge (50%)
            if random.random() < 0.5:
                return chrom, "move (simplified)"
            else:
                # Merge: combina dois blocos
                if len(chrom) >= 2:
                    # Combinar blocos
                    new_chrom = [chrom[0] + chrom[1]] + chrom[2:]
                    return new_chrom, "merge"

        return chrom, "no operation"

    # Test 1: Single block
    print("\n1. Teste com 1 bloco:")
    chrom1 = [[1, 2, 3, 4, 5, 6]]
    for i in range(5):
        result, op = simulate_mutation(chrom1, mutation_rate=1.0)
        print(f"  Tentativa {i+1}: {op}")

    # Test 2: Multiple blocks
    print("\n2. Teste com múltiplos blocos:")
    chrom2 = [[1, 2, 3], [4, 5, 6]]
    merge_count = 0
    move_count = 0
    for i in range(20):
        result, op = simulate_mutation(chrom2, mutation_rate=1.0)
        if op == "merge":
            merge_count += 1
        elif op == "move (simplified)":
            move_count += 1

    print(f"  Merge: {merge_count}/20")
    print(f"  Move: {move_count}/20")
    print(f"  No mutation: {20 - merge_count - move_count}/20")

    # Probabilidade real
    print("\n3. Probabilidade real com mutation_rate=0.1:")
    attempts = 1000
    mutations = 0
    for i in range(attempts):
        result, op = simulate_mutation(chrom2, mutation_rate=0.1)
        if op != "no mutation":
            mutations += 1

    print(f"  Mutação ocorre em {mutations}/{attempts} = {mutations/attempts*100:.1f}%")

    # Quantas dessas são merge?
    merge_attempts = 1000
    merges = 0
    for i in range(merge_attempts):
        result, op = simulate_mutation(chrom2, mutation_rate=1.0)
        if op == "merge":
            merges += 1

    print(f"  Com mutation_rate=1.0, merge em {merges}/{merge_attempts} = {merges/merge_attempts*100:.1f}%")

if __name__ == "__main__":
    random.seed(42)
    test_mutation_logic()