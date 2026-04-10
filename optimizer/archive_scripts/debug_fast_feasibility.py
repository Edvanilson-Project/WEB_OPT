#!/usr/bin/env python3
"""
DEBUG: Teste isolado do _fast_feasibility_check
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip
import logging

logging.basicConfig(level=logging.DEBUG)

def create_test_pairs():
    """Cria pares de blocos para testar cada regra do _fast_feasibility_check"""
    blocks = []

    # Base: 06:00
    base_time = 360

    # 1. Bloco 1: 06:00-06:30
    t1 = Trip(id=1, line_id=1, start_time=base_time, end_time=base_time+30,
              origin_id=1, destination_id=2, duration=30, distance_km=10.0)
    block1 = Block(id=1, trips=[t1], vehicle_type_id=1)

    # 2. Bloco 2: COM OVERLAP (06:25-06:55) - Deve ser rejeitado
    t2 = Trip(id=2, line_id=1, start_time=base_time+25, end_time=base_time+55,
              origin_id=2, destination_id=3, duration=30, distance_km=10.0)
    block2 = Block(id=2, trips=[t2], vehicle_type_id=1)

    # 3. Bloco 3: Gap normal 10min (06:40-07:10) - Deve passar
    t3 = Trip(id=3, line_id=1, start_time=base_time+40, end_time=base_time+70,
              origin_id=2, destination_id=3, duration=30, distance_km=10.0)
    block3 = Block(id=3, trips=[t3], vehicle_type_id=1)

    # 4. Bloco 4: Gap > max_shift (500min) - Deve ser rejeitado
    t4 = Trip(id=4, line_id=1, start_time=base_time+500, end_time=base_time+530,
              origin_id=1, destination_id=2, duration=30, distance_km=10.0)
    block4 = Block(id=4, trips=[t4], vehicle_type_id=1)

    # 5. Bloco 5: Transferência insuficiente - Deve ser rejeitado
    # Vamos forçar transfer_needed alto (60min) com gap pequeno (10min)
    t5 = Trip(id=5, line_id=1, start_time=base_time+80, end_time=base_time+110,
              origin_id=99, destination_id=100, duration=30, distance_km=10.0)
    block5 = Block(id=5, trips=[t5], vehicle_type_id=1)

    return [block1, block2, block3, block4, block5]

def test_fast_feasibility():
    """Testa cada regra do _fast_feasibility_check isoladamente"""
    print("="*80)
    print("TESTE ISOLADO DO _fast_feasibility_check")
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

    blocks = create_test_pairs()
    task = blocks[0]  # Bloco 1 como referência

    print(f"\nTask de referência: {task.id} ({task.start_time//60:02d}:{task.start_time%60:02d}-{task.end_time//60:02d}:{task.end_time%60:02d})")
    print(f"Origem: {task.trips[0].origin_id}, Destino: {task.trips[0].destination_id}")

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
        # Criar Duty manualmente com o task
        from src.domain.models import Duty
        duty = Duty(id=999)
        duty.tasks = [task]
        # Inicializar segments baseado nas trips do task
        from src.domain.models import DutySegment
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

    print(f"\n" + "="*80)
    print("ESTATÍSTICAS:")
    print(f"  _fast_checks: {csp._fast_checks}")
    print(f"  _full_checks: {csp._full_checks}")
    print(f"  _combinations_pruned: {csp._combinations_pruned}")
    print("="*80)

def test_transfer_needed_logic():
    """Testa lógica de transferência com diferentes terminais"""
    print(f"\n" + "="*80)
    print("TESTE DE LÓGICA DE TRANSFER_NEEDED")
    print("="*80)

    csp = SetPartitioningOptimizedCSP(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
        "use_optimized_set_partitioning": True,
    })

    # Criar blocos com diferentes combinações de origem/destino
    base_time = 360

    # Caso 1: Mesmo terminal (destino == origem) - transferência mínima
    t1 = Trip(id=1, line_id=1, start_time=base_time, end_time=base_time+30,
              origin_id=1, destination_id=2, duration=30, distance_km=10.0)
    t2 = Trip(id=2, line_id=1, start_time=base_time+40, end_time=base_time+70,
              origin_id=2, destination_id=3, duration=30, distance_km=10.0)

    block1 = Block(id=1, trips=[t1], vehicle_type_id=1)
    block2 = Block(id=2, trips=[t2], vehicle_type_id=1)

    transfer = csp.greedy._transfer_needed(block1, block2)
    print(f"\nCaso 1: destino({block1.trips[0].destination_id}) == origem({block2.trips[0].origin_id})")
    print(f"  Transferência necessária: {transfer} minutos (esperado: min_layover={csp.greedy.min_layover})")

    # Caso 2: Terminais diferentes - transferência baseada em distância
    t3 = Trip(id=3, line_id=1, start_time=base_time, end_time=base_time+30,
              origin_id=1, destination_id=2, duration=30, distance_km=10.0)
    t4 = Trip(id=4, line_id=1, start_time=base_time+40, end_time=base_time+70,
              origin_id=3, destination_id=4, duration=30, distance_km=10.0)

    block3 = Block(id=3, trips=[t3], vehicle_type_id=1)
    block4 = Block(id=4, trips=[t4], vehicle_type_id=1)

    transfer2 = csp.greedy._transfer_needed(block3, block4)
    print(f"\nCaso 2: destino({block3.trips[0].destination_id}) != origem({block4.trips[0].origin_id})")
    print(f"  Transferência necessária: {transfer2} minutos")

    # Caso 3: operator_change_terminals_only=True (regra mais restritiva)
    print(f"\noperator_change_terminals_only: {csp.greedy.operator_change_terminals_only}")
    print(f"max_shift: {csp.max_shift}")
    print(f"min_layover: {csp.greedy.min_layover}")

if __name__ == "__main__":
    try:
        test_fast_feasibility()
        test_transfer_needed_logic()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)