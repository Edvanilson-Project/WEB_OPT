#!/usr/bin/env python3
"""
DEBUG: Por que _cached_can_extend retorna False para todos os pares?
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip, Duty


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
    return blocks


def debug_can_extend():
    """Debug da função _cached_can_extend."""
    blocks = create_simple_instance()

    csp = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
            "use_optimized_set_partitioning": True,
        },
        operator_change_terminals_only=False
    )

    # Verificar se o parâmetro foi aplicado corretamente
    print(f"\nParâmetro operator_change_terminals_only no greedy: {csp.greedy.operator_change_terminals_only}")

    # Testar primeiro par de blocos
    task = blocks[0]
    nxt = blocks[1]

    print(f"\nTestando _cached_can_extend:")
    print(f"  Task {task.id}: {task.start_time//60:02d}:{task.start_time%60:02d}-{task.end_time//60:02d}:{task.end_time%60:02d}")
    print(f"  Next {nxt.id}: {nxt.start_time//60:02d}:{nxt.start_time%60:02d}-{nxt.end_time//60:02d}:{nxt.end_time%60:02d}")

    # Criar duty temporária
    duty = Duty(id=0)

    # Verificar propriedades do duty
    print(f"\nDuty criada:")
    print(f"  duty.tasks: {duty.tasks}")
    print(f"  duty.all_trips: {duty.all_trips}")

    # Aplicar primeira tarefa à duty
    print(f"\nAplicando primeira tarefa à duty...")

    # Verificar service day da task
    task_day = csp.greedy._service_day(task)
    print(f"  Service day da task: {task_day}")

    # Calcular valores iniciais
    new_work = csp.greedy._block_drive(task)
    new_spread = task.total_duration + csp.greedy.pullout + csp.greedy.pullback
    new_cont = csp.greedy._block_drive(task)
    daily_drive = csp.greedy._block_drive(task)
    extended_days_used = 1 if csp.greedy._block_drive(task) > csp.greedy.daily_driving_limit else 0

    print(f"  new_work: {new_work}")
    print(f"  new_spread: {new_spread}")
    print(f"  new_cont: {new_cont}")
    print(f"  daily_drive: {daily_drive}")
    print(f"  extended_days_used: {extended_days_used}")

    # Aplicar bloco
    csp.greedy._apply_block(duty, task, {
        "new_work": new_work,
        "new_spread": new_spread,
        "new_cont": new_cont,
        "daily_drive": daily_drive,
        "extended_days_used": extended_days_used,
    })

    print(f"\nApós aplicar task à duty:")
    print(f"  duty.tasks: {[t.id for t in duty.tasks]}")
    print(f"  duty.work_time: {duty.work_time}")
    print(f"  duty.spread_time: {duty.spread_time}")

    # Testar _cached_can_extend
    print(f"\nChamando _cached_can_extend(duty, nxt)...")
    ok, reason, data = csp._cached_can_extend(duty, nxt)

    print(f"\nResultado _cached_can_extend:")
    print(f"  ok: {ok}")
    print(f"  reason: {reason}")
    print(f"  data: {data}")

    # Testar _can_extend diretamente (sem cache)
    print(f"\nTestando self.greedy._can_extend diretamente...")
    ok_direct, reason_direct, data_direct = csp.greedy._can_extend(duty, nxt)
    print(f"  ok: {ok_direct}")
    print(f"  reason: {reason_direct}")
    print(f"  data: {data_direct}")

    # Testar _fast_feasibility_check novamente
    print(f"\nTestando _fast_feasibility_check:")
    fast_ok = csp._fast_feasibility_check(task, nxt)
    print(f"  Resultado: {fast_ok}")

    # Testar gap manualmente
    gap = nxt.start_time - task.end_time
    print(f"\nCálculos manuais:")
    print(f"  gap: {gap} minutos")
    print(f"  transfer_needed: {csp.greedy._transfer_needed(task, nxt)} minutos")

    # Verificar parâmetros do greedy
    print(f"\nParâmetros do greedy:")
    print(f"  max_shift: {csp.greedy.max_shift}")
    print(f"  max_work: {csp.greedy.max_work}")
    print(f"  min_work: {csp.greedy.min_work}")
    print(f"  max_driving: {csp.greedy.max_driving}")
    print(f"  daily_driving_limit: {csp.greedy.daily_driving_limit}")
    print(f"  operator_change_terminals_only: {csp.greedy.operator_change_terminals_only}")
    print(f"  allow_relief_points: {csp.greedy.allow_relief_points}")


if __name__ == "__main__":
    try:
        debug_can_extend()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)