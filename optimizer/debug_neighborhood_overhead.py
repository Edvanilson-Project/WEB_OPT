#!/usr/bin/env python3
"""
DEBUG: Análise detalhada do overhead em _task_neighbors_optimized
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip
import logging

logging.basicConfig(level=logging.DEBUG)

def create_test_instance(n_blocks=50):
    """Cria instância de teste realista."""
    blocks = []
    start = 360
    n_terminals = 5

    for i in range(n_blocks):
        n_trips = 1 + (i % 3)
        trips = []
        block_start = start

        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 + (j * 15)
            origin_id = (i + j) % n_terminals + 1
            dest_id = ((i + j + 1) % n_terminals) + 1

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
            if j < n_trips - 1:
                block_start += trip_dur + 5

        block = Block(
            id=i + 1,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)
        gap = 15 + (i % 30)
        start = block_start + gap

    print(f"Criados {len(blocks)} blocos realistas")
    return blocks

def analyze_neighborhood_overhead():
    """Analisa overhead da construção do grafo."""
    blocks = create_test_instance(50)

    print("\n" + "="*80)
    print("ANÁLISE DETALHADA DE _task_neighbors_optimized")
    print("="*80)

    csp = SetPartitioningOptimizedCSP(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
        "use_optimized_set_partitioning": True,
    })

    # Reset contadores
    csp._fast_checks = 0
    csp._full_checks = 0
    csp._combinations_pruned = 0
    csp._cache_hits = 0

    # Executar construção do grafo
    neighbors = csp._task_neighbors_optimized(blocks)
    edges = sum(len(v) for v in neighbors.values())

    print(f"\nResultados:")
    print(f"  Blocos: {len(blocks)}")
    print(f"  Arestas no grafo: {edges}")
    print(f"  _fast_checks: {csp._fast_checks}")
    print(f"  _full_checks: {csp._full_checks}")
    print(f"  _combinations_pruned: {csp._combinations_pruned}")
    print(f"  _cache_hits: {csp._cache_hits}")

    # Análise estatística
    total_pairs = len(blocks) * (len(blocks) - 1) // 2
    fast_eliminated = csp._fast_checks - csp._full_checks - csp._combinations_pruned
    actually_checked = csp._full_checks

    print(f"\nEstatísticas de poda:")
    print(f"  Total de pares possíveis: {total_pairs}")
    print(f"  Poda early (max_shift): {csp._combinations_pruned}")
    print(f"  Eliminados por _fast_feasibility_check: {fast_eliminated}")
    print(f"  Verificações completas (_can_extend): {actually_checked}")

    print(f"\nEficiência:")
    print(f"  Poda early (%): {(csp._combinations_pruned / total_pairs * 100):.1f}%")
    print(f"  Fast check elimina (%): {(fast_eliminated / total_pairs * 100):.1f}%")
    print(f"  Redução total (%): {((csp._combinations_pruned + fast_eliminated) / total_pairs * 100):.1f}%")

    # Mostrar estrutura do grafo
    print(f"\nTop 10 arestas do grafo:")
    edge_count = 0
    for task_id, succs in neighbors.items():
        if succs:
            print(f"  {task_id} → {[s.id for s in succs[:3]]}")
            edge_count += 1
            if edge_count >= 10:
                break

    # Analisar cache
    print(f"\nCache statistics:")
    print(f"  Tamanho cache _can_extend: {len(csp._can_extend_cache)}")
    print(f"  Tamanho cache _transfer_needed: {len(csp._transfer_needed_cache)}")
    print(f"  Tamanho cache _service_day: {len(csp._service_day_cache)}")

    # Verificar overhead de Duty temporário
    print(f"\nOverhead potencial:")
    print(f"  Duty temporários criados: {csp._full_checks}")
    print(f"  Cada Duty contém: id, trips, work_time, spread_time, etc.")

if __name__ == "__main__":
    try:
        analyze_neighborhood_overhead()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)