#!/usr/bin/env python3
"""
Teste de EXPLOSÃO COMBINATÓRIA real para validar OOM.
Cria blocos muito próximos temporalmente que geram combinações exponenciais.
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


def create_combinatorial_instance(n_blocks=50):
    """
    Cria instância que causa EXPLOSÃO COMBINATÓRIA real.

    Padrão: Muitos blocos curtos (30-60 min) com pequenos gaps (5-30 min)
    entre eles. Isso permite que quase qualquer bloco siga qualquer outro,
    gerando branching factor alto no DFS.

    Exemplo com 50 blocos:
    - Cada bloco tem 1-2 trips de 30-60 min
    - Gaps entre blocos: 5-30 min
    - Com max_shift=560 (9h20), quase todas as combinações são possíveis
    - Número teórico de combinações: O(2^n) = 2^50 ≈ 1.1e15
    """
    blocks = []
    start = 360  # 06:00

    print(f"Criando instância combinatória com {n_blocks} blocos...")

    for i in range(n_blocks):
        # Cada bloco com 1-2 trips curtas
        n_trips = 1 if i % 4 == 0 else 2
        trips = []

        block_start = start
        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 if j == 0 else 45  # 30-45 minutos por trip
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

        # Gap MÍNIMO entre blocos (5-30 min) para permitir combinações
        gap_between_blocks = 5 + (i % 26)  # 5-30 minutos
        start = block_start + gap_between_blocks

        if i % 10 == 0:
            print(f"  Bloco {i+1}: {len(trips)} trips, gap={gap_between_blocks}min")

    print(f"Criados {len(blocks)} blocos com gaps pequenos")
    print(f"Total trips: {sum(len(b.trips) for b in blocks)}")
    print(f"Horário do último bloco: {blocks[-1].end_time//60:02d}:{blocks[-1].end_time%60:02d}")

    return blocks


def test_combinatorial(algorithm_class, label, blocks, time_limit=30):
    """Testa instância combinatória com limite de tempo."""
    print(f"\n{'='*60}")
    print(f"TESTE COMBINATÓRIO: {label}")
    print(f"  Blocos: {len(blocks)}")
    print(f"  Trips total: {sum(len(b.trips) for b in blocks)}")
    print(f"  Limite de tempo: {time_limit}s")

    # Medir memória antes
    process = psutil.Process()
    mem_before = process.memory_info().rss / 1024 / 1024  # MB

    # Iniciar tracking detalhado
    tracemalloc.start()

    start_time = time.time()

    try:
        # Configurar para permitir mais combinações
        if algorithm_class == SetPartitioningCSP:
            csp = SetPartitioningCSP(vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 50000,  # Aumentado
                "max_candidate_successors_per_task": 10,  # Aumentado
                "max_trips_per_piece": 6,  # Aumentado
            })
        else:
            csp = SetPartitioningOptimizedCSP(vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 50000,
                "max_candidate_successors_per_task": 10,
                "max_trips_per_piece": 6,
                "use_optimized_set_partitioning": True,
            })

        # Executar com timeout
        import threading
        result = {"solution": None, "error": None}

        def run_solver():
            try:
                result["solution"] = csp.solve(blocks)
            except Exception as e:
                result["error"] = e

        thread = threading.Thread(target=run_solver)
        thread.start()
        thread.join(timeout=time_limit)

        if thread.is_alive():
            # Timeout - interromper
            import ctypes
            ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_long(thread.ident), ctypes.py_object(SystemExit))
            thread.join(timeout=2)

            tracemalloc.stop()
            print(f"\n  ✗ TIMEOUT ({time_limit}s)")
            return {"success": False, "error": f"Timeout após {time_limit}s"}

        elapsed = time.time() - start_time

        if result["error"]:
            raise result["error"]

        solution = result["solution"]

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
    """Executa teste de explosão combinatória."""
    print("TESTE DE EXPLOSÃO COMBINATÓRIA - Validar eliminação de OOM")
    print("="*80)

    # Tamanhos crescentes
    sizes = [30, 40, 50]  # Começar menor e aumentar

    for n_blocks in sizes:
        print(f"\n{'#'*80}")
        print(f"TAMANHO DA INSTÂNCIA: {n_blocks} blocos")
        print(f"{'#'*80}")

        blocks = create_combinatorial_instance(n_blocks)

        # Testar algoritmo original (deve falhar com OOM ou timeout)
        print(f"\n{'='*80}")
        print(f"TESTANDO ALGORITMO ORIGINAL ({n_blocks} blocos)")
        print(f"{'='*80}")

        time_limit = 60 if n_blocks <= 40 else 120
        orig_result = test_combinatorial(SetPartitioningCSP, "Original", blocks, time_limit)

        # Testar algoritmo otimizado
        print(f"\n{'='*80}")
        print(f"TESTANDO ALGORITMO OTIMIZADO ({n_blocks} blocos)")
        print(f"{'='*80}")

        opt_result = test_combinatorial(SetPartitioningOptimizedCSP, "Otimizado", blocks, time_limit)

        # Análise comparativa
        print(f"\n{'='*80}")
        print(f"ANÁLISE COMPARATIVA ({n_blocks} blocos)")
        print(f"{'='*80}")

        if orig_result["success"] and opt_result["success"]:
            print("✓ Ambos algoritmos completaram")

            # Comparar memória
            if "memory_peak_mb" in orig_result and "memory_peak_mb" in opt_result:
                mem_reduction = (orig_result["memory_peak_mb"] - opt_result["memory_peak_mb"]) / orig_result["memory_peak_mb"] * 100
                print(f"\nREDUÇÃO DE MEMÓRIA:")
                print(f"  Original: {orig_result['memory_peak_mb']:.1f} MB")
                print(f"  Otimizado: {opt_result['memory_peak_mb']:.1f} MB")
                print(f"  Redução: {mem_reduction:.1f}%")

                if mem_reduction >= 70:
                    print(f"  ✓ REDUÇÃO DE 70-90% ATINGIDA!")
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
            print(f"  ✓ Eliminou problema de {orig_result.get('error', 'erro')}!")

        elif not opt_result["success"]:
            print(f"✗ ALERTA: Algoritmo otimizado também falhou:")
            print(f"  Erro: {opt_result.get('error', 'desconhecido')}")

            if orig_result.get("error") == "OOM" and opt_result.get("error") != "OOM":
                print(f"  ✓ Pelo menos não é mais OOM!")

        # Se original falhou com OOM, testar tamanho maior pode ser perigoso
        if orig_result.get("error") == "OOM":
            print(f"\n⚠ Original falhou com OOM para {n_blocks} blocos")
            print(f"  Testando tamanho menor...")
            break

    print(f"\n{'='*80}")
    print("TESTE DE EXPLOSÃO COMBINATÓRIA CONCLUÍDO")
    print(f"{'='*80}")


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