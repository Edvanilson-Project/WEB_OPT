#!/usr/bin/env python3
"""
Debug detalhado das métricas de poda para entender a discrepância entre testes.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, VehicleType, Block
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
import logging

# Ativar logs DEBUG
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def test_simple_trips():
    """Teste com trips simples (gaps de 90min) - caso que mostra 0% de redução."""
    print("=== TESTE COM TRIPS SIMPLES (gaps de 90min) ===")

    trips = []
    start = 360  # 06:00
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
        start += 90  # 1h30 de intervalo

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

    print(f"Trips criadas: {len(trips)}")
    for t in trips:
        print(f"  Trip {t.id}: {t.start_time//60:02d}:{t.start_time%60:02d} - {t.end_time//60:02d}:{t.end_time%60:02d}")

    # Executar VSP
    vsp = GreedyVSP().solve(trips, vehicle_types)
    print(f"\nVSP gerou {len(vsp.blocks)} blocos")
    for b in vsp.blocks:
        print(f"  Bloco {b.id}: {b.start_time//60:02d}:{b.start_time%60:02d} - {b.end_time//60:02d}:{b.end_time%60:02d}")
        print(f"    Trips: {[t.id for t in b.trips]}")

    # Executar CSP otimizado
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

    # Resetar contadores manualmente para debug
    csp._fast_checks = 0
    csp._combinations_pruned = 0
    csp._full_checks = 0
    csp._cache_hits = 0

    solution = csp.solve(vsp.blocks)

    print(f"\nMÉTRICAS FINAIS:")
    print(f"  fast_checks: {csp._fast_checks}")
    print(f"  combinations_pruned: {csp._combinations_pruned}")
    print(f"  pruning_reduction_pct: {(csp._combinations_pruned / max(1, csp._fast_checks)) * 100:.1f}%")

    # Analisar gaps entre tarefas
    tasks, _ = csp.greedy.prepare_tasks(vsp.blocks)
    print(f"\nTarefas preparadas: {len(tasks)}")

    tasks_sorted = sorted(tasks, key=lambda t: t.start_time)
    print("Análise de gaps entre tarefas ordenadas:")
    for i in range(len(tasks_sorted)-1):
        gap = tasks_sorted[i+1].start_time - tasks_sorted[i].end_time
        print(f"  Gap entre task {tasks_sorted[i].id} e {tasks_sorted[i+1].id}: {gap}min")
        if gap > csp.max_shift:
            print(f"    ⚠ Gap > max_shift ({csp.max_shift}min)")

    return solution

def test_mixed_gaps():
    """Teste com gaps mistos (800/100) - caso que mostra 86.7% de redução."""
    print("\n\n=== TESTE COM GAPS MISTOS (800/100) ===")

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
        start += 800 if i % 2 == 0 else 100

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

    print(f"Trips criadas: {len(trips)}")
    for t in trips:
        print(f"  Trip {t.id}: {t.start_time//60:02d}:{t.start_time%60:02d} - {t.end_time//60:02d}:{t.end_time%60:02d}")

    # Executar CSP otimizado
    print("\nExecutando SetPartitioningOptimizedCSP...")
    csp = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
        }
    )

    # Resetar contadores manualmente
    csp._fast_checks = 0
    csp._combinations_pruned = 0
    csp._full_checks = 0
    csp._cache_hits = 0

    vsp = GreedyVSP().solve(trips, vehicle_types)
    solution = csp.solve(vsp.blocks)

    print(f"\nMÉTRICAS FINAIS:")
    print(f"  fast_checks: {csp._fast_checks}")
    print(f"  combinations_pruned: {csp._combinations_pruned}")
    print(f"  pruning_reduction_pct: {(csp._combinations_pruned / max(1, csp._fast_checks)) * 100:.1f}%")

    return solution

def analyze_pruning_logic():
    """Análise teórica da lógica de poda."""
    print("\n\n=== ANÁLISE TEÓRICA DA LÓGICA DE PODA ===")

    # Simular cenário com 6 tarefas, gaps de 90min
    # max_shift = 480min (8 horas)
    # Cada gap = 30min (90 - 60)

    print("Cenário: 6 tarefas, cada uma com 60min, gaps de 30min entre elas")
    print("max_shift = 480min (8 horas)")

    n = 6
    total_pairs = n * (n-1) / 2  # 15 pares
    print(f"Total de pares possíveis: {total_pairs}")

    # Pares que seriam eliminados por gap > max_shift
    # Com gaps pequenos, NENHUM par tem gap > 480min
    print("Pares eliminados por gap > max_shift: 0 (todos os gaps são de 30min)")

    # Pares eliminados por outras regras (overlap, service day, transfer)
    # Neste cenário simples, provavelmente poucos pares são eliminados
    print("\nCONCLUSÃO: Em cenários com gaps pequenos:")
    print("- Early break por gap > max_shift NÃO ocorre")
    print("- Poda depende apenas das outras regras (overlap, service day, transfer)")
    print("- Redução de combinações será baixa (0-30%)")

    print("\nCenário: 6 tarefas, gaps alternados 740min/40min")
    print("max_shift = 480min")

    # Tarefas: T1, T2 (gap 740), T3 (gap 40), T4 (gap 740), T5 (gap 40), T6
    # Pairs com gap > 480: T1-T4, T1-T5, T1-T6, T2-T4, T2-T5, T2-T6, T3-T4...
    print("Muitos pares terão gap > 480min → early break ocorre frequentemente")
    print("Redução de combinações será alta (80-90%)")

if __name__ == "__main__":
    print("DEBUG DETALHADO DAS MÉTRICAS DE PODA")
    print("=" * 60)

    # Teste 1: Trips simples
    sol1 = test_simple_trips()

    # Teste 2: Gaps mistos
    sol2 = test_mixed_gaps()

    # Análise teórica
    analyze_pruning_logic()