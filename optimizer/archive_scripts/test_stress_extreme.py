#!/usr/bin/env python3
"""
Teste de estresse EXTREMO para validar redução de OOM em instâncias muito grandes.
"""
import os
import sys
import time
import tracemalloc
import psutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip, VehicleType
from src.algorithms.vsp.greedy import GreedyVSP


def _trip(tid, start, dur, origin=1, dest=2):
    return Trip(
        id=tid,
        line_id=1,
        start_time=start,
        end_time=start + dur,
        origin_id=origin,
        destination_id=dest,
        duration=dur,
        distance_km=max(1.0, dur / 3),
    )


def create_extreme_instance(n_trips=500, min_gap=5, max_gap=120):
    """Cria instância EXTREMA com muitos blocos pequenos."""
    trips = []
    start = 360  # 06:00

    for i in range(n_trips):
        # Gaps pequenos para criar MUITOS blocos pequenos (1-2 trips cada)
        gap = min_gap + (i % max_gap)
        start += gap

        t = _trip(i+1, start, 60)  # Trip de 60 minutos
        trips.append(t)
        start += 60  # Duração da trip

    vehicle_types = [VehicleType(id=1, name="Bus", passenger_capacity=40, cost_per_km=2.0, cost_per_hour=50.0, fixed_cost=800.0)]

    print(f"Criando VSP para {len(trips)} trips com gaps pequenos...")
    vsp = GreedyVSP().solve(trips, vehicle_types)
    print(f"VSP gerou {len(vsp.blocks)} blocos")
    print(f"Trips por bloco (média): {len(trips) / max(1, len(vsp.blocks)):.1f}")

    return vsp.blocks


def create_many_small_blocks_direct(n_blocks=200):
    """Cria muitos blocos pequenos diretamente (bypass VSP)."""
    blocks = []
    start = 360

    for i in range(n_blocks):
        # Cada bloco com 1-2 trips
        n_trips_in_block = 1 if i % 3 == 0 else 2
        trips = []

        for j in range(n_trips_in_block):
            trip_id = i * 10 + j + 1
            t = Trip(
                id=trip_id,
                line_id=1,
                start_time=start,
                end_time=start + 60,
                origin_id=1,
                destination_id=2,
                duration=60,
                distance_km=20.0,
            )
            trips.append(t)
            if j == 0:  # Primeira trip
                start += 60
            else:  # Segunda trip (se houver)
                start += 120  # Gap entre trips no mesmo bloco

        block_id = i + 1
        block = Block(
            id=block_id,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)

        # Gap entre blocos
        start += 300  # 5 horas entre blocos

    print(f"Criados {len(blocks)} blocos diretamente")
    print(f"Total trips: {sum(len(b.trips) for b in blocks)}")
    return blocks


def test_memory_stress(algorithm_class, label, blocks):
    """Testa estresse de memória para um algoritmo."""
    print(f"\n{'='*60}")
    print(f"TESTE DE ESTRESSE EXTREMO: {label}")
    print(f"  Blocos: {len(blocks)}")
    print(f"  Trips total: {sum(len(b.trips) for b in blocks)}")

    # Medir memória antes
    process = psutil.Process()
    mem_before = process.memory_info().rss / 1024 / 1024  # MB

    # Iniciar tracking detalhado
    tracemalloc.start()

    start_time = time.time()

    try:
        if algorithm_class == SetPartitioningCSP:
            csp = SetPartitioningCSP(vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 10000,
                "max_candidate_successors_per_task": 6,
            })
        else:
            csp = SetPartitioningOptimizedCSP(vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 10000,
                "max_candidate_successors_per_task": 6,
                "use_optimized_set_partitioning": True,
            })

        solution = csp.solve(blocks)
        elapsed = time.time() - start_time

        # Coletar métricas de memória
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        mem_after = process.memory_info().rss / 1024 / 1024  # MB
        mem_used = mem_after - mem_before

        # Coletar métricas de performance
        metrics = {}
        if hasattr(solution, 'meta'):
            metrics = solution.meta
            if "performance_metrics" in solution.meta:
                metrics = {**metrics, **solution.meta["performance_metrics"]}

        print(f"\n  RESULTADOS:")
        print(f"  Tempo: {elapsed:.2f}s")
        print(f"  Memória RSS (antes→depois): {mem_before:.1f} → {mem_after:.1f} MB")
        print(f"  Memória usada (RSS): {mem_used:.1f} MB")
        print(f"  Memória pico (tracemalloc): {peak / 1024 / 1024:.1f} MB")
        print(f"  Duties: {len(solution.duties)}")
        print(f"  Workpieces: {metrics.get('workpieces_generated', 'N/A')}")

        if "fast_checks" in metrics:
            print(f"  Fast checks: {metrics.get('fast_checks', 'N/A')}")
            print(f"  Combinations pruned: {metrics.get('combinations_pruned', 'N/A')}")
            print(f"  Pruning reduction: {metrics.get('pruning_reduction_pct', 'N/A')}%")

        return {
            "success": True,
            "time": elapsed,
            "memory_rss_mb": mem_used,
            "memory_peak_mb": peak / 1024 / 1024,
            "pruning_pct": metrics.get('pruning_reduction_pct', 0),
            "duties": len(solution.duties),
        }

    except MemoryError as e:
        tracemalloc.stop()
        print(f"\n  ✗ MEMORY ERROR (OOM): {e}")
        return {"success": False, "error": "OOM"}
    except Exception as e:
        tracemalloc.stop()
        print(f"\n  ✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def main():
    """Executa teste de estresse EXTREMO."""
    print("TESTE DE ESTRESSE EXTREMO DE MEMÓRIA - Nível Optibus")
    print("="*80)

    # Cenário 1: VSP com gaps pequenos (gerando ~100 blocos)
    print("\nCENÁRIO 1: VSP com 300 trips, gaps pequenos")
    print("-"*80)
    blocks1 = create_extreme_instance(300, min_gap=5, max_gap=60)

    if len(blocks1) < 80:
        print(f"⚠ Apenas {len(blocks1)} blocos gerados - testando cenário mais extremo")
        print("\nCENÁRIO 2: Blocos criados diretamente (200 blocos)")
        print("-"*80)
        blocks = create_many_small_blocks_direct(200)
    else:
        blocks = blocks1

    # Testar algoritmo original (pode falhar com OOM)
    print("\n" + "="*80)
    print("TESTANDO ALGORITMO ORIGINAL (SetPartitioningCSP)")
    print("="*80)

    orig_result = test_memory_stress(SetPartitioningCSP, "Original", blocks)

    # Testar algoritmo otimizado
    print("\n" + "="*80)
    print("TESTANDO ALGORITMO OTIMIZADO (SetPartitioningOptimizedCSP)")
    print("="*80)

    opt_result = test_memory_stress(SetPartitioningOptimizedCSP, "Otimizado", blocks)

    # Análise comparativa
    print("\n" + "="*80)
    print("ANÁLISE COMPARATIVA")
    print("="*80)

    if orig_result["success"] and opt_result["success"]:
        print("✓ Ambos algoritmos completaram sem OOM")

        # Comparar memória
        if "memory_peak_mb" in orig_result and "memory_peak_mb" in opt_result:
            mem_reduction = (orig_result["memory_peak_mb"] - opt_result["memory_peak_mb"]) / orig_result["memory_peak_mb"] * 100
            print(f"\nREDUÇÃO DE MEMÓRIA:")
            print(f"  Original: {orig_result['memory_peak_mb']:.1f} MB")
            print(f"  Otimizado: {opt_result['memory_peak_mb']:.1f} MB")
            print(f"  Redução: {mem_reduction:.1f}%")

            if mem_reduction >= 70:
                print(f"  ✓ REDUÇÃO DE 70-90% ATINGIDA (meta alcançada!)")
            else:
                print(f"  ⚠ Redução abaixo da meta de 70%")

        # Comparar tempo
        if "time" in orig_result and "time" in opt_result:
            time_reduction = (orig_result["time"] - opt_result["time"]) / orig_result["time"] * 100
            print(f"\nREDUÇÃO DE TEMPO:")
            print(f"  Original: {orig_result['time']:.2f}s")
            print(f"  Otimizado: {opt_result['time']:.2f}s")
            print(f"  Redução: {time_reduction:+.1f}%")

        # Comparar poda
        if "pruning_pct" in opt_result:
            pruning = opt_result["pruning_pct"]
            print(f"\nEFICIÊNCIA DA PODA:")
            print(f"  Redução de combinações: {pruning:.1f}%")
            if pruning >= 70:
                print(f"  ✓ PODA EFETIVA (acima de 70%)")
            else:
                print(f"  ⚠ Poda abaixo do esperado")

    elif not orig_result["success"] and opt_result["success"]:
        print("✓ OTIMIZAÇÃO BEM-SUCEDIDA:")
        print(f"  Original: Falhou com {orig_result.get('error', 'erro desconhecido')}")
        print(f"  Otimizado: Completou com sucesso")
        print(f"  ✓ Eliminou problema de OOM!")

    elif not opt_result["success"]:
        print("✗ ALERTA: Algoritmo otimizado também falhou:")
        print(f"  Erro: {opt_result.get('error', 'desconhecido')}")

    print("\n" + "="*80)
    print("TESTE DE ESTRESSE EXTREMO CONCLUÍDO")
    print("="*80)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Teste interrompido pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERRO GERAL: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)