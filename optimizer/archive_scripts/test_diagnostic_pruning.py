#!/usr/bin/env python3
"""
Teste diagnóstico para verificar por que a poda agressiva está mostrando 0% de redução.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.algorithms.vsp.greedy import GreedyVSP
from src.domain.models import VehicleType

def make_test_cases():
    """Cria casos de teste que DEVEM ativar podas."""

    # CASO 1: Trips sobrepostas (deve ativar overlap pruning)
    overlapping_trips = []
    for i in range(3):
        t = Trip(
            id=i+1,
            line_id=1,
            start_time=360 + i*30,  # Overlap: começa 30min após a anterior, mas dura 60min
            end_time=360 + i*30 + 60,
            origin_id=1,
            destination_id=2,
            duration=60,
            distance_km=20.0,
        )
        overlapping_trips.append(t)

    # CASO 2: Gaps grandes > max_shift (deve ativar spread pruning)
    large_gap_trips = []
    start = 360
    for i in range(3):
        t = Trip(
            id=i+11,
            line_id=1,
            start_time=start,
            end_time=start + 60,
            origin_id=1,
            destination_id=2,
            duration=60,
            distance_km=20.0,
        )
        large_gap_trips.append(t)
        start += 800  # 13h20 de gap > max_shift (13h)

    # CASO 3: Service day regression (trips em dias diferentes, ordem invertida)
    # Nota: Simulação simplificada - precisamos de trips com service days diferentes

    # CASO 4: Transferência insuficiente
    # Precisaria de trips com destinos/origens diferentes e deadhead times

    return {
        "overlapping": overlapping_trips,
        "large_gap": large_gap_trips,
    }

def test_fast_feasibility_check():
    """Testa diretamente a função _fast_feasibility_check."""
    print("=== TESTE DIRETO DA _fast_feasibility_check ===")

    # Criar algoritmo para teste
    csp = SetPartitioningOptimizedCSP()

    # Criar blocos simples para teste
    block1 = Block(id=1, trips=[Trip(id=1, line_id=1, start_time=360, end_time=420, origin_id=1, destination_id=2, duration=60)])
    block2 = Block(id=2, trips=[Trip(id=2, line_id=1, start_time=430, end_time=490, origin_id=2, destination_id=3, duration=60)])

    # Teste 1: Blocos normais (deve passar)
    print("Teste 1: Blocos normais (gap de 10min)")
    result = csp._fast_feasibility_check(block1, block2)
    print(f"  Resultado: {result}")
    print(f"  fast_checks: {csp._fast_checks}, combinations_pruned: {csp._combinations_pruned}")

    # Teste 2: Bloco 2 começa antes do bloco 1 terminar (overlap)
    block3 = Block(id=3, trips=[Trip(id=3, line_id=1, start_time=410, end_time=470, origin_id=1, destination_id=2, duration=60)])
    print("\nTeste 2: Overlap (bloco 3 começa às 410, bloco 1 termina às 420)")
    csp._fast_checks = 0
    csp._combinations_pruned = 0
    result = csp._fast_feasibility_check(block1, block3)
    print(f"  Resultado: {result} (esperado: False)")
    print(f"  fast_checks: {csp._fast_checks}, combinations_pruned: {csp._combinations_pruned}")

    # Teste 3: Gap muito grande (> max_shift)
    block4 = Block(id=4, trips=[Trip(id=4, line_id=1, start_time=360 + 800, end_time=420 + 800, origin_id=1, destination_id=2, duration=60)])
    print("\nTeste 3: Gap grande (800 min > max_shift ~780)")
    csp._fast_checks = 0
    csp._combinations_pruned = 0
    result = csp._fast_feasibility_check(block1, block4)
    print(f"  Resultado: {result} (esperado: False)")
    print(f"  fast_checks: {csp._fast_checks}, combinations_pruned: {csp._combinations_pruned}")

def test_complete_pipeline():
    """Testa o pipeline completo com casos que devem ativar podas."""
    print("\n\n=== TESTE PIPELINE COMPLETO ===")

    # Criar vehicle types
    vehicle_types = [
        VehicleType(
            id=1,
            name="Bus Standard",
            passenger_capacity=40,
            cost_per_km=2.0,
            cost_per_hour=50.0,
            fixed_cost=800.0,
        )
    ]

    # Criar trips com gaps grandes
    trips = []
    start = 360
    for i in range(6):
        t = Trip(
            id=i+1,
            line_id=1,
            start_time=start,
            end_time=start + 60,
            origin_id=1,
            destination_id=2,
            duration=60,
            distance_km=20.0,
        )
        trips.append(t)
        start += 800 if i % 2 == 0 else 100  # Alterna entre gaps grandes e normais

    # Executar VSP
    print("Executando VSP...")
    vsp = GreedyVSP().solve(trips, vehicle_types)
    print(f"VSP gerou {len(vsp.blocks)} blocos")

    # Mostrar detalhes dos blocos
    for i, block in enumerate(vsp.blocks):
        print(f"  Bloco {block.id}: {block.start_time//60:02d}:{block.start_time%60:02d} - {block.end_time//60:02d}:{block.end_time%60:02d} "
              f"(dura {block.total_duration}min, trips: {[t.id for t in block.trips]})")

    # Executar CSP otimizado com debug adicional
    print("\nExecutando SetPartitioningOptimizedCSP...")
    csp = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "goal_weights": {
                "overtime": 0.8,
                "min_work": 0.2,
                "spread": 0.15,
                "fairness": 0.05,
                "passive_transfer": 0.25,
            }
        }
    )

    # Debug: mostrar tasks geradas pelo prepare_tasks
    tasks, run_cut_meta = csp.greedy.prepare_tasks(vsp.blocks)
    print(f"\nPrepare_tasks gerou {len(tasks)} tarefas:")
    for i, task in enumerate(tasks):
        print(f"  Task {task.id}: {task.start_time//60:02d}:{task.start_time%60:02d} - {task.end_time//60:02d}:{task.end_time%60:02d} "
              f"(dura {task.total_duration}min, trips: {[t.id for t in task.trips]})")

    solution = csp.solve(vsp.blocks)

    # Analisar métricas
    print(f"\nMÉTRICAS DE PERFORMANCE:")
    metrics = solution.meta.get("performance_metrics", {})
    for key, value in metrics.items():
        print(f"  {key}: {value}")

    # Análise detalhada
    print(f"\nANÁLISE DETALHADA:")
    print(f"  fast_checks: {metrics.get('fast_checks', 0)}")
    print(f"  combinations_pruned: {metrics.get('combinations_pruned', 0)}")
    print(f"  pruning_ratio: {metrics.get('pruning_ratio', 0):.3f}")
    print(f"  pruning_reduction_pct: {metrics.get('pruning_reduction_pct', 0):.1f}%")

    if metrics.get('pruning_reduction_pct', 0) < 10:
        print("\n⚠ ALERTA: Redução de poda abaixo de 10% - verificações podem não estar funcionando!")
        print("  Possíveis causas:")
        print("  1. Test data não ativa as condições de pruning")
        print("  2. _fast_feasibility_check não está sendo chamada")
        print("  3. Contadores não estão sendo incrementados corretamente")
        print("  4. max_shift muito grande (>13h) - gaps de 800min podem ainda ser aceitos")

        # Verificar valor real de max_shift
        print(f"\n  Parâmetro max_shift do CSP: {csp.max_shift} min")
        print(f"  Gaps no teste: 800 min vs max_shift: {csp.max_shift} min")
        print(f"  Gap > max_shift? {800 > csp.max_shift}")

        # Verificar gaps entre tasks
        print(f"\n  Análise de gaps entre tasks:")
        tasks_sorted = sorted(tasks, key=lambda t: t.start_time)
        for i in range(len(tasks_sorted)-1):
            gap = tasks_sorted[i+1].start_time - tasks_sorted[i].end_time
            print(f"    Gap entre task {tasks_sorted[i].id} e {tasks_sorted[i+1].id}: {gap}min")
            if gap > csp.max_shift:
                print(f"      ⚠ Gap > max_shift ({csp.max_shift}min) - DEVERIA ativar pruning!")

if __name__ == "__main__":
    print("DIAGNÓSTICO DA PODA AGRESSIVA - Nível Optibus")
    print("=" * 60)

    # Teste 1: Verificação direta da função
    test_fast_feasibility_check()

    # Teste 2: Pipeline completo
    test_complete_pipeline()