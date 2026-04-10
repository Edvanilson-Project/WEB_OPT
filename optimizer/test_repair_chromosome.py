#!/usr/bin/env python3
"""
Testa se _repair_chromosome está removendo diversidade importante.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.vsp.genetic import _repair_chromosome
import random

def test_repair_removes_diversity():
    """Testa se repair_chromosome remove diversidade de blocos."""
    print("=== Teste Repair Chromosome ===")

    # Cenário 1: Cromossomo com múltiplos blocos que são bons (diversidade)
    chrom = [[1, 2, 3], [4, 5, 6]]
    all_tids = {1, 2, 3, 4, 5, 6}

    print(f"Cromossomo original: {chrom} (2 blocos)")
    print(f"All trip IDs: {all_tids}")

    repaired = _repair_chromosome(chrom, all_tids)
    print(f"Reparado: {repaired}")

    # Verificar se manteve estrutura
    if len(repaired) == len(chrom):
        print("✅ Repair manteve número de blocos")
    else:
        print(f"❌ Repair alterou número de blocos: {len(chrom)} → {len(repaired)}")

    # Cenário 2: Duplicatas (deveria remover)
    chrom_dup = [[1, 2, 3], [3, 4, 5]]  # Trip 3 duplicada
    print(f"\nCromossomo com duplicata: {chrom_dup}")
    repaired_dup = _repair_chromosome(chrom_dup, all_tids)
    print(f"Reparado: {repaired_dup}")

    # Verificar duplicatas removidas
    all_repaired = [tid for seq in repaired_dup for tid in seq]
    has_duplicates = len(all_repaired) != len(set(all_repaired))
    if has_duplicates:
        print("❌ Repair não removeu todas duplicatas")
    else:
        print("✅ Repair removeu duplicatas")

    # Cenário 3: Missing trips (deveria adicionar ao menor bloco)
    chrom_missing = [[1, 2, 3], [4, 5]]  # Falta trip 6
    print(f"\nCromossomo com missing: {chrom_missing}")
    repaired_missing = _repair_chromosome(chrom_missing, all_tids)
    print(f"Reparado: {repaired_missing}")

    # Verificar se adicionou ao menor bloco
    covered = {tid for seq in repaired_missing for tid in seq}
    if covered == all_tids:
        print("✅ Repair adicionou trips missing")
    else:
        print(f"❌ Repair não adicionou todas trips: missing {all_tids - covered}")

    # Cenário 4: Efeito no crossover
    print("\n=== Teste Repair no Crossover ===")
    parent1 = [[1, 2, 3], [4, 5, 6]]
    parent2 = [[1, 4, 5], [2, 3, 6]]

    # Simular crossover: trocar bloco 0 de parent1 com bloco 1 de parent2
    child1 = [[1, 4, 5], [4, 5, 6]]  # Trip 4 e 5 duplicadas
    child2 = [[1, 2, 3], [2, 3, 6]]  # Trip 2 e 3 duplicadas

    all_tids = {1, 2, 3, 4, 5, 6}

    print(f"Parent1: {parent1}")
    print(f"Parent2: {parent2}")
    print(f"Child1 (antes repair): {child1}")
    print(f"Child2 (antes repair): {child2}")

    repaired_child1 = _repair_chromosome(child1, all_tids)
    repaired_child2 = _repair_chromosome(child2, all_tids)

    print(f"Child1 (depois repair): {repaired_child1}")
    print(f"Child2 (depois repair): {repaired_child2}")

    # Verificar se repair criou blocos diferentes
    if len(repaired_child1) != len(child1) or len(repaired_child2) != len(child2):
        print("⚠️  Repair alterou número de blocos - pode remover diversidade")

        # Verificar se criou bloco único (pior caso)
        if len(repaired_child1) == 1 or len(repaired_child2) == 1:
            print("❌ Repair criou bloco único - REMOVENDO diversidade crítica!")
        else:
            print("✅ Repair ajustou número de blocos mas manteve múltiplos")

    # Cenário 5: Trip ordering (quando trip_map disponível)
    print("\n=== Teste com Trip Ordering ===")

    # Mock trip_map com start_times
    class MockTrip:
        def __init__(self, tid, start_time):
            self.id = tid
            self.start_time = start_time

    trip_map = {
        1: MockTrip(1, 360),   # 6:00
        2: MockTrip(2, 420),   # 7:00
        3: MockTrip(3, 480),   # 8:00
        4: MockTrip(4, 540),   # 9:00
        5: MockTrip(5, 600),   # 10:00
        6: MockTrip(6, 660),   # 11:00
    }

    # Missing trips fora de ordem
    chrom_out_of_order = [[1, 3, 5], [2, 4]]  # Falta trip 6
    print(f"Cromossomo out-of-order missing: {chrom_out_of_order}")
    repaired_ordered = _repair_chromosome(chrom_out_of_order, all_tids, trip_map)
    print(f"Reparado com trip_map: {repaired_ordered}")

    # Verificar se trip 6 foi adicionada na posição correta (ao final)
    # Deveria ser adicionada ao menor bloco (bloco 1 tem 3 trips, bloco 2 tem 2 trips)
    # Então vai para bloco 2, mas ordenada por start_time
    if repaired_ordered[1] == [2, 4, 6]:  # Ordenado: 2(7:00), 4(9:00), 6(11:00)
        print("✅ Repair ordenou trips por start_time")
    else:
        print(f"⚠️  Repair resultou em: {repaired_ordered[1]}")

    # Testar impacto na factibilidade
    print("\n=== Impacto na Factibilidade ===")
    # Se repair adiciona trips missing ao menor bloco, pode tornar infactível
    # Exemplo: bloco pequeno com trips espaçadas, adiciona trip no meio

    chrom_tight = [[1, 6], [2, 3, 4, 5]]  # Bloco 1: trips 1(6:00) e 6(11:00) - gap grande
    print(f"Cromossomo com gap grande no bloco 1: {chrom_tight}")

    # Remover trip 6 para criar missing
    chrom_tight_missing = [[1], [2, 3, 4, 5]]  # Falta trip 6
    repaired_tight = _repair_chromosome(chrom_tight_missing, all_tids, trip_map)
    print(f"Reparado: {repaired_tight}")

    # Trip 6 deveria ir para bloco 1 (menor) mas fica após trip 1 com gap de 5h
    # Isso pode tornar bloco infactível se deadhead não permitir

    print("\nConclusão: _repair_chromosome pode:")
    print("1. Remover duplicatas (bom)")
    print("2. Adicionar missing trips ao menor bloco (pode causar infactibilidade)")
    print("3. Ordenar por start_time (bom para factibilidade)")
    print("4. Potencialmente reduzir número de blocos (remove diversidade)")

if __name__ == "__main__":
    random.seed(42)
    test_repair_removes_diversity()