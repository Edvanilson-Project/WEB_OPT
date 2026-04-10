#!/usr/bin/env python3
"""
Teste de compatibilidade para verificar que a classe otimizada respeita
os mesmos limites de coluna que a classe original.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip


def _trip(
    tid: int,
    start: int,
    dur: int,
    *,
    line: int = 1,
    origin: int = 1,
    dest: int = 2,
    depot: int | None = None,
    energy: float = 0.0,
    night: bool = False,
    trip_group_id: int | None = None,
    direction: str | None = None,
):
    start_time = start if not night else 22 * 60 + start
    return Trip(
        id=tid,
        line_id=line,
        start_time=start_time,
        end_time=start_time + dur,
        origin_id=origin,
        destination_id=dest,
        trip_group_id=trip_group_id,
        direction=direction,
        duration=dur,
        distance_km=max(1.0, dur / 3),
        depot_id=depot,
        energy_kwh=energy,
        deadhead_times={origin: 8, dest: 8},
    )


def test_original_column_limits():
    """Testa a classe original com limites de coluna."""
    print("=== TESTE ORIGINAL: Limites de Coluna ===")

    blocks = [
        Block(id=index + 1, trips=[_trip(index + 1, 360 + index * 70, 55, line=40, origin=1 if index % 2 == 0 else 2, dest=2 if index % 2 == 0 else 1, depot=1)])
        for index in range(8)
    ]

    sol = SetPartitioningCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_trips_per_piece": 4,
            "max_generated_columns": 20,
            "max_candidate_successors_per_task": 3,
            "max_pricing_iterations": 1,
            "max_pricing_additions": 10,
        }
    ).solve(blocks, [])

    print(f"Resultados originais:")
    print(f"- Duties: {len(sol.duties)}")
    print(f"- Workpieces generated: {sol.meta.get('workpieces_generated', 'N/A')}")
    print(f"- Column generation meta: {sol.meta.get('column_generation', {})}")

    # Verificações do teste original
    assert sol.meta["workpieces_generated"] <= 20
    assert sol.meta["column_generation"]["max_generated_columns"] == 20

    print("✓ Teste original passou!")
    return sol


def test_optimized_column_limits():
    """Testa a classe otimizada com os mesmos limites."""
    print("\n=== TESTE OTIMIZADO: Limites de Coluna ===")

    blocks = [
        Block(id=index + 1, trips=[_trip(index + 1, 360 + index * 70, 55, line=40, origin=1 if index % 2 == 0 else 2, dest=2 if index % 2 == 0 else 1, depot=1)])
        for index in range(8)
    ]

    sol = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_trips_per_piece": 4,
            "max_generated_columns": 20,
            "max_candidate_successors_per_task": 3,
            "max_pricing_iterations": 1,
            "max_pricing_additions": 10,
        }
    ).solve(blocks, [])

    print(f"Resultados otimizados:")
    print(f"- Duties: {len(sol.duties)}")
    print(f"- Workpieces generated: {sol.meta.get('workpieces_generated', 'N/A')}")
    print(f"- Column generation meta: {sol.meta.get('column_generation', {})}")

    if "performance_metrics" in sol.meta:
        metrics = sol.meta["performance_metrics"]
        print(f"- Fast checks: {metrics.get('fast_checks', 'N/A')}")
        print(f"- Combinations pruned: {metrics.get('combinations_pruned', 'N/A')}")
        print(f"- Pruning reduction: {metrics.get('pruning_reduction_pct', 'N/A')}%")

    # Mesmas verificações do teste original
    assert sol.meta["workpieces_generated"] <= 20
    assert sol.meta["column_generation"]["max_generated_columns"] == 20

    print("✓ Teste otimizado passou!")
    return sol


def compare_performance(orig_sol, opt_sol):
    """Compara performance entre soluções original e otimizada."""
    print("\n=== COMPARAÇÃO DE PERFORMANCE ===")

    orig_workpieces = orig_sol.meta.get("workpieces_generated", 0)
    opt_workpieces = opt_sol.meta.get("workpieces_generated", 0)

    print(f"Workpieces gerados:")
    print(f"  Original: {orig_workpieces}")
    print(f"  Otimizada: {opt_workpieces}")
    print(f"  Diferença: {opt_workpieces - orig_workpieces}")

    if "performance_metrics" in opt_sol.meta:
        metrics = opt_sol.meta["performance_metrics"]
        fast_checks = metrics.get('fast_checks', 0)
        combinations_pruned = metrics.get('combinations_pruned', 0)
        pruning_pct = metrics.get('pruning_reduction_pct', 0)

        print(f"\nMétricas de poda otimizada:")
        print(f"  Fast checks: {fast_checks}")
        print(f"  Combinations pruned: {combinations_pruned}")
        print(f"  Pruning reduction: {pruning_pct}%")

        if pruning_pct > 0:
            print(f"  ✓ Podas efetivas detectadas!")
        else:
            print(f"  ⚠ Sem redução de combinações neste cenário")

    # Verificar se a solução otimizada tem qualidade similar
    print(f"\nComparação de qualidade:")
    print(f"  Duties originais: {len(orig_sol.duties)}")
    print(f"  Duties otimizadas: {len(opt_sol.duties)}")

    if len(orig_sol.duties) == len(opt_sol.duties):
        print(f"  ✓ Mesmo número de duties!")

        # Comparar sequências de trips
        for i, (orig_duty, opt_duty) in enumerate(zip(orig_sol.duties, opt_sol.duties)):
            orig_trips = [t.id for t in orig_duty.all_trips]
            opt_trips = [t.id for t in opt_duty.all_trips]
            if orig_trips == opt_trips:
                print(f"    Duty {i+1}: ✓ Mesma sequência de trips")
            else:
                print(f"    Duty {i+1}: ⚠ Sequência diferente")
                print(f"      Original: {orig_trips}")
                print(f"      Otimizada: {opt_trips}")
    else:
        print(f"  ⚠ Número diferente de duties")

    print(f"\n✓ Comparação concluída!")


if __name__ == "__main__":
    print("TESTE DE LIMITES DE COLUNA - Classe Otimizada vs Original")
    print("=" * 70)

    try:
        # Executar testes
        orig_sol = test_original_column_limits()
        opt_sol = test_optimized_column_limits()

        # Comparar performance
        compare_performance(orig_sol, opt_sol)

        print("\n" + "="*70)
        print("✓ TODOS OS TESTES PASSARAM!")
        print("✓ Classe otimizada respeita limites de coluna corretamente")
        print("="*70)

    except Exception as e:
        print(f"\n✗ ERRO DURANTE OS TESTES: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)