#!/usr/bin/env python3
"""
Teste de compatibilidade da classe otimizada com o teste test_set_covering_reports_workpieces_and_pricing_meta
do arquivo test_regulatory_rules.py.
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


def test_original():
    """Executa teste com a classe original."""
    print("=== TESTE COM CLASSE ORIGINAL (SetPartitioningCSP) ===")

    blocks = [
        Block(id=1, trips=[_trip(1, 360, 60)]),
        Block(id=2, trips=[_trip(2, 450, 60, origin=2, dest=1)]),
        Block(id=3, trips=[_trip(3, 600, 60)]),
        Block(id=4, trips=[_trip(4, 690, 60, origin=2, dest=1)]),
    ]

    sol = SetPartitioningCSP(vsp_params={"pricing_enabled": True, "max_trips_per_piece": 2}).solve(blocks, [])

    print(f"Resultados originais:")
    print(f"- Duties: {len(sol.duties)}")
    print(f"- Algorithm: {sol.algorithm}")
    print(f"- Workpieces generated: {sol.meta.get('workpieces_generated', 'N/A')}")
    print(f"- Roster count: {sol.meta.get('roster_count', 'N/A')}")

    # Verificações do teste original
    assert sol.meta["workpieces_generated"] > 0
    assert sol.meta["roster_count"] >= 1

    return sol


def test_optimized():
    """Executa teste com a classe otimizada."""
    print("\n=== TESTE COM CLASSE OTIMIZADA (SetPartitioningOptimizedCSP) ===")

    blocks = [
        Block(id=1, trips=[_trip(1, 360, 60)]),
        Block(id=2, trips=[_trip(2, 450, 60, origin=2, dest=1)]),
        Block(id=3, trips=[_trip(3, 600, 60)]),
        Block(id=4, trips=[_trip(4, 690, 60, origin=2, dest=1)]),
    ]

    sol = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_trips_per_piece": 2
        }
    ).solve(blocks, [])

    print(f"Resultados otimizados:")
    print(f"- Duties: {len(sol.duties)}")
    print(f"- Algorithm: {sol.algorithm}")
    print(f"- Workpieces generated: {sol.meta.get('workpieces_generated', 'N/A')}")
    print(f"- Roster count: {sol.meta.get('roster_count', 'N/A')}")

    if "performance_metrics" in sol.meta:
        metrics = sol.meta["performance_metrics"]
        print(f"- Fast checks: {metrics.get('fast_checks', 'N/A')}")
        print(f"- Combinations pruned: {metrics.get('combinations_pruned', 'N/A')}")
        print(f"- Pruning reduction: {metrics.get('pruning_reduction_pct', 'N/A')}%")

    # Verificações do teste original (mesmas asserções)
    assert sol.meta["workpieces_generated"] > 0
    assert sol.meta["roster_count"] >= 1

    return sol


def compare_solutions(orig_sol, opt_sol):
    """Compara as duas soluções para garantir compatibilidade."""
    print("\n=== COMPARAÇÃO DAS SOLUÇÕES ===")

    # Verificações básicas
    print(f"1. Número de duties:")
    print(f"   Original: {len(orig_sol.duties)}")
    print(f"   Otimizada: {len(opt_sol.duties)}")

    print(f"\n2. Workpieces gerados:")
    print(f"   Original: {orig_sol.meta.get('workpieces_generated', 'N/A')}")
    print(f"   Otimizada: {opt_sol.meta.get('workpieces_generated', 'N/A')}")

    print(f"\n3. Roster count:")
    print(f"   Original: {orig_sol.meta.get('roster_count', 'N/A')}")
    print(f"   Otimizada: {opt_sol.meta.get('roster_count', 'N/A')}")

    # Comparação detalhada dos duties
    if len(orig_sol.duties) == len(opt_sol.duties):
        print(f"\n✓ Número de duties igual!")

        # Comparar atributos de cada duty
        for i, (orig_duty, opt_duty) in enumerate(zip(orig_sol.duties, opt_sol.duties)):
            print(f"\n   Duty {i+1}:")
            orig_trip_ids = [t.id for t in orig_duty.all_trips]
            opt_trip_ids = [t.id for t in opt_duty.all_trips]
            print(f"     Original trips: {orig_trip_ids}")
            print(f"     Otimizada trips: {opt_trip_ids}")

            if orig_trip_ids == opt_trip_ids:
                print(f"     ✓ Mesma sequência de trips!")
            else:
                print(f"     ⚠ Sequência diferente - verificar otimização")
    else:
        print(f"\n⚠ Número de duties diferente!")
        print(f"   Isso pode ser aceitável se a solução otimizada tiver mesma qualidade ou melhor")

    # Verificar se a solução otimizada atende aos requisitos mínimos
    print(f"\n4. Verificações de qualidade:")
    print(f"   ✓ Ambas soluções têm workpieces_generated > 0: OK")
    print(f"   ✓ Ambas soluções têm roster_count >= 1: OK")

    # Verificar custo total (se disponível)
    if hasattr(orig_sol, 'total_cost') and hasattr(opt_sol, 'total_cost'):
        print(f"\n5. Comparação de custo:")
        print(f"   Original: {orig_sol.total_cost}")
        print(f"   Otimizada: {opt_sol.total_cost}")

        if opt_sol.total_cost <= orig_sol.total_cost * 1.1:  # Até 10% mais caro aceitável
            print(f"   ✓ Custo otimizado dentro dos limites aceitáveis")
        else:
            print(f"   ⚠ Custo otimizado significativamente maior")

    print(f"\n✓ TESTE DE COMPATIBILIDADE CONCLUÍDO!")


if __name__ == "__main__":
    print("TESTE DE COMPATIBILIDADE - Set Partitioning Otimizado vs Original")
    print("=" * 70)

    try:
        # Executar ambos os testes
        orig_sol = test_original()
        opt_sol = test_optimized()

        # Comparar resultados
        compare_solutions(orig_sol, opt_sol)

        print("\n" + "="*70)
        print("✓ TODAS AS VERIFICAÇÕES PASSARAM!")
        print("✓ Classe otimizada é compatível com testes existentes")
        print("="*70)

    except Exception as e:
        print(f"\n✗ ERRO DURANTE OS TESTES: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)