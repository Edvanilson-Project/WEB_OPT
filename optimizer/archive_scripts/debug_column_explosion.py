#!/usr/bin/env python3
"""
DEBUG: Por que algoritmo otimizado gera 1004 colunas vs 80 do original?
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip


def create_simple_instance():
    """Cria instância simples para debug."""
    blocks = []
    start = 360  # 06:00

    # Criar 10 blocos com gaps pequenos
    for i in range(10):
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


def debug_column_generation():
    """Compara geração de colunas entre original e otimizado."""
    blocks = create_simple_instance()

    # Original com operator_change_terminals_only=False
    print("\n" + "="*80)
    print("ORIGINAL (operator_change_terminals_only=False)")
    print("="*80)

    csp_orig = SetPartitioningCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
        },
        operator_change_terminals_only=False
    )

    print(f"  Parâmetros:")
    print(f"    max_candidate_successors: {csp_orig.max_candidate_successors}")
    print(f"    max_columns: {csp_orig.max_columns}")
    print(f"    max_trips_per_piece: {csp_orig.max_trips_per_piece}")
    print(f"    operator_change_terminals_only: {csp_orig.greedy.operator_change_terminals_only}")

    neighbors_orig = csp_orig._task_neighbors(blocks)
    edges_orig = sum(len(v) for v in neighbors_orig.values())
    print(f"  Arestas: {edges_orig}")

    # Mostrar estrutura do grafo
    print(f"  Grafo (top 5):")
    for i, (task_id, succs) in enumerate(list(neighbors_orig.items())[:5]):
        print(f"    Bloco {task_id} → {[s.id for s in succs]}")

    columns_orig = csp_orig._generate_columns(blocks)
    print(f"  Colunas: {len(columns_orig)}")

    # Analisar tamanhos das colunas
    size_counts = {}
    for combo, _ in columns_orig:
        size = len(combo)
        size_counts[size] = size_counts.get(size, 0) + 1

    print(f"  Distribuição de tamanhos: {dict(sorted(size_counts.items()))}")

    # Otimizado
    print("\n" + "="*80)
    print("OTIMIZADO (operator_change_terminals_only=False)")
    print("="*80)

    csp_opt = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
            "use_optimized_set_partitioning": True,
        },
        operator_change_terminals_only=False
    )

    # Aplicar parâmetros adaptativos
    csp_opt._adaptive_parameters(len(blocks))

    print(f"  Parâmetros:")
    print(f"    max_candidate_successors: {csp_opt.max_candidate_successors}")
    print(f"    max_columns: {csp_opt.max_columns}")
    print(f"    max_trips_per_piece: {csp_opt.max_trips_per_piece}")
    print(f"    operator_change_terminals_only: {csp_opt.greedy.operator_change_terminals_only}")

    neighbors_opt = csp_opt._task_neighbors_optimized(blocks)
    edges_opt = sum(len(v) for v in neighbors_opt.values())
    print(f"  Arestas: {edges_opt}")

    # Mostrar estrutura do grafo
    print(f"  Grafo (top 5):")
    for i, (task_id, succs) in enumerate(list(neighbors_opt.items())[:5]):
        print(f"    Bloco {task_id} → {[s.id for s in succs]}")

    columns_opt = csp_opt._generate_columns_smart(blocks)
    print(f"  Colunas: {len(columns_opt)}")

    # Analisar tamanhos das colunas
    size_counts_opt = {}
    for combo, _ in columns_opt:
        size = len(combo)
        size_counts_opt[size] = size_counts_opt.get(size, 0) + 1

    print(f"  Distribuição de tamanhos: {dict(sorted(size_counts_opt.items()))}")

    # Comparar contadores de performance
    print(f"\n  Contadores otimizado:")
    print(f"    _fast_checks: {csp_opt._fast_checks}")
    print(f"    _full_checks: {csp_opt._full_checks}")
    print(f"    _combinations_pruned: {csp_opt._combinations_pruned}")
    print(f"    _cache_hits: {csp_opt._cache_hits}")

    # Verificar se as mesmas combinações são geradas
    print("\n" + "="*80)
    print("ANÁLISE DE SOBREPOSIÇÃO DE COLUNAS")
    print("="*80)

    # Extrair assinaturas das colunas
    orig_sigs = {tuple(b.id for b in combo) for combo, _ in columns_orig}
    opt_sigs = {tuple(b.id for b in combo) for combo, _ in columns_opt}

    print(f"  Colunas originais únicas: {len(orig_sigs)}")
    print(f"  Colunas otimizadas únicas: {len(opt_sigs)}")

    # Interseção
    intersection = orig_sigs.intersection(opt_sigs)
    print(f"  Interseção (presentes em ambos): {len(intersection)}")

    # Apenas no original
    only_orig = orig_sigs - opt_sigs
    print(f"  Apenas no original: {len(only_orig)}")

    # Apenas no otimizado
    only_opt = opt_sigs - orig_sigs
    print(f"  Apenas no otimizado: {len(only_opt)}")

    # Analisar algumas colunas apenas no otimizado
    print(f"\n  Exemplos de colunas apenas no otimizado (primeiras 3):")
    for i, sig in enumerate(list(only_opt)[:3]):
        print(f"    {sig}")


if __name__ == "__main__":
    try:
        debug_column_generation()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)