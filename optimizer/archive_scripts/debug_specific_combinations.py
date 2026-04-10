#!/usr/bin/env python3
"""
DEBUG: Comparação detalhada das combinações específicas geradas.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip


def create_small_instance():
    """Cria instância pequena para análise detalhada."""
    blocks = []
    start = 360  # 06:00

    # Criar apenas 5 blocos com gaps pequenos
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


def analyze_combinations():
    """Analisa combinações específicas geradas."""
    blocks = create_small_instance()

    print("="*80)
    print("ANÁLISE DETALHADA DE COMBINAÇÕES")
    print("="*80)

    # Original com operator_change_terminals_only=True
    print("\n[ORIGINAL] operator_change_terminals_only=True")
    print("-"*40)
    csp_orig_true = SetPartitioningCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
        },
        operator_change_terminals_only=True
    )

    neighbors_orig_true = csp_orig_true._task_neighbors(blocks)
    columns_orig_true = csp_orig_true._generate_columns(blocks)

    print(f"  Arestas: {sum(len(v) for v in neighbors_orig_true.values())}")
    print(f"  Colunas: {len(columns_orig_true)}")

    # Mostrar grafo de vizinhança
    print(f"  Grafo de vizinhança:")
    for task_id, succs in neighbors_orig_true.items():
        print(f"    {task_id} → {[s.id for s in succs]}")

    # Mostrar todas as colunas
    print(f"  Colunas geradas:")
    for i, (combo, cost) in enumerate(columns_orig_true):
        print(f"    {i+1:3d}. {[b.id for b in combo]} (custo: {cost:.1f})")

    # Original com operator_change_terminals_only=False
    print("\n[ORIGINAL] operator_change_terminals_only=False")
    print("-"*40)
    csp_orig_false = SetPartitioningCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
        },
        operator_change_terminals_only=False
    )

    neighbors_orig_false = csp_orig_false._task_neighbors(blocks)
    columns_orig_false = csp_orig_false._generate_columns(blocks)

    print(f"  Arestas: {sum(len(v) for v in neighbors_orig_false.values())}")
    print(f"  Colunas: {len(columns_orig_false)}")

    # Mostrar grafo de vizinhança
    print(f"  Grafo de vizinhança:")
    for task_id, succs in neighbors_orig_false.items():
        print(f"    {task_id} → {[s.id for s in succs]}")

    # Mostrar top 20 colunas
    print(f"  Top 20 colunas geradas:")
    for i, (combo, cost) in enumerate(columns_orig_false[:20]):
        print(f"    {i+1:3d}. {[b.id for b in combo]} (custo: {cost:.1f})")

    # Otimizado com operator_change_terminals_only=False
    print("\n[OTIMIZADO] operator_change_terminals_only=False")
    print("-"*40)
    csp_opt_false = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
            "use_optimized_set_partitioning": True,
        },
        operator_change_terminals_only=False
    )

    neighbors_opt_false = csp_opt_false._task_neighbors_optimized(blocks)
    columns_opt_false = csp_opt_false._generate_columns_smart(blocks)

    print(f"  Arestas: {sum(len(v) for v in neighbors_opt_false.values())}")
    print(f"  Colunas: {len(columns_opt_false)}")

    # Mostrar grafo de vizinhança
    print(f"  Grafo de vizinhança:")
    for task_id, succs in neighbors_opt_false.items():
        print(f"    {task_id} → {[s.id for s in succs]}")

    # Mostrar top 20 colunas
    print(f"  Top 20 colunas geradas:")
    for i, (combo, cost) in enumerate(columns_opt_false[:20]):
        print(f"    {i+1:3d}. {[b.id for b in combo]} (custo: {cost:.1f})")

    # Análise de interseção
    print("\n" + "="*80)
    print("ANÁLISE DE INTESEÇÃO DE COLUNAS")
    print("="*80)

    # Extrair assinaturas
    orig_true_sigs = {tuple(b.id for b in combo) for combo, _ in columns_orig_true}
    orig_false_sigs = {tuple(b.id for b in combo) for combo, _ in columns_orig_false}
    opt_false_sigs = {tuple(b.id for b in combo) for combo, _ in columns_opt_false}

    print(f"\nContagem de colunas únicas:")
    print(f"  Original (strict=True): {len(orig_true_sigs)}")
    print(f"  Original (strict=False): {len(orig_false_sigs)}")
    print(f"  Otimizado (strict=False): {len(opt_false_sigs)}")

    # Interseção Original (strict=False) vs Otimizado (strict=False)
    intersection = orig_false_sigs.intersection(opt_false_sigs)
    print(f"\nInterseção Original/Otimizado (ambos strict=False): {len(intersection)}")

    # Apenas no Original
    only_orig = orig_false_sigs - opt_false_sigs
    print(f"Apenas no Original (strict=False): {len(only_orig)}")
    if only_orig:
        print(f"  Exemplos: {list(only_orig)[:5]}")

    # Apenas no Otimizado
    only_opt = opt_false_sigs - orig_false_sigs
    print(f"Apenas no Otimizado (strict=False): {len(only_opt)}")
    if only_opt:
        print(f"  Exemplos: {list(only_opt)[:5]}")


if __name__ == "__main__":
    try:
        analyze_combinations()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)