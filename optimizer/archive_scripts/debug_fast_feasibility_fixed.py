#!/usr/bin/env python3
"""
DEBUG: Teste isolado do _fast_feasibility_check COM RESTRIÇÃO operator_change_terminals_only
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip
import logging

logging.basicConfig(level=logging.DEBUG)

def create_test_pairs():
    """Cria pares de blocos para testar cada regra do _fast_feasibility_check
    COM DADOS REALISTAS que respeitam operator_change_terminals_only=True"""
    blocks = []

    # Base: 06:00
    base_time = 360

    # 1. Bloco 1: 06:00-06:30 (Terminal 1 → Terminal 2)
    t1 = Trip(id=1, line_id=1, start_time=base_time, end_time=base_time+30,
              origin_id=1, destination_id=2, duration=30, distance_km=10.0)
    block1 = Block(id=1, trips=[t1], vehicle_type_id=1)

    # 2. Bloco 2: COM OVERLAP (06:25-06:55) - Deve ser rejeitado
    # Mesmo terminal (2 → 3) mas overlap
    t2 = Trip(id=2, line_id=1, start_time=base_time+25, end_time=base_time+55,
              origin_id=2, destination_id=3, duration=30, distance_km=10.0)
    block2 = Block(id=2, trips=[t2], vehicle_type_id=1)

    # 3. Bloco 3: Gap normal 10min (06:40-07:10) - Deve passar
    # Terminal 3 → Terminal 4 (continuação)
    t3 = Trip(id=3, line_id=1, start_time=base_time+40, end_time=base_time+70,
              origin_id=3, destination_id=4, duration=30, distance_km=10.0)
    block3 = Block(id=3, trips=[t3], vehicle_type_id=1)

    # 4. Bloco 4: Gap > max_shift (500min) - Deve ser rejeitado
    # Terminal 4 → Terminal 5 (grande gap)
    t4 = Trip(id=4, line_id=1, start_time=base_time+500, end_time=base_time+530,
              origin_id=4, destination_id=5, duration=30, distance_km=10.0)
    block4 = Block(id=4, trips=[t4], vehicle_type_id=1)

    # 5. Bloco 5: Transferência insuficiente - Deve ser rejeitado
    # Vamos forçar transfer_needed alto (60min) com gap pequeno (10min)
    # Terminal 5 → Terminal 6 (transferência insuficiente)
    t5 = Trip(id=5, line_id=1, start_time=base_time+80, end_time=base_time+110,
              origin_id=5, destination_id=6, duration=30, distance_km=10.0)
    block5 = Block(id=5, trips=[t5], vehicle_type_id=1)

    # 6. Bloco 6: VIOLAÇÃO operator_change_terminals_only - Deve ser rejeitado pelo fast check
    # Terminal 6 → Terminal 7 MAS bloco 1 terminou no terminal 2 ≠ terminal 6
    t6 = Trip(id=6, line_id=1, start_time=base_time+120, end_time=base_time+150,
              origin_id=6, destination_id=7, duration=30, distance_km=10.0)
    block6 = Block(id=6, trips=[t6], vehicle_type_id=1)

    return [block1, block2, block3, block4, block5, block6]

def test_fast_feasibility():
    """Testa cada regra do _fast_feasibility_check isoladamente COM operator_change_terminals_only=True"""
    print("="*80)
    print("TESTE ISOLADO DO _fast_feasibility_check COM operator_change_terminals_only=True")
    print("="*80)

    csp = SetPartitioningOptimizedCSP(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
        "use_optimized_set_partitioning": True,
        "operator_change_terminals_only": True  # FORÇAR True
    })

    # Reset contadores
    csp._fast_checks = 0
    csp._full_checks = 0
    csp._combinations_pruned = 0

    blocks = create_test_pairs()
    task = blocks[0]  # Bloco 1 como referência

    print(f"\nTask de referência: {task.id} ({task.start_time//60:02d}:{task.start_time%60:02d}-{task.end_time//60:02d}:{task.end_time%60:02d})")
    print(f"Origem: {task.trips[0].origin_id}, Destino: {task.trips[0].destination_id}")
    print(f"operator_change_terminals_only: {csp.greedy.operator_change_terminals_only}")
    print(f"max_shift: {csp.max_shift}")

    for nxt in blocks[1:]:
        print(f"\n--- Testando extensão para bloco {nxt.id} ---")
        print(f"  Horário: {nxt.start_time//60:02d}:{nxt.start_time%60:02d}-{nxt.end_time//60:02d}:{nxt.end_time%60:02d}")
        print(f"  Origem: {nxt.trips[0].origin_id}, Destino: {nxt.trips[0].destination_id}")
        print(f"  Gap: {nxt.start_time - task.end_time} minutos")

        # Verificar transfer_needed
        transfer_needed = csp.greedy._transfer_needed(task, nxt)
        print(f"  Transferência necessária: {transfer_needed} minutos")

        # Testar _fast_feasibility_check
        result = csp._fast_feasibility_check(task, nxt)
        print(f"  _fast_feasibility_check: {result}")

        # Testar _can_extend completo para comparação
        from src.domain.models import Duty, DutySegment
        duty = Duty(id=999)
        duty.tasks = [task]
        duty.segments = [DutySegment(block_id=task.id, trips=list(task.trips))]
        duty.work_time = sum(t.duration for t in task.trips)
        duty.spread_time = task.trips[-1].end_time - task.trips[0].start_time
        ok, reason, _ = csp.greedy._can_extend(duty, nxt)
        print(f"  _can_extend completo: {ok} (razão: {reason})")

        # Análise de cada regra
        print(f"  Análise detalhada:")

        # 1. Overlap
        if nxt.start_time < task.end_time:
            print(f"    ✗ OVERLAP: nxt.start_time ({nxt.start_time}) < task.end_time ({task.end_time})")
        else:
            print(f"    ✓ Sem overlap")

        # 2. Service day regression (para este teste simples, não aplicável)
        print(f"    Service day: task={csp.greedy._service_day(task)}, nxt={csp.greedy._service_day(nxt)}")

        # 3. Spread máximo
        gap = nxt.start_time - task.end_time
        if gap > csp.max_shift:
            print(f"    ✗ SPREAD MÁXIMO: gap {gap} > max_shift {csp.max_shift}")
        else:
            print(f"    ✓ Spread dentro do limite")

        # 4. Transferência mínima
        if gap < transfer_needed:
            print(f"    ✗ TRANSFERÊNCIA: gap {gap} < transfer_needed {transfer_needed}")
        else:
            print(f"    ✓ Transferência suficiente")

        # 5. operator_change_terminals_only
        if csp.greedy.operator_change_terminals_only:
            if task.trips[-1].destination_id != nxt.trips[0].origin_id:
                print(f"    ✗ OPERATOR_CHANGE_TERMINALS_ONLY: destino({task.trips[-1].destination_id}) != origem({nxt.trips[0].origin_id})")
            else:
                print(f"    ✓ operator_change_terminals_only ok")

    print(f"\n" + "="*80)
    print("ESTATÍSTICAS:")
    print(f"  _fast_checks: {csp._fast_checks}")
    print(f"  _full_checks: {csp._full_checks}")
    print(f"  _combinations_pruned: {csp._combinations_pruned}")
    print("="*80)

def test_neighborhood_overhead():
    """Teste com instância realista para medir eficácia da poda"""
    print(f"\n" + "="*80)
    print("TESTE DE OVERHEAD COM INSTÂNCIA REALISTA")
    print("="*80)

    # Criar instância realista com 20 blocos
    blocks = []
    start = 360
    n_terminals = 8

    for i in range(20):
        n_trips = 1 + (i % 3)
        trips = []
        block_start = start

        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 + (j * 15)
            # Garantir conexões realistas: destino atual = origem próximo
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

    print(f"Construindo grafo de vizinhança com {len(blocks)} blocos...")
    neighbors = csp._task_neighbors_optimized(blocks)
    edges = sum(len(v) for v in neighbors.values())

    print(f"\nResultados:")
    print(f"  Blocos: {len(blocks)}")
    print(f"  Arestas no grafo: {edges}")
    print(f"  _fast_checks: {csp._fast_checks}")
    print(f"  _full_checks: {csp._full_checks}")
    print(f"  _combinations_pruned: {csp._combinations_pruned}")

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

if __name__ == "__main__":
    try:
        test_fast_feasibility()
        test_neighborhood_overhead()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)