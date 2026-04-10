#!/usr/bin/env python3
"""
DEBUG SIMPLES: Analisa consumo de memória nas diferentes fases.
Foca em identificar gargalos de memória sem dependências externas.
"""
import os
import sys
import time
import gc
import resource
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
from src.domain.models import Block, Trip, VehicleType


def get_memory_mb():
    """Retorna uso de memória em MB usando resource (cross-platform)."""
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0  # Linux usa KB


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


def create_small_instance():
    """Cria instância pequena para análise rápida."""
    blocks = []
    start = 360  # 06:00

    for i in range(20):
        # Cada bloco com 1-2 trips
        n_trips = 1 if i % 3 == 0 else 2
        trips = []

        block_start = start
        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 + (j * 15)
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
                block_start += trip_dur + 5

        block = Block(
            id=i + 1,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)

        # Gap variado
        if i % 10 < 2:
            gap = 5 + (i % 56)
        elif i % 10 < 5:
            gap = 60 + (i % 180)
        else:
            gap = 240 + (i % 320)

        start = block_start + gap

    print(f"Criados {len(blocks)} blocos, {sum(len(b.trips) for b in blocks)} trips")
    return blocks


def analyze_memory_breakdown(csp_class, label, blocks):
    """Analisa consumo de memória em diferentes estruturas."""
    print(f"\n{'='*60}")
    print(f"ANÁLISE DE MEMÓRIA: {label}")
    print(f"{'='*60}")

    # Fase 0: Baseline
    gc.collect()
    mem_baseline = get_memory_mb()
    print(f"Memória baseline: {mem_baseline:.1f} MB")

    # Fase 1: Criar objeto CSP
    csp = csp_class(vsp_params={
        "pricing_enabled": True,
        "max_generated_columns": 1000,
        "max_candidate_successors_per_task": 4,
    })
    mem_after_csp = get_memory_mb()
    print(f"Após criar CSP: {mem_after_csp:.1f} MB (+{mem_after_csp - mem_baseline:.1f} MB)")

    # Fase 2: Construir grafo de vizinhança
    if hasattr(csp, '_task_neighbors_optimized'):
        neighbors = csp._task_neighbors_optimized(blocks)
        method_name = '_task_neighbors_optimized'
    else:
        neighbors = csp._task_neighbors(blocks)
        method_name = '_task_neighbors'

    mem_after_neighbors = get_memory_mb()
    print(f"Após {method_name}: {mem_after_neighbors:.1f} MB (+{mem_after_neighbors - mem_after_csp:.1f} MB)")

    # Analisar estrutura do grafo
    total_edges = sum(len(v) for v in neighbors.values())
    avg_degree = total_edges / max(1, len(neighbors))
    print(f"  Grafo: {len(neighbors)} nós, {total_edges} arestas, {avg_degree:.1f} grau médio")

    # Fase 3: Gerar colunas
    if hasattr(csp, '_generate_columns_smart'):
        columns = list(csp._generate_columns_smart(blocks))
        method_name = '_generate_columns_smart'
    else:
        columns = csp._generate_columns(blocks)
        method_name = '_generate_columns'

    mem_after_columns = get_memory_mb()
    print(f"Após {method_name}: {mem_after_columns:.1f} MB (+{mem_after_columns - mem_after_neighbors:.1f} MB)")
    print(f"  Colunas geradas: {len(columns)}")

    # Analisar tamanho das colunas
    if columns:
        col_sizes = [len(combo) for combo, _ in columns]
        avg_size = sum(col_sizes) / len(col_sizes)
        print(f"  Tamanho médio coluna: {avg_size:.1f} blocos")
        print(f"  Tamanho mínimo: {min(col_sizes)}, máximo: {max(col_sizes)}")

    # Fase 4: Criar modelo ILP
    if hasattr(csp, '_create_ilp_model'):
        try:
            model, x_vars = csp._create_ilp_model(columns, blocks)
            mem_after_ilp = get_memory_mb()
            print(f"Após criar modelo ILP: {mem_after_ilp:.1f} MB (+{mem_after_ilp - mem_after_columns:.1f} MB)")
            print(f"  Variáveis ILP: {len(x_vars)}")
        except Exception as e:
            print(f"  Erro ao criar modelo ILP: {e}")
            mem_after_ilp = mem_after_columns

    # Fase 5: Solve completo (se não for muito pesado)
    try:
        solution = csp.solve(blocks)
        mem_after_solve = get_memory_mb()
        print(f"Após solve completo: {mem_after_solve:.1f} MB (+{mem_after_solve - mem_after_ilp:.1f} MB)")
        print(f"  Duties gerados: {len(solution.duties)}")
    except Exception as e:
        print(f"  Solve falhou ou omitido: {e}")

    # Total
    total_mem = mem_after_solve - mem_baseline if 'mem_after_solve' in locals() else mem_after_ilp - mem_baseline
    print(f"\nTOTAL: {total_mem:.1f} MB consumidos")

    return {
        'baseline': mem_baseline,
        'after_csp': mem_after_csp - mem_baseline,
        'after_neighbors': mem_after_neighbors - mem_after_csp,
        'after_columns': mem_after_columns - mem_after_neighbors,
        'total': total_mem
    }


def analyze_data_structures(blocks):
    """Analisa o tamanho em memória das estruturas de dados básicas."""
    print(f"\n{'='*60}")
    print(f"ANÁLISE DE ESTRUTURAS DE DADOS")
    print(f"{'='*60}")

    import sys

    # Tamanho de um bloco
    if blocks:
        block = blocks[0]
        block_size = sys.getsizeof(block)
        # Estimativa para trips dentro do bloco
        trips_size = sum(sys.getsizeof(t) for t in block.trips) if hasattr(block, 'trips') else 0
        print(f"Tamanho de um Block: {block_size:,} bytes ({block_size/1024:.1f} KB)")
        print(f"Trips no bloco: {len(block.trips) if hasattr(block, 'trips') else 0}")
        print(f"Tamanho total trips: {trips_size:,} bytes ({trips_size/1024:.1f} KB)")

    # Tamanho de todos os blocos
    total_blocks_size = sum(sys.getsizeof(b) for b in blocks)
    print(f"\nTotal {len(blocks)} blocos: {total_blocks_size:,} bytes ({total_blocks_size/1024/1024:.2f} MB)")

    # Contar trips total
    total_trips = sum(len(b.trips) for b in blocks if hasattr(b, 'trips'))
    print(f"Total trips: {total_trips}")

    # Tamanho de um objeto Trip
    if blocks and hasattr(blocks[0], 'trips') and blocks[0].trips:
        trip = blocks[0].trips[0]
        trip_size = sys.getsizeof(trip)
        print(f"Tamanho de uma Trip: {trip_size:,} bytes")


def main():
    print("ANÁLISE DE CONSUMO DE MEMÓRIA - Versão Simplificada")
    print("="*60)

    # Criar instância pequena
    blocks = create_small_instance()

    # Analisar estruturas de dados
    analyze_data_structures(blocks)

    # Analisar algoritmo original
    orig_stats = analyze_memory_breakdown(SetPartitioningCSP, "ORIGINAL", blocks)

    print("\n" + "="*60)
    print("AGUARDANDO 2s PARA LIMPEZA DE MEMÓRIA...")
    print("="*60)
    time.sleep(2)
    gc.collect()

    # Analisar algoritmo otimizado
    opt_stats = analyze_memory_breakdown(SetPartitioningOptimizedCSP, "OTIMIZADO", blocks)

    # Análise comparativa
    print(f"\n{'='*60}")
    print(f"ANÁLISE COMPARATIVA")
    print(f"{'='*60}")

    print(f"\n{'Fase':<25} {'Original':>10} {'Otimizado':>10} {'Diferença':>10} {'% Redução':>10}")
    print("-" * 75)

    phases = ['after_csp', 'after_neighbors', 'after_columns', 'total']
    phase_labels = {
        'after_csp': 'Criação CSP',
        'after_neighbors': 'Grafo vizinhança',
        'after_columns': 'Geração colunas',
        'total': 'TOTAL'
    }

    for phase in phases:
        orig = orig_stats.get(phase, 0)
        opt = opt_stats.get(phase, 0)
        diff = orig - opt
        pct = (diff / orig * 100) if orig != 0 else 0
        print(f"{phase_labels.get(phase, phase):<25} {orig:>10.1f} {opt:>10.1f} {diff:>10.1f} {pct:>9.1f}%")

    # Identificar gargalo principal
    print(f"\n{'='*60}")
    print(f"CONCLUSÕES E RECOMENDAÇÕES")
    print(f"{'='*60}")

    max_phase = max(phases[:-1], key=lambda p: orig_stats.get(p, 0))
    max_value = orig_stats.get(max_phase, 0)
    print(f"\nMaior consumo no original: {phase_labels.get(max_phase, max_phase)} = {max_value:.1f} MB")

    if max_phase == 'after_columns':
        print("""
GARGALO PRINCIPAL: Geração de colunas

PROBLEMA IDENTIFICADO:
- O algoritmo gera todas as colunas possíveis antes de resolver o ILP
- Cada coluna armazena lista completa de blocos (duplicação de dados)
- Número de colunas pode crescer exponencialmente com branching factor

SOLUÇÕES:
1. Geração LAZY de colunas: produz colunas sob demanda em tempo de pricing
2. Streaming de colunas: não armazena todas na memória, processa em batches
3. Limite mais agressivo de colunas: max_columns = min(1000, n_tasks * 10)
4. Compactação: armazenar apenas IDs dos blocos em vez de objetos completos
""")
    elif max_phase == 'after_neighbors':
        print("""
GARGALO PRINCIPAL: Grafo de vizinhança

PROBLEMA IDENTIFICADO:
- Matriz de compatibilidade completa O(n²)
- Cada nó armazena lista de sucessores com objetos Block completos
- Grafo é denso quando gaps são pequenos

SOLUÇÕES:
1. Matriz esparsa: armazenar apenas índices dos sucessores viáveis
2. Representação por intervalos: para tarefas com gaps regulares, usar fórmulas
3. Poda mais agressiva: aplicar mais filtros O(1) antes de _can_extend
4. Armazenar apenas IDs em vez de objetos Block
""")
    else:
        print(f"\nGargalo em {phase_labels.get(max_phase, max_phase)}. Investigar estrutura específica.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Análise interrompida")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)