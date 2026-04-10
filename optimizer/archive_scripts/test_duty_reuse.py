#!/usr/bin/env python3
"""
Teste de otimização de reuso de Duty em _task_neighbors_optimized
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip
import time
import tracemalloc

def create_simple_instance(n_blocks=30):
    """Cria instância simples com terminais conectáveis."""
    blocks = []
    start = 360  # 06:00
    n_terminals = 3

    for i in range(n_blocks):
        n_trips = 1
        trips = []
        block_start = start

        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30
            # Garantir conexões: destino atual = origem próximo
            origin_id = (i) % n_terminals + 1
            dest_id = ((i + 1) % n_terminals) + 1

            t = Trip(
                id=trip_id,
                line_id=1,
                start_time=block_start,
                end_time=block_start + trip_dur,
                origin_id=origin_id,
                destination_id=dest_id,
                duration=trip_dur,
                distance_km=10.0,
            )
            trips.append(t)
            block_start += trip_dur

        block = Block(
            id=i + 1,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)
        gap = 15
        start = block_start + gap

    print(f"Criados {len(blocks)} blocos")
    return blocks

def test_memory_before_after():
    """Testa memória antes e depois da otimização de reuso de Duty."""
    print("="*80)
    print("TESTE DE REDUÇÃO DE MEMÓRIA COM REUSO DE DUTY")
    print("="*80)

    blocks = create_simple_instance(40)

    # Teste com tracemalloc
    tracemalloc.start()

    # Cria CSP
    csp = SetPartitioningOptimizedCSP(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
        "use_optimized_set_partitioning": True,
        "operator_change_terminals_only": True
    })

    # Reset contadores
    csp._fast_checks = 0
    csp._full_checks = 0
    csp._combinations_pruned = 0
    csp._cache_hits = 0

    # Executa construção do grafo
    start_time = time.time()
    neighbors = csp._task_neighbors_optimized(blocks)
    elapsed = time.time() - start_time

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    print(f"\nResultados:")
    print(f"  Blocos: {len(blocks)}")
    print(f"  Arestas: {sum(len(v) for v in neighbors.values())}")
    print(f"  Tempo: {elapsed:.3f}s")
    print(f"  Memória pico: {peak / 1024:.1f} KB")
    print(f"  Memória atual: {current / 1024:.1f} KB")

    print(f"\nEstatísticas de poda:")
    print(f"  _fast_checks: {csp._fast_checks}")
    print(f"  _full_checks: {csp._full_checks}")
    print(f"  _combinations_pruned: {csp._combinations_pruned}")
    print(f"  _cache_hits: {csp._cache_hits}")

    # Análise de eficácia
    total_pairs = len(blocks) * (len(blocks) - 1) // 2
    if total_pairs > 0:
        fast_eliminated = csp._fast_checks - csp._full_checks - csp._combinations_pruned
        print(f"\nEficácia:")
        print(f"  Total de pares: {total_pairs}")
        print(f"  Poda early (max_shift): {csp._combinations_pruned} ({csp._combinations_pruned/total_pairs*100:.1f}%)")
        print(f"  Fast check elimina: {fast_eliminated} ({fast_eliminated/total_pairs*100:.1f}%)")
        print(f"  Verificações completas: {csp._full_checks} ({csp._full_checks/total_pairs*100:.1f}%)")

    # Verificar grafo gerado
    print(f"\nExemplo de conexões (task 1 → ...):")
    if 1 in neighbors and neighbors[1]:
        print(f"  Task 1 conecta a: {[b.id for b in neighbors[1][:5]]}")

    return peak, csp._full_checks

if __name__ == "__main__":
    try:
        peak_memory, full_checks = test_memory_before_after()
        print(f"\n" + "="*80)
        print(f"RESUMO: {full_checks} verificações completas, pico memória: {peak_memory/1024:.1f} KB")
        print("="*80)
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)