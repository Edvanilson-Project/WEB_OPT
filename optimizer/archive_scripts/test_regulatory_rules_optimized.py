"""
Teste adaptado para verificar compatibilidade da classe otimizada com testes existentes.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Block, Trip
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP


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


def test_set_covering_reports_workpieces_and_pricing_meta():
    """Teste adaptado para usar a classe otimizada."""
    print("=== TESTE DE COMPATIBILIDADE DA CLASSE OTIMIZADA ===")

    blocks = [
        Block(id=1, trips=[_trip(1, 360, 60)]),
        Block(id=2, trips=[_trip(2, 450, 60, origin=2, dest=1)]),
        Block(id=3, trips=[_trip(3, 600, 60)]),
        Block(id=4, trips=[_trip(4, 690, 60, origin=2, dest=1)]),
    ]

    print(f"Blocos criados: {len(blocks)}")
    for b in blocks:
        print(f"  Bloco {b.id}: trips {[t.id for t in b.trips]}")

    # Usar classe otimizada
    sol = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_trips_per_piece": 2
        }
    ).solve(blocks, [])

    print(f"\nSOLUÇÃO GERADA:")
    print(f"- Duties: {len(sol.duties)}")
    print(f"- Algoritmo: {sol.algorithm}")
    print(f"- Workpieces gerados: {sol.meta.get('workpieces_generated', 'N/A')}")
    print(f"- Contagem de rosters: {sol.meta.get('roster_count', 'N/A')}")

    if "performance_metrics" in sol.meta:
        metrics = sol.meta["performance_metrics"]
        print(f"\nMÉTRICAS DE PERFORMANCE (Nível Optibus):")
        print(f"- Combinações testadas: {metrics.get('combinations_tested', 'N/A')}")
        print(f"- Combinações podadas: {metrics.get('combinations_pruned', 'N/A')}")
        print(f"- Redução de combinações: {metrics.get('pruning_reduction_pct', 'N/A')}%")
        print(f"- Fast checks: {metrics.get('fast_checks', 'N/A')}")
        print(f"- Full checks: {metrics.get('full_checks', 'N/A')}")

    # Verificações originais
    assert sol.meta["workpieces_generated"] > 0
    assert sol.meta["roster_count"] >= 1

    print("\n✓ TESTE PASSADO - Classe otimizada é compatível com interface original")
    return sol


def test_large_instance():
    """Teste com instância maior para verificar performance."""
    print("\n\n=== TESTE DE PERFORMANCE COM INSTÂNCIA MAIOR ===")

    blocks = []
    start = 360
    for i in range(10):
        block = Block(
            id=i+1,
            trips=[_trip(i+1, start, 60, origin=1, dest=2)]
        )
        blocks.append(block)
        start += 120  # 2h entre blocos

    print(f"Instância com {len(blocks)} blocos")

    sol = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "use_optimized_set_partitioning": True,
            "goal_weights": {
                "overtime": 0.8,
                "min_work": 0.2,
                "spread": 0.15,
                "fairness": 0.05,
                "passive_transfer": 0.25,
            }
        }
    ).solve(blocks, [])

    print(f"\nRESULTADOS INSTÂNCIA MAIOR:")
    print(f"- Duties: {len(sol.duties)}")

    if "performance_metrics" in sol.meta:
        metrics = sol.meta["performance_metrics"]
        reduction = metrics.get('pruning_reduction_pct', 0)
        print(f"- Redução de combinações: {reduction}%")

        if reduction > 50:
            print("✓ REDUÇÃO SIGNIFICATIVA (mais de 50%) - Nível Optibus atingido!")
        else:
            print(f"⚠ Redução abaixo do esperado: {reduction}%")

    return sol


if __name__ == "__main__":
    print("TESTE DE COMPATIBILIDADE E PERFORMANCE DA CLASSE OTIMIZADA")
    print("=" * 60)

    try:
        # Teste 1: Compatibilidade com teste existente
        sol1 = test_set_covering_reports_workpieces_and_pricing_meta()

        # Teste 2: Performance com instância maior
        sol2 = test_large_instance()

        print("\n" + "="*60)
        print("✓ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!")
        print("="*60)

    except Exception as e:
        print(f"\n✗ ERRO DURANTE OS TESTES: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)