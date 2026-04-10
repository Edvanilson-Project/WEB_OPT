#!/usr/bin/env python3
"""
Teste de EXPLOSÃO COMBINATÓRIA EXTREMA para validar OOM real.
Cria 100+ blocos com gaps mínimos (1-2 min) para maximizar branching factor.
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


def create_extreme_combinatorial_instance(n_blocks=100):
    """
    Cria instância que causa EXPLOSÃO COMBINATÓRIA EXTREMA.

    Padrão: 100 blocos com gaps mínimos (1-2 min) e trips curtas (20-30 min).
    Isso maximiza o branching factor no DFS - quase qualquer bloco pode seguir qualquer outro.

    Exemplo com 100 blocos:
    - Cada bloco: 1 trip de 20-30 minutos
    - Gaps entre blocos: 1-2 minutos apenas
    - Com max_shift=560, TODOS os blocos podem seguir todos
    - Número teórico de combinações: O(2^n) = 2^100 ≈ 1.3e30
    """
    blocks = []
    start = 360  # 06:00

    print(f"Criando instância combinatória EXTREMA com {n_blocks} blocos...")
    print(f"Gaps mínimos: 1-2 minutos entre blocos")
    print(f"Trips curtas: 20-30 minutos por bloco")
    print(f"Branching factor teórico: ~{n_blocks} sucessores por tarefa")

    for i in range(n_blocks):
        # Cada bloco com apenas 1 trip muito curta
        trip_dur = 20 + (i % 11)  # 20-30 minutos
        t = Trip(
            id=i+1,
            line_id=1,
            start_time=start,
            end_time=start + trip_dur,
            origin_id=1,
            destination_id=2,
            duration=trip_dur,
            distance_km=5.0,
        )

        block_id = i + 1
        block = Block(
            id=block_id,
            trips=[t],
            vehicle_type_id=1,
        )
        blocks.append(block)

        # Gap MÍNIMO ABSOLUTO entre blocos (1-2 minutos)
        gap_between_blocks = 1 + (i % 2)  # 1-2 minutos apenas!
        start = start + trip_dur + gap_between_blocks

        if i % 20 == 0:
            print(f"  Bloco {i+1}: trip={trip_dur}min, gap={gap_between_blocks}min")

    print(f"\nCriados {len(blocks)} blocos com gaps mínimos")
    print(f"Total trips: {sum(len(b.trips) for b in blocks)}")
    print(f"Horário do último bloco: {blocks[-1].end_time//60:02d}:{blocks[-1].end_time%60:02d}")
    print(f"Tempo total coberto: {(blocks[-1].end_time - 360)/60:.1f} horas")

    # Análise de branching factor teórico
    # Com gaps de 1-2min entre blocos e max_shift=560 (9h20),
    # um bloco pode seguir aproximadamente quantos outros?
    first_block_end = blocks[0].end_time
    potential_successors = 0
    for b in blocks[1:]:
        if b.start_time - first_block_end <= 560:  # max_shift
            potential_successors += 1

    print(f"\nBranching factor teórico para primeiro bloco:")
    print(f"  - Fim do primeiro bloco: {first_block_end//60:02d}:{first_block_end%60:02d}")
    print(f"  - Potenciais sucessores: {potential_successors}/{len(blocks)-1}")
    print(f"  - Proporção: {potential_successors/(len(blocks)-1)*100:.1f}%")

    return blocks


def test_combinatorial_extreme(algorithm_class, label, blocks, time_limit=180):
    """Testa instância combinatória extrema com limite de tempo maior."""
    print(f"\n{'='*80}")
    print(f"TESTE COMBINATÓRIO EXTREMO: {label}")
    print(f"  Blocos: {len(blocks)}")
    print(f"  Trips total: {sum(len(b.trips) for b in blocks)}")
    print(f"  Limite de tempo: {time_limit}s")
    print(f"  Branching factor estimado: {len(blocks) * 0.8:.0f}")

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
                "max_generated_columns": 100000,  # Aumentado drasticamente
                "max_candidate_successors_per_task": 15,  # Aumentado
                "max_trips_per_piece": 10,  # Aumentado
            })
        else:
            csp = SetPartitioningOptimizedCSP(vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 100000,
                "max_candidate_successors_per_task": 15,
                "max_trips_per_piece": 10,
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
    """Executa teste de explosão combinatória EXTREMA."""
    print("TESTE DE EXPLOSÃO COMBINATÓRIA EXTREMA - Validar eliminação de OOM")
    print("="*100)
    print("OBJETIVO: Forçar OOM no algoritmo original e validar redução de memória")
    print("PARÂMETROS: 100 blocos, gaps de 1-2 minutos, trips de 20-30 minutos")
    print("="*100)

    # Tamanhos progressivos até OOM
    sizes = [30, 50, 75, 100]  # Progressão até 100 blocos

    for n_blocks in sizes:
        print(f"\n{'#'*100}")
        print(f"TAMANHO DA INSTÂNCIA: {n_blocks} blocos (EXTREMO)")
        print(f"Teórico: 2^{n_blocks} ≈ {2**n_blocks:.1e} combinações")
        print(f"{'#'*100}")

        blocks = create_extreme_combinatorial_instance(n_blocks)

        # Testar algoritmo original (deve falhar com OOM ou timeout)
        print(f"\n{'='*100}")
        print(f"TESTANDO ALGORITMO ORIGINAL ({n_blocks} blocos EXTREMOS)")
        print(f"{'='*100}")

        time_limit = 120 if n_blocks <= 50 else 300
        orig_result = test_combinatorial_extreme(SetPartitioningCSP, "Original", blocks, time_limit)

        # Testar algoritmo otimizado
        print(f"\n{'='*100}")
        print(f"TESTANDO ALGORITMO OTIMIZADO ({n_blocks} blocos EXTREMOS)")
        print(f"{'='*100}")

        opt_result = test_combinatorial_extreme(SetPartitioningOptimizedCSP, "Otimizado", blocks, time_limit)

        # Análise comparativa
        print(f"\n{'='*100}")
        print(f"ANÁLISE COMPARATIVA ({n_blocks} blocos EXTREMOS)")
        print(f"{'='*100}")

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
            print(f"\n⚠ Original falhou com OOM para {n_blocks} blocos EXTREMOS")
            print(f"  Testando tamanho menor...")
            break

    print(f"\n{'='*100}")
    print("TESTE DE EXPLOSÃO COMBINATÓRIA EXTREMA CONCLUÍDO")
    print(f"{'='*100}")


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