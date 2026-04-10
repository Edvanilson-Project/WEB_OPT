#!/usr/bin/env python3
"""
Teste para FORÇAR OOM real e identificar gargalo de memória.
"""
import os
import sys
import time
import tracemalloc
import psutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip


def create_large_instance(n_blocks=200):
    """Cria instância grande para forçar OOM COM DADOS REALISTAS."""
    blocks = []
    start = 360  # 06:00

    print(f"Criando instância GRANDE com {n_blocks} blocos...")

    # Para garantir viabilidade com operator_change_terminals_only=True,
    # precisamos que destination_id == origin_id do próximo bloco
    # Usaremos 5 terminais possíveis
    n_terminals = 5

    for i in range(n_blocks):
        # Cada bloco com 1-3 trips
        n_trips = 1 + (i % 3)
        trips = []

        block_start = start
        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 + (j * 15)  # 30, 45, 60 minutos

            # ORIGEM E DESTINO REALISTAS:
            # Para permitir conexões, destination_id deve igualar origin_id do próximo
            # No mundo real: trip termina no mesmo local que a próxima começa
            origin_id = (i + j) % n_terminals + 1
            dest_id = ((i + j + 1) % n_terminals) + 1

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
                block_start += trip_dur + 5

        block = Block(
            id=i + 1,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)

        # Gap MÍNIMO para maximizar combinações
        gap = 1 + (i % 4)  # 1-4 minutos apenas!
        start = block_start + gap

    print(f"Criados {len(blocks)} blocos, {sum(len(b.trips) for b in blocks)} trips")
    print(f"Último horário: {blocks[-1].end_time//60:02d}:{blocks[-1].end_time%60:02d}")
    return blocks


def test_algorithm(algorithm_class, label, blocks, timeout=30):
    """Testa algoritmo com monitoramento de memória detalhado."""
    print(f"\n{'='*60}")
    print(f"TESTE {label}")
    print(f"{'='*60}")

    # Iniciar tracemalloc
    tracemalloc.start()
    process = psutil.Process()

    # Fase 1: Criar CSP
    print("\n[Fase 1] Criando CSP...")
    mem_before_csp = process.memory_info().rss / 1024 / 1024
    if algorithm_class == SetPartitioningCSP:
        csp = SetPartitioningCSP(vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 50000,
            "max_candidate_successors_per_task": 10,
        })
    else:
        csp = SetPartitioningOptimizedCSP(vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 50000,
            "max_candidate_successors_per_task": 10,
            "use_optimized_set_partitioning": True,
        })
    mem_after_csp = process.memory_info().rss / 1024 / 1024
    current1, peak1 = tracemalloc.get_traced_memory()

    print(f"  Memória RSS: {mem_before_csp:.1f} → {mem_after_csp:.1f} MB (+{mem_after_csp - mem_before_csp:.1f} MB)")
    print(f"  Tracemalloc: {peak1 / 1024 / 1024:.1f} MB")

    # Fase 2: Grafo de vizinhança
    print("\n[Fase 2] Construindo grafo de vizinhança...")
    mem_before_neighbors = process.memory_info().rss / 1024 / 1024

    if hasattr(csp, '_task_neighbors_optimized'):
        neighbors = csp._task_neighbors_optimized(blocks)
        method_name = '_task_neighbors_optimized'
    else:
        neighbors = csp._task_neighbors(blocks)
        method_name = '_task_neighbors'

    mem_after_neighbors = process.memory_info().rss / 1024 / 1024
    current2, peak2 = tracemalloc.get_traced_memory()

    print(f"  Memória RSS: {mem_before_neighbors:.1f} → {mem_after_neighbors:.1f} MB (+{mem_after_neighbors - mem_before_neighbors:.1f} MB)")
    print(f"  Tracemalloc: {peak2 / 1024 / 1024:.1f} MB")
    print(f"  Arestas no grafo: {sum(len(v) for v in neighbors.values())}")

    # Fase 3: Geração de colunas
    print("\n[Fase 3] Gerando colunas...")
    mem_before_columns = process.memory_info().rss / 1024 / 1024

    start_time = time.time()
    if hasattr(csp, '_generate_columns_smart'):
        columns = list(csp._generate_columns_smart(blocks))
        method_name = '_generate_columns_smart'
    else:
        columns = csp._generate_columns(blocks)
        method_name = '_generate_columns'

    column_time = time.time() - start_time
    mem_after_columns = process.memory_info().rss / 1024 / 1024
    current3, peak3 = tracemalloc.get_traced_memory()

    print(f"  Memória RSS: {mem_before_columns:.1f} → {mem_after_columns:.1f} MB (+{mem_after_columns - mem_before_columns:.1f} MB)")
    print(f"  Tracemalloc: {peak3 / 1024 / 1024:.1f} MB")
    print(f"  Colunas geradas: {len(columns)}")
    print(f"  Tempo: {column_time:.2f}s")

    if columns:
        avg_size = sum(len(combo) for combo, _ in columns) / len(columns)
        print(f"  Tamanho médio: {avg_size:.1f} blocos")

    # Fase 4: ILP
    print("\n[Fase 4] Criando modelo ILP...")
    mem_before_ilp = process.memory_info().rss / 1024 / 1024
    peak4 = 0  # Inicializar para evitar UnboundLocalError
    current4 = 0

    if hasattr(csp, '_create_ilp_model'):
        try:
            model, x_vars = csp._create_ilp_model(columns, blocks)
            mem_after_ilp = process.memory_info().rss / 1024 / 1024
            current4, peak4 = tracemalloc.get_traced_memory()
            print(f"  Memória RSS: {mem_before_ilp:.1f} → {mem_after_ilp:.1f} MB (+{mem_after_ilp - mem_before_ilp:.1f} MB)")
            print(f"  Tracemalloc: {peak4 / 1024 / 1024:.1f} MB")
            print(f"  Variáveis: {len(x_vars)}")
        except Exception as e:
            print(f"  Erro: {e}")
            mem_after_ilp = mem_before_ilp
    else:
        mem_after_ilp = mem_before_ilp

    # Total
    tracemalloc.stop()
    total_rss = mem_after_ilp - mem_before_csp

    print(f"\n{'='*60}")
    print(f"RESUMO {label}")
    print(f"{'='*60}")
    print(f"Total RSS: {total_rss:.1f} MB")
    print(f"Pico tracemalloc: {max(peak1, peak2, peak3, peak4) / 1024 / 1024:.1f} MB")
    print(f"Colunas: {len(columns)}")

    return {
        'csp_mb': mem_after_csp - mem_before_csp,
        'neighbors_mb': mem_after_neighbors - mem_before_neighbors,
        'columns_mb': mem_after_columns - mem_before_columns,
        'ilp_mb': mem_after_ilp - mem_before_ilp,
        'total_rss_mb': total_rss,
        'peak_mb': max(peak1, peak2, peak3, peak4) / 1024 / 1024,
        'n_columns': len(columns),
    }


def main():
    print("TESTE PARA IDENTIFICAR GARGALO DE MEMÓRIA REAL")
    print("="*80)

    # Testar com tamanhos crescentes
    sizes = [50, 100, 150]

    for n_blocks in sizes:
        print(f"\n{'#'*80}")
        print(f"TESTE COM {n_blocks} BLOCOS (gaps mínimos)")
        print(f"{'#'*80}")

        blocks = create_large_instance(n_blocks)

        # Testar original
        print(f"\nALGORITMO ORIGINAL:")
        try:
            orig_stats = test_algorithm(SetPartitioningCSP, "ORIGINAL", blocks, timeout=60)
        except MemoryError as e:
            print(f"✗ OOM no original com {n_blocks} blocos!")
            print(f"  Erro: {e}")
            orig_stats = None

        print(f"\nALGORITMO OTIMIZADO:")
        try:
            opt_stats = test_algorithm(SetPartitioningOptimizedCSP, "OTIMIZADO", blocks, timeout=60)
        except MemoryError as e:
            print(f"✗ OOM no otimizado com {n_blocks} blocos!")
            print(f"  Erro: {e}")
            opt_stats = None

        # Comparação
        if orig_stats and opt_stats:
            print(f"\n{'='*80}")
            print(f"COMPARAÇÃO ({n_blocks} blocos)")
            print(f"{'='*80}")

            print(f"\n{'Fase':<20} {'Original':>10} {'Otimizado':>10} {'Redução':>10} {'%':>8}")
            print("-" * 68)

            phases = [
                ('csp_mb', 'Criação CSP'),
                ('neighbors_mb', 'Grafo vizinhança'),
                ('columns_mb', 'Colunas'),
                ('ilp_mb', 'ILP'),
                ('total_rss_mb', 'Total RSS'),
                ('peak_mb', 'Pico tracemalloc'),
            ]

            for key, label in phases:
                orig = orig_stats.get(key, 0)
                opt = opt_stats.get(key, 0)
                diff = orig - opt
                pct = (diff / orig * 100) if orig != 0 else 0
                print(f"{label:<20} {orig:>10.1f} {opt:>10.1f} {diff:>10.1f} {pct:>7.1f}%")

            print(f"{'Nº colunas':<20} {orig_stats.get('n_columns', 0):>10} {opt_stats.get('n_columns', 0):>10} {orig_stats.get('n_columns', 0) - opt_stats.get('n_columns', 0):>10}")

        print(f"\n{'='*80}")
        print(f"FIM TESTE {n_blocks} BLOCOS")
        print(f"{'='*80}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Teste interrompido")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)