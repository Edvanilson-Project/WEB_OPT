#!/usr/bin/env python3
"""
COMPARAÇÃO DETALHADA: Quantidade de colunas geradas por diferentes configurações.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip


def create_test_instance(n_blocks=30, gap_minutes=10):
    """Cria instância de teste com gaps controlados."""
    blocks = []
    start = 360  # 06:00

    for i in range(n_blocks):
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

        start = start + trip_dur + gap_minutes

    print(f"Criados {len(blocks)} blocos com gap de {gap_minutes} minutos")
    return blocks


def test_configuration(label, algorithm_class, blocks, strict=True):
    """Testa uma configuração específica."""
    print(f"\n{label}")
    print("-" * 60)

    if algorithm_class == SetPartitioningCSP:
        csp = algorithm_class(
            vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 1000,
                "max_candidate_successors_per_task": 4,
            },
            operator_change_terminals_only=strict
        )
    else:
        csp = algorithm_class(
            vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 1000,
                "max_candidate_successors_per_task": 4,
                "use_optimized_set_partitioning": True,
            },
            operator_change_terminals_only=strict
        )

    if hasattr(csp, '_adaptive_parameters'):
        csp._adaptive_parameters(len(blocks))

    print(f"  operator_change_terminals_only: {csp.greedy.operator_change_terminals_only}")
    print(f"  max_candidate_successors: {getattr(csp, 'max_candidate_successors', 'N/A')}")
    print(f"  max_columns: {getattr(csp, 'max_columns', 'N/A')}")

    # Grafo de vizinhança
    if hasattr(csp, '_task_neighbors_optimized'):
        neighbors = csp._task_neighbors_optimized(blocks)
    else:
        neighbors = csp._task_neighbors(blocks)

    edges = sum(len(v) for v in neighbors.values())
    print(f"  Arestas no grafo: {edges}")

    # Geração de colunas
    if hasattr(csp, '_generate_columns_smart'):
        columns = list(csp._generate_columns_smart(blocks))
    else:
        columns = csp._generate_columns(blocks)

    print(f"  Colunas geradas: {len(columns)}")

    # Distribuição por tamanho
    size_counts = {}
    for combo, _ in columns:
        size = len(combo)
        size_counts[size] = size_counts.get(size, 0) + 1

    print(f"  Distribuição tamanhos: {dict(sorted(size_counts.items()))}")

    # Se otimizado, mostrar contadores
    if hasattr(csp, '_fast_checks'):
        print(f"  Verificações rápidas: {csp._fast_checks}")
        print(f"  Verificações completas: {csp._full_checks}")
        print(f"  Poda de combinações: {csp._combinations_pruned}")
        print(f"  Cache hits: {csp._cache_hits}")

    return {
        'edges': edges,
        'columns': len(columns),
        'size_dist': size_counts,
    }


def main():
    print("COMPARAÇÃO DETALHADA DE GERAÇÃO DE COLUNAS")
    print("="*80)

    # Testar diferentes tamanhos
    for n_blocks in [10, 20, 30]:
        print(f"\n{'#'*80}")
        print(f"TESTE COM {n_blocks} BLOCOS (gap 10 minutos)")
        print(f"{'#'*80}")

        blocks = create_test_instance(n_blocks)

        results = {}

        # 1. Original com strict=True
        results['orig_strict'] = test_configuration(
            "ORIGINAL (operator_change_terminals_only=True)",
            SetPartitioningCSP, blocks, strict=True
        )

        # 2. Original com strict=False
        results['orig_relaxed'] = test_configuration(
            "ORIGINAL (operator_change_terminals_only=False)",
            SetPartitioningCSP, blocks, strict=False
        )

        # 3. Otimizado com strict=True
        results['opt_strict'] = test_configuration(
            "OTIMIZADO (operator_change_terminals_only=True)",
            SetPartitioningOptimizedCSP, blocks, strict=True
        )

        # 4. Otimizado com strict=False
        results['opt_relaxed'] = test_configuration(
            "OTIMIZADO (operator_change_terminals_only=False)",
            SetPartitioningOptimizedCSP, blocks, strict=False
        )

        # Resumo comparativo
        print(f"\n{'='*80}")
        print(f"RESUMO COMPARATIVO ({n_blocks} blocos)")
        print(f"{'='*80}")

        print(f"\n{'Configuração':<50} {'Arestas':>10} {'Colunas':>10}")
        print("-" * 70)

        for label, key in [
            ("Original (strict=True)", 'orig_strict'),
            ("Original (strict=False)", 'orig_relaxed'),
            ("Otimizado (strict=True)", 'opt_strict'),
            ("Otimizado (strict=False)", 'opt_relaxed'),
        ]:
            data = results[key]
            print(f"{label:<50} {data['edges']:>10} {data['columns']:>10}")

        # Análise do impacto do strict
        strict_ratio = results['orig_strict']['columns'] / max(1, results['orig_relaxed']['columns'])
        print(f"\nImpacto de operator_change_terminals_only=True:")
        print(f"  Redução colunas: {(1 - strict_ratio) * 100:.1f}%")
        print(f"  Original: {results['orig_relaxed']['columns']} → {results['orig_strict']['columns']}")
        print(f"  Otimizado: {results['opt_relaxed']['columns']} → {results['opt_strict']['columns']}")

        # Comparação otimizado vs original
        if results['orig_strict']['columns'] > 0:
            ratio = results['opt_strict']['columns'] / results['orig_strict']['columns']
            print(f"\nComparação otimizado vs original (strict=True):")
            print(f"  Otimizado/Original: {ratio:.2f}x colunas")

        print(f"\n{'#'*80}")
        print(f"FIM TESTE {n_blocks} BLOCOS")
        print(f"{'#'*80}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)