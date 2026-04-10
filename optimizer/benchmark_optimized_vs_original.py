#!/usr/bin/env python3
"""
Benchmark comparativo: SetPartitioningCSP vs SetPartitioningOptimizedCSP
"""
import os
import sys
import time
import tracemalloc
import numpy as np
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


def create_test_scenario(n_trips, gap_pattern="mixed"):
    """Cria cenário de teste com diferentes padrões de gaps."""
    trips = []
    start = 360  # 06:00

    for i in range(n_trips):
        t = _trip(i+1, start, 60)
        trips.append(t)

        if gap_pattern == "small":
            start += 120  # 2h entre trips
        elif gap_pattern == "large":
            start += 800 if i % 2 == 0 else 100  # Alterna gaps grandes e normais
        elif gap_pattern == "mixed":
            if i % 4 == 0:
                start += 800  # Gap muito grande
            elif i % 4 == 1:
                start += 300  # Gap médio
            else:
                start += 90   # Gap pequeno

    # Criar vehicle types
    vehicle_types = [VehicleType(id=1, name="Bus", passenger_capacity=40, cost_per_km=2.0, cost_per_hour=50.0, fixed_cost=800.0)]

    # Executar VSP
    vsp = GreedyVSP().solve(trips, vehicle_types)
    return vsp.blocks


def benchmark_one_instance(blocks, algorithm_class, label):
    """Executa benchmark para uma instância."""
    print(f"\n{'='*60}")
    print(f"BENCHMARK: {label}")
    print(f"  Blocos: {len(blocks)}")
    print(f"  Trips total: {sum(len(b.trips) for b in blocks)}")

    # Iniciar tracking de memória
    tracemalloc.start()

    # Executar algoritmo
    start_time = time.time()

    if algorithm_class == SetPartitioningCSP:
        csp = SetPartitioningCSP(vsp_params={"pricing_enabled": True})
    else:
        csp = SetPartitioningOptimizedCSP(vsp_params={"pricing_enabled": True})

    solution = csp.solve(blocks)

    elapsed = time.time() - start_time

    # Coletar métricas de memória
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    # Coletar métricas de performance
    metrics = {}
    if hasattr(solution, 'meta'):
        metrics = solution.meta
        if "performance_metrics" in solution.meta:
            metrics = {**metrics, **solution.meta["performance_metrics"]}

    # Resultados
    print(f"\n  RESULTADOS:")
    print(f"  Tempo: {elapsed:.2f}s")
    print(f"  Memória atual: {current / 1024:.1f} KB")
    print(f"  Memória pico: {peak / 1024 / 1024:.2f} MB")
    print(f"  Duties: {len(solution.duties)}")
    print(f"  Workpieces: {metrics.get('workpieces_generated', 'N/A')}")

    if "fast_checks" in metrics:
        print(f"  Fast checks: {metrics.get('fast_checks', 'N/A')}")
        print(f"  Combinations pruned: {metrics.get('combinations_pruned', 'N/A')}")
        print(f"  Pruning reduction: {metrics.get('pruning_reduction_pct', 'N/A')}%")

    return {
        "time": elapsed,
        "memory_peak_mb": peak / 1024 / 1024,
        "duties": len(solution.duties),
        "workpieces": metrics.get('workpieces_generated', 0),
        "pruning_pct": metrics.get('pruning_reduction_pct', 0),
        "fast_checks": metrics.get('fast_checks', 0),
    }


def run_benchmark_suite():
    """Executa suite completa de benchmarks."""
    print("BENCHMARK COMPARATIVO: CSP Original vs Otimizado")
    print("="*80)

    results = []

    # Cenário 1: Pequeno (10 trips, gaps pequenos)
    print("\nCENÁRIO 1: Pequeno (10 trips, gaps pequenos)")
    blocks = create_test_scenario(10, "small")

    orig_result = benchmark_one_instance(blocks, SetPartitioningCSP, "Original")
    opt_result = benchmark_one_instance(blocks, SetPartitioningOptimizedCSP, "Otimizado")

    improvement = {
        "time_improvement": (orig_result["time"] - opt_result["time"]) / orig_result["time"] * 100 if orig_result["time"] > 0 else 0,
        "memory_improvement": (orig_result["memory_peak_mb"] - opt_result["memory_peak_mb"]) / orig_result["memory_peak_mb"] * 100 if orig_result["memory_peak_mb"] > 0 else 0,
    }

    results.append(("small_10", improvement))

    # Cenário 2: Médio (30 trips, gaps mistos)
    print("\nCENÁRIO 2: Médio (30 trips, gaps mistos)")
    blocks = create_test_scenario(30, "mixed")

    orig_result = benchmark_one_instance(blocks, SetPartitioningCSP, "Original")
    opt_result = benchmark_one_instance(blocks, SetPartitioningOptimizedCSP, "Otimizado")

    improvement = {
        "time_improvement": (orig_result["time"] - opt_result["time"]) / orig_result["time"] * 100 if orig_result["time"] > 0 else 0,
        "memory_improvement": (orig_result["memory_peak_mb"] - opt_result["memory_peak_mb"]) / orig_result["memory_peak_mb"] * 100 if orig_result["memory_peak_mb"] > 0 else 0,
    }

    results.append(("medium_30", improvement))

    # Cenário 3: Grande (50 trips, gaps grandes)
    print("\nCENÁRIO 3: Grande (50 trips, gaps grandes)")
    blocks = create_test_scenario(50, "large")

    orig_result = benchmark_one_instance(blocks, SetPartitioningCSP, "Original")
    opt_result = benchmark_one_instance(blocks, SetPartitioningOptimizedCSP, "Otimizado")

    improvement = {
        "time_improvement": (orig_result["time"] - opt_result["time"]) / orig_result["time"] * 100 if orig_result["time"] > 0 else 0,
        "memory_improvement": (orig_result["memory_peak_mb"] - opt_result["memory_peak_mb"]) / orig_result["memory_peak_mb"] * 100 if orig_result["memory_peak_mb"] > 0 else 0,
    }

    results.append(("large_50", improvement))

    # Resumo
    print("\n" + "="*80)
    print("RESUMO DOS BENCHMARKS")
    print("="*80)

    for scenario, improv in results:
        print(f"\n{scenario}:")
        print(f"  Melhoria de tempo: {improv['time_improvement']:+.1f}%")
        print(f"  Melhoria de memória: {improv['memory_improvement']:+.1f}%")

    # Verificar se atingimos metas
    print("\n" + "="*80)
    print("VERIFICAÇÃO DE METAS")
    print("="*80)

    memory_improvements = [r[1]["memory_improvement"] for r in results]
    avg_memory_improvement = np.mean(memory_improvements) if memory_improvements else 0

    if avg_memory_improvement >= 70:
        print(f"✓ REDUÇÃO DE MEMÓRIA ATINGIDA: {avg_memory_improvement:.1f}% (meta: 70-90%)")
    else:
        print(f"⚠ Redução de memória: {avg_memory_improvement:.1f}% (abaixo da meta de 70%)")

    time_improvements = [r[1]["time_improvement"] for r in results]
    avg_time_improvement = np.mean(time_improvements) if time_improvements else 0

    if avg_time_improvement > 0:
        print(f"✓ MELHORIA DE TEMPO: {avg_time_improvement:+.1f}%")
    else:
        print(f"⚠ Melhoria de tempo: {avg_time_improvement:+.1f}%")

    print("\n✓ BENCHMARK COMPLETADO")


if __name__ == "__main__":
    try:
        run_benchmark_suite()
    except Exception as e:
        print(f"\n✗ ERRO NO BENCHMARK: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)