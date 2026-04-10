#!/usr/bin/env python3
"""
DEBUG: Perfis de memória por fase do algoritmo CSP.
Identifica onde está o verdadeiro gargalo de memória.
"""
import os
import sys
import time
import tracemalloc
import psutil
import gc
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip, VehicleType


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


def create_instance_with_varying_gaps(n_blocks=100):
    """Cria instância com gaps variados para testar diferentes fases."""
    blocks = []
    start = 360  # 06:00

    print(f"Criando {n_blocks} blocos com gaps variados...")

    for i in range(n_blocks):
        # Cada bloco com 1-3 trips
        n_trips = 1 + (i % 3)
        trips = []

        block_start = start
        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 + (j * 15)  # 30, 45, 60 minutos
            t = Trip(
                id=trip_id,
                line_id=1,
                start_time=block_start,
                end_time=block_start + trip_dur,
                origin_id=1,
                destination_id=2,
                duration=trip_dur,
                distance_km=10.0,
            )
            trips.append(t)
            if j < n_trips - 1:
                block_start += trip_dur + 5  # 5 min entre trips no mesmo bloco

        block_id = i + 1
        block = Block(
            id=block_id,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)

        # Gap variado: 20% pequenos (5-60 min), 30% médios (60-240 min), 50% grandes (>240 min)
        if i % 10 < 2:
            gap = 5 + (i % 56)  # 5-60 min (pequeno)
        elif i % 10 < 5:
            gap = 60 + (i % 180)  # 60-240 min (médio)
        else:
            gap = 240 + (i % 320)  # 240-560 min (grande)

        start = block_start + gap

    print(f"Criados {len(blocks)} blocos")
    print(f"Total trips: {sum(len(b.trips) for b in blocks)}")
    return blocks


def profile_algorithm_phases(algorithm_class, label, blocks):
    """Profila memória por fase do algoritmo."""
    print(f"\n{'='*80}")
    print(f"PROFILING DE MEMÓRIA: {label}")
    print(f"{'='*80}")

    # Fase 1: Inicialização
    print("\n[FASE 1] Inicialização do CSP...")
    gc.collect()
    tracemalloc.start()
    mem_before_init = psutil.Process().memory_info().rss / 1024 / 1024

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

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    mem_after_init = psutil.Process().memory_info().rss / 1024 / 1024
    print(f"  Memória RSS: {mem_before_init:.1f} → {mem_after_init:.1f} MB")
    print(f"  Memória tracemalloc: {peak / 1024 / 1024:.1f} MB")

    # Fase 2: Construção do grafo de vizinhança
    print("\n[FASE 2] Construção do grafo de vizinhança...")
    gc.collect()
    tracemalloc.start()
    mem_before_neighbors = psutil.Process().memory_info().rss / 1024 / 1024

    # Chamar método de construção do grafo (dependendo da classe)
    if algorithm_class == SetPartitioningCSP:
        # Para original, precisamos inspecionar internamente
        print("  (Método _task_neighbors será chamado durante solve)")
    else:
        # Para otimizado, podemos chamar o método diretamente
        if hasattr(csp, '_task_neighbors_optimized'):
            neighbors = csp._task_neighbors_optimized(blocks)
            print(f"  Número de arestas no grafo: {sum(len(v) for v in neighbors.values())}")

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    mem_after_neighbors = psutil.Process().memory_info().rss / 1024 / 1024
    print(f"  Memória RSS: {mem_before_neighbors:.1f} → {mem_after_neighbors:.1f} MB")
    print(f"  Delta: {mem_after_neighbors - mem_before_neighbors:.1f} MB")
    print(f"  Memória tracemalloc: {peak / 1024 / 1024:.1f} MB")

    # Fase 3: Geração de colunas
    print("\n[FASE 3] Geração de colunas...")
    gc.collect()
    tracemalloc.start()
    mem_before_columns = psutil.Process().memory_info().rss / 1024 / 1024

    if algorithm_class == SetPartitioningCSP:
        # Para original
        columns = csp._generate_columns(blocks)
    else:
        # Para otimizado
        if hasattr(csp, '_generate_columns_smart'):
            columns = list(csp._generate_columns_smart(blocks))
        else:
            columns = csp._generate_columns(blocks)

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    mem_after_columns = psutil.Process().memory_info().rss / 1024 / 1024
    print(f"  Memória RSS: {mem_before_columns:.1f} → {mem_after_columns:.1f} MB")
    print(f"  Delta: {mem_after_columns - mem_before_columns:.1f} MB")
    print(f"  Memória tracemalloc: {peak / 1024 / 1024:.1f} MB")
    print(f"  Número de colunas geradas: {len(columns)}")

    # Fase 4: Resolução ILP
    print("\n[FASE 4] Resolução ILP (pulp)...")
    gc.collect()
    tracemalloc.start()
    mem_before_ilp = psutil.Process().memory_info().rss / 1024 / 1024

    # Não vamos realmente resolver o ILP aqui (complexo), mas podemos medir
    # a memória da criação do modelo
    if hasattr(csp, '_create_ilp_model'):
        try:
            model, x_vars = csp._create_ilp_model(columns, blocks)
            print(f"  Modelo criado: {len(x_vars)} variáveis")
        except Exception as e:
            print(f"  Erro ao criar modelo: {e}")

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    mem_after_ilp = psutil.Process().memory_info().rss / 1024 / 1024
    print(f"  Memória RSS: {mem_before_ilp:.1f} → {mem_after_ilp:.1f} MB")
    print(f"  Delta: {mem_after_ilp - mem_before_ilp:.1f} MB")
    print(f"  Memória tracemalloc: {peak / 1024 / 1024:.1f} MB")

    # Fase 5: Solve completo
    print("\n[FASE 5] Solve completo...")
    gc.collect()
    tracemalloc.start()
    mem_before_solve = psutil.Process().memory_info().rss / 1024 / 1024

    try:
        solution = csp.solve(blocks)
        print(f"  Solve completo: {len(solution.duties)} duties gerados")
    except Exception as e:
        print(f"  Erro no solve completo: {e}")

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    mem_after_solve = psutil.Process().memory_info().rss / 1024 / 1024
    print(f"  Memória RSS: {mem_before_solve:.1f} → {mem_after_solve:.1f} MB")
    print(f"  Delta: {mem_after_solve - mem_before_solve:.1f} MB")
    print(f"  Memória tracemalloc: {peak / 1024 / 1024:.1f} MB")

    return {
        "init_mb": mem_after_init - mem_before_init,
        "neighbors_mb": mem_after_neighbors - mem_before_neighbors,
        "columns_mb": mem_after_columns - mem_before_columns,
        "ilp_mb": mem_after_ilp - mem_before_ilp,
        "solve_mb": mem_after_solve - mem_before_solve,
        "total_mb": mem_after_solve - mem_before_init,
    }


def main():
    """Executa profiling detalhado."""
    print("DEBUG PROFILING DE MEMÓRIA POR FASE")
    print("="*80)
    print("OBJETIVO: Identificar gargalos reais de memória")
    print("="*80)

    # Criar instância realista
    blocks = create_instance_with_varying_gaps(80)

    # Profilar algoritmo original
    print("\n" + "="*80)
    print("PROFILING ALGORITMO ORIGINAL")
    print("="*80)

    orig_profile = profile_algorithm_phases(SetPartitioningCSP, "Original", blocks)

    # Profilar algoritmo otimizado
    print("\n" + "="*80)
    print("PROFILING ALGORITMO OTIMIZADO")
    print("="*80)

    opt_profile = profile_algorithm_phases(SetPartitioningOptimizedCSP, "Otimizado", blocks)

    # Análise comparativa
    print("\n" + "="*80)
    print("ANÁLISE COMPARATIVA DETALHADA")
    print("="*80)

    print("\nConsumo de memória por fase (MB):")
    print(f"{'Fase':<20} {'Original':>10} {'Otimizado':>10} {'Diferença':>10} {'% Redução':>10}")
    print("-" * 70)

    phases = ["init_mb", "neighbors_mb", "columns_mb", "ilp_mb", "solve_mb"]
    phase_labels = {
        "init_mb": "Inicialização",
        "neighbors_mb": "Grafo vizinhança",
        "columns_mb": "Geração colunas",
        "ilp_mb": "Criação ILP",
        "solve_mb": "Solve completo"
    }

    for phase in phases:
        orig = orig_profile.get(phase, 0)
        opt = opt_profile.get(phase, 0)
        diff = orig - opt
        pct = (diff / orig * 100) if orig != 0 else 0
        print(f"{phase_labels.get(phase, phase):<20} {orig:>10.1f} {opt:>10.1f} {diff:>10.1f} {pct:>9.1f}%")

    print("-" * 70)
    orig_total = orig_profile.get("total_mb", 0)
    opt_total = opt_profile.get("total_mb", 0)
    total_diff = orig_total - opt_total
    total_pct = (total_diff / orig_total * 100) if orig_total != 0 else 0
    print(f"{'TOTAL':<20} {orig_total:>10.1f} {opt_total:>10.1f} {total_diff:>10.1f} {total_pct:>9.1f}%")

    # Identificar gargalos principais
    print("\n" + "="*80)
    print("IDENTIFICAÇÃO DE GARGALOS PRINCIPAIS")
    print("="*80)

    # Fase que mais consome memória no original
    max_phase = max(phases, key=lambda p: orig_profile.get(p, 0))
    max_value = orig_profile.get(max_phase, 0)
    print(f"Maior consumo no original: {phase_labels.get(max_phase, max_phase)} = {max_value:.1f} MB")

    # Fase com maior redução
    reductions = []
    for phase in phases:
        orig = orig_profile.get(phase, 0)
        opt = opt_profile.get(phase, 0)
        if orig > 0:
            pct = (orig - opt) / orig * 100
            reductions.append((phase, pct))

    if reductions:
        best_reduction = max(reductions, key=lambda x: x[1])
        worst_reduction = min(reductions, key=lambda x: x[1])
        print(f"Melhor redução: {phase_labels.get(best_reduction[0], best_reduction[0])} = {best_reduction[1]:.1f}%")
        print(f"Pior redução: {phase_labels.get(worst_reduction[0], worst_reduction[0])} = {worst_reduction[1]:.1f}%")

    print("\n" + "="*80)
    print("RECOMENDAÇÕES")
    print("="*80)

    if max_phase == "columns_mb":
        print("GARGALO PRINCIPAL: Geração de colunas")
        print("  - Implementar geração lazy de colunas")
        print("  - Limitar número máximo de colunas geradas")
        print("  - Aplicar poda mais agressiva no DFS")
    elif max_phase == "ilp_mb":
        print("GARGALO PRINCIPAL: Resolução ILP")
        print("  - Reduzir número de colunas/variáveis")
        print("  - Usar solver mais eficiente (pulp → ortools)")
        print("  - Aplicar pre-solve e cortes")
    elif max_phase == "neighbors_mb":
        print("GARGALO PRINCIPAL: Grafo de vizinhança")
        print("  - Otimizar estrutura de dados (lista vs dicionário)")
        print("  - Aplicar poda early mais eficiente")
        print("  - Usar matriz esparsa de compatibilidade")
    else:
        print(f"Gargalo identificado em: {phase_labels.get(max_phase, max_phase)}")
        print("Investigar estrutura de dados específica desta fase")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Profiling interrompido pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERRO GERAL: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)