#!/usr/bin/env python3
"""
TESTE COM DADOS REALISTAS: Simula cenário real onde destination_id == origin_id
para permitir operator_change_terminals_only=True funcionar corretamente.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip


def create_realistic_instance(n_blocks=30):
    """Cria instância realista com destination_id == origin_id do próximo."""
    blocks = []
    start = 360  # 06:00

    # Criar blocos com conexões reais
    for i in range(n_blocks):
        # Cada bloco com 1-2 trips
        n_trips = 1 if i % 3 == 0 else 2
        trips = []

        block_start = start
        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 + (j * 15)  # 30, 45 minutos

            # ORIGEM E DESTINO REALISTAS:
            # Para permitir conexões, destination_id deve igualar origin_id do próximo
            # No mundo real: trip termina no mesmo local que a próxima começa
            origin_id = (i + j) % 5 + 1  # 5 terminais possíveis
            dest_id = ((i + j + 1) % 5) + 1  # Próximo terminal

            t = Trip(
                id=trip_id,
                line_id=1,
                start_time=block_start,
                end_time=block_start + trip_dur,
                origin_id=origin_id,
                destination_id=dest_id,
                duration=trip_dur,
                distance_km=10.0,
            )
            trips.append(t)
            if j < n_trips - 1:
                block_start += trip_dur + 5  # Curto intervalo entre trips do mesmo bloco

        block = Block(
            id=i + 1,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)

        # Gap variado entre blocos
        gap = 15 + (i % 30)  # 15-45 minutos
        start = block_start + gap

    print(f"Criados {len(blocks)} blocos realistas")
    print(f"Primeiro bloco: Trip 1: origem={blocks[0].trips[0].origin_id}, destino={blocks[0].trips[0].destination_id}")
    print(f"Segundo bloco: Trip 1: origem={blocks[1].trips[0].origin_id}, destino={blocks[1].trips[0].destination_id}")

    return blocks


def test_both_algorithms(blocks):
    """Testa ambos algoritmos com mesma instância."""
    print("\n" + "="*60)
    print("TESTE COM DADOS REALISTAS")
    print("="*60)

    # Testar original (com operator_change_terminals_only=True)
    print("\n[ORIGINAL] operator_change_terminals_only=True")
    csp_orig = SetPartitioningCSP(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
    })

    # Verificar parâmetro do greedy
    print(f"  Parâmetro operator_change_terminals_only no greedy: {csp_orig.greedy.operator_change_terminals_only}")

    # Construir grafo
    neighbors_orig = csp_orig._task_neighbors(blocks)
    edges_orig = sum(len(v) for v in neighbors_orig.values())
    print(f"  Arestas no grafo: {edges_orig}")

    # Gerar colunas
    columns_orig = csp_orig._generate_columns(blocks)
    print(f"  Colunas geradas: {len(columns_orig)}")
    if columns_orig:
        avg_size = sum(len(combo) for combo, _ in columns_orig) / len(columns_orig)
        print(f"  Tamanho médio coluna: {avg_size:.1f} blocos")

    # Testar otimizado (com operator_change_terminals_only=False por padrão)
    print("\n[OTIMIZADO] operator_change_terminals_only=False (nosso fix)")
    csp_opt = SetPartitioningOptimizedCSP(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
        "use_optimized_set_partitioning": True,
    })

    print(f"  Parâmetro operator_change_terminals_only no greedy: {csp_opt.greedy.operator_change_terminals_only}")

    # Construir grafo otimizado
    neighbors_opt = csp_opt._task_neighbors_optimized(blocks)
    edges_opt = sum(len(v) for v in neighbors_opt.values())
    print(f"  Arestas no grafo: {edges_opt}")

    # Gerar colunas otimizadas
    columns_opt = csp_opt._generate_columns_smart(blocks)
    print(f"  Colunas geradas: {len(columns_opt)}")
    if columns_opt:
        avg_size = sum(len(combo) for combo, _ in columns_opt) / len(columns_opt)
        print(f"  Tamanho médio coluna: {avg_size:.1f} blocos")

    # Testar otimizado COM operator_change_terminals_only=True
    print("\n[OTIMIZADO] operator_change_terminals_only=True (forçado)")
    csp_opt_strict = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
            "use_optimized_set_partitioning": True,
        },
        operator_change_terminals_only=True  # Forçar parâmetro
    )

    print(f"  Parâmetro operator_change_terminals_only no greedy: {csp_opt_strict.greedy.operator_change_terminals_only}")

    # Construir grafo
    neighbors_opt_strict = csp_opt_strict._task_neighbors_optimized(blocks)
    edges_opt_strict = sum(len(v) for v in neighbors_opt_strict.values())
    print(f"  Arestas no grafo: {edges_opt_strict}")

    # Gerar colunas
    columns_opt_strict = csp_opt_strict._generate_columns_smart(blocks)
    print(f"  Colunas geradas: {len(columns_opt_strict)}")
    if columns_opt_strict:
        avg_size = sum(len(combo) for combo, _ in columns_opt_strict) / len(columns_opt_strict)
        print(f"  Tamanho médio coluna: {avg_size:.1f} blocos")

    return {
        'original': {'edges': edges_orig, 'columns': len(columns_orig)},
        'optimized_false': {'edges': edges_opt, 'columns': len(columns_opt)},
        'optimized_true': {'edges': edges_opt_strict, 'columns': len(columns_opt_strict)},
    }


def main():
    print("TESTE DE DADOS REALISTAS PARA operator_change_terminals_only")
    print("="*80)

    # Criar instância realista
    blocks = create_realistic_instance(30)

    # Testar ambos algoritmos
    results = test_both_algorithms(blocks)

    print("\n" + "="*80)
    print("ANÁLISE COMPARATIVA")
    print("="*80)

    print(f"\n{'Configuração':<40} {'Arestas':>10} {'Colunas':>10} {'Tamanho médio':>15}")
    print("-" * 75)

    configs = [
        ("Original (strict=True)", results['original']),
        ("Otimizado (strict=False)", results['optimized_false']),
        ("Otimizado (strict=True)", results['optimized_true']),
    ]

    for label, data in configs:
        print(f"{label:<40} {data['edges']:>10} {data['columns']:>10}")

    print("\nCONCLUSÕES:")
    print("1. Com dados REALISTAS (destination_id == próximo origin_id):")
    print("   - operator_change_terminals_only=True DEVE funcionar")
    print("   - Deve gerar conexões e colunas multi-bloco")
    print("2. Se ainda tiver zero arestas, há outro problema no algoritmo")
    print("3. Solução: Corrigir dados de teste para serem realistas")
    print("4. OU: Implementar fallback quando operator_change_terminals_only bloqueia tudo")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)