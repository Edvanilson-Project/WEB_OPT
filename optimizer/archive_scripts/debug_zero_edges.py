#!/usr/bin/env python3
"""
DEBUG: Por que _task_neighbors_optimized retorna 0 arestas?
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip


def create_simple_instance():
    """Cria instância simples com gaps pequenos."""
    blocks = []
    start = 360  # 06:00

    # Criar 5 blocos com gaps de 10 minutos
    for i in range(5):
        trip_dur = 30
        t = Trip(
            id=i+1,
            line_id=1,
            start_time=start,
            end_time=start + trip_dur,
            origin_id=1,
            destination_id=2,
            duration=trip_dur,
            distance_km=10.0,
        )

        block = Block(
            id=i+1,
            trips=[t],
            vehicle_type_id=1,
        )
        blocks.append(block)

        start = start + trip_dur + 10  # Gap de 10 minutos entre blocos

    print(f"Criados {len(blocks)} blocos")
    for i, b in enumerate(blocks):
        print(f"  Bloco {b.id}: {b.start_time//60:02d}:{b.start_time%60:02d}-{b.end_time//60:02d}:{b.end_time%60:02d} "
              f"(duration: {b.end_time - b.start_time} min)")
    return blocks


def debug_fast_feasibility():
    """Debug da função _fast_feasibility_check."""
    blocks = create_simple_instance()

    csp = SetPartitioningOptimizedCSP(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
        "use_optimized_set_partitioning": True,
    })

    # Testar primeiro par de blocos
    task = blocks[0]
    nxt = blocks[1]

    print(f"\nTestando _fast_feasibility_check:")
    print(f"  Task {task.id}: {task.start_time//60:02d}:{task.start_time%60:02d}-{task.end_time//60:02d}:{task.end_time%60:02d}")
    print(f"  Next {nxt.id}: {nxt.start_time//60:02d}:{nxt.start_time%60:02d}-{nxt.end_time//60:02d}:{nxt.end_time%60:02d}")

    # Calcular gap manualmente
    gap = nxt.start_time - task.end_time
    print(f"  Gap: {gap} minutos")
    print(f"  max_shift: {csp.max_shift} minutos")

    # Testar cada condição individualmente
    print(f"\nVerificações individuais:")

    # 1. Overlap temporal
    if nxt.start_time < task.end_time:
        print(f"  ✗ Overlap temporal: nxt.start_time ({nxt.start_time}) < task.end_time ({task.end_time})")
    else:
        print(f"  ✓ Overlap temporal: OK")

    # 2. Service day regression
    # Primeiro precisamos ver como _cached_service_day funciona
    try:
        task_day = csp._cached_service_day(task)
        nxt_day = csp._cached_service_day(nxt)
        print(f"  Service days: task={task_day}, nxt={nxt_day}")
        if nxt_day < task_day:
            print(f"  ✗ Service day regression: nxt_day ({nxt_day}) < task_day ({task_day})")
        else:
            print(f"  ✓ Service day: OK")
    except Exception as e:
        print(f"  Erro em service day: {e}")

    # 3. Spread entre pares
    if gap > csp.max_shift:
        print(f"  ✗ Spread entre pares: gap ({gap}) > max_shift ({csp.max_shift})")
    else:
        print(f"  ✓ Spread entre pares: OK")

    # 4. Transferência mínima
    try:
        transfer_needed = csp._cached_transfer_needed(task, nxt)
        print(f"  Transferência necessária: {transfer_needed} minutos")
        if gap < transfer_needed:
            print(f"  ✗ Transferência mínima: gap ({gap}) < transfer_needed ({transfer_needed})")
        else:
            print(f"  ✓ Transferência mínima: OK")
    except Exception as e:
        print(f"  Erro em transferência: {e}")

    # Testar função completa
    result = csp._fast_feasibility_check(task, nxt)
    print(f"\nResultado _fast_feasibility_check: {result}")

    # Testar neighbors otimizado
    print(f"\nTestando _task_neighbors_optimized completo...")
    neighbors = csp._task_neighbors_optimized(blocks)

    print(f"\nGrafo de vizinhança:")
    total_edges = 0
    for task_id, succs in neighbors.items():
        print(f"  Bloco {task_id} → {[s.id for s in succs]}")
        total_edges += len(succs)

    print(f"\nTotal arestas: {total_edges}")

    # Verificar contadores internos
    print(f"\nContadores internos:")
    print(f"  _fast_checks: {csp._fast_checks}")
    print(f"  _combinations_pruned: {csp._combinations_pruned}")
    print(f"  _full_checks: {csp._full_checks}")
    print(f"  _cache_hits: {csp._cache_hits}")


if __name__ == "__main__":
    try:
        debug_fast_feasibility()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)