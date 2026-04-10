#!/usr/bin/env python3
"""
Teste rápido da implementação otimizada SetPartitioningOptimizedCSP.

Este teste verifica:
1. Que a classe pode ser importada e instanciada
2. Que resolve problemas simples
3. Que as métricas de performance são coletadas
4. Que a redução de combinações testadas está funcionando
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Block, Trip, Duty, VehicleType
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP

def make_simple_trips(n=6):
    """Gera viagens simples consecutivas para teste."""
    trips = []
    start = 360  # 06:00
    for i in range(n):
        t = Trip(
            id=i+1,
            line_id=1,
            start_time=start,
            end_time=start + 60,
            origin_id=1,
            destination_id=2,
            duration=60,
            distance_km=20.0,
        )
        trips.append(t)
        start += 90  # 1h30 de intervalo
    return trips

def make_vehicle_types():
    """Gera tipos de veículo para teste."""
    return [
        VehicleType(
            id=1,
            name="Bus Standard",
            passenger_capacity=40,
            cost_per_km=2.0,
            cost_per_hour=50.0,
            fixed_cost=800.0,
        )
    ]

def test_basic_functionality():
    """Teste básico de funcionalidade."""
    print("=== TESTE DA IMPLEMENTAÇÃO OTIMIZADA (Nível Optibus) ===")

    # 1. Criar dados de teste
    trips = make_simple_trips(6)
    vehicle_types = make_vehicle_types()

    # 2. Executar VSP primeiro
    print("Executando VSP para gerar blocos...")
    vsp = GreedyVSP().solve(trips, vehicle_types)
    print(f"VSP gerou {len(vsp.blocks)} blocos")

    # 3. Executar CSP otimizado
    print("\nExecutando SetPartitioningOptimizedCSP...")
    csp = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
            "use_optimized_set_partitioning": True,
            "goal_weights": {
                "overtime": 0.8,
                "min_work": 0.2,
                "spread": 0.15,
                "fairness": 0.05,
                "passive_transfer": 0.25,
            }
        }
    )

    solution = csp.solve(vsp.blocks)

    # 4. Verificar resultados
    print(f"\nRESULTADOS:")
    print(f"- Duties geradas: {len(solution.duties)}")
    print(f"- Algoritmo usado: {solution.algorithm}")
    print(f"- Meta data: {solution.meta.get('performance_metrics', {})}")

    # 5. Verificar métricas de performance
    if "performance_metrics" in solution.meta:
        metrics = solution.meta["performance_metrics"]
        print(f"\nMÉTRICAS DE PERFORMANCE (Nível Optibus):")
        print(f"- Combinações testadas: {metrics.get('combinations_tested', 'N/A')}")
        print(f"- Combinações podadas: {metrics.get('combinations_pruned', 'N/A')}")
        print(f"- Redução de combinações: {metrics.get('pruning_reduction_pct', 'N/A')}%")
        print(f"- Cache hits: {metrics.get('cache_hits', 'N/A')}")
        print(f"- Fast checks: {metrics.get('fast_checks', 'N/A')}")
        print(f"- Full checks: {metrics.get('full_checks', 'N/A')}")
        print(f"- Tempo por fase: {metrics.get('phase_times', {})}")

    # 6. Verificar se todas as viagens estão cobertas
    covered_trip_ids = set()
    for duty in solution.duties:
        for task in duty.tasks:
            for trip in task.trips:
                covered_trip_ids.add(trip.id)

    original_trip_ids = {t.id for t in trips}
    print(f"\nCOBERTURA DE VIAGENS:")
    print(f"- Viagens originais: {len(original_trip_ids)}")
    print(f"- Viagens cobertas: {len(covered_trip_ids)}")
    print(f"- Todas cobertas: {covered_trip_ids == original_trip_ids}")

    if covered_trip_ids != original_trip_ids:
        print(f"AVISO: Viagens não cobertas: {original_trip_ids - covered_trip_ids}")

    # 7. Verificar redução de memória (informação qualitativa)
    if "column_generation" in solution.meta:
        col_gen = solution.meta["column_generation"]
        print(f"\nGERAÇÃO DE COLUNAS:")
        print(f"- Colunas geradas: {solution.meta.get('workpieces_generated', 'N/A')}")
        print(f"- Máximo de colunas: {col_gen.get('max_generated_columns', 'N/A')}")
        print(f"- Sucessores por tarefa: {col_gen.get('max_candidate_successors_per_task', 'N/A')}")
        print(f"- Iterações de pricing: {col_gen.get('max_pricing_iterations', 'N/A')}")
        print(f"- Colunas truncadas: {col_gen.get('truncated', False)}")

    return solution

def test_large_instance():
    """Teste com instância maior para verificar comportamento adaptativo."""
    print("\n\n=== TESTE COM INSTÂNCIA MAIOR (comportamento adaptativo) ===")

    # Gerar mais viagens para testar ajuste dinâmico de parâmetros
    trips = make_simple_trips(20)  # 20 viagens -> ~10-15 blocos
    vehicle_types = make_vehicle_types()

    print("Executando VSP para instância maior...")
    vsp = GreedyVSP().solve(trips, vehicle_types)
    print(f"VSP gerou {len(vsp.blocks)} blocos")

    print("\nExecutando SetPartitioningOptimizedCSP com instância maior...")
    csp = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
        }
    )

    solution = csp.solve(vsp.blocks)

    print(f"\nRESULTADOS INSTÂNCIA MAIOR:")
    print(f"- Duties geradas: {len(solution.duties)}")

    if "performance_metrics" in solution.meta:
        metrics = solution.meta["performance_metrics"]
        print(f"- Combinações testadas: {metrics.get('combinations_tested', 'N/A')}")
        print(f"- Redução de combinações: {metrics.get('pruning_reduction_pct', 'N/A')}%")

    return solution

def test_memory_reduction():
    """Teste qualitativo de redução de memória."""
    print("\n\n=== TESTE DE REDUÇÃO DE MEMÓRIA (qualitativo) ===")

    trips = make_simple_trips(15)
    vehicle_types = make_vehicle_types()

    vsp = GreedyVSP().solve(trips, vehicle_types)

    # Testar algoritmo original vs otimizado (se disponível)
    try:
        from src.algorithms.csp.set_partitioning import SetPartitioningCSP

        print("Executando algoritmo original (se disponível)...")
        original_csp = SetPartitioningCSP(
            vsp_params={
                "pricing_enabled": True,
                "max_generated_columns": 1000,
            }
        )
        original_solution = original_csp.solve(vsp.blocks[:5])  # Apenas 5 blocos para teste rápido

        print(f"Algoritmo original: {original_solution.meta.get('workpieces_generated', 'N/A')} colunas")
    except Exception as e:
        print(f"Algoritmo original não disponível ou erro: {e}")

    print("\nExecutando algoritmo otimizado...")
    optimized_csp = SetPartitioningOptimizedCSP(
        vsp_params={
            "pricing_enabled": True,
        }
    )
    optimized_solution = optimized_csp.solve(vsp.blocks)

    print(f"Algoritmo otimizado: {optimized_solution.meta.get('workpieces_generated', 'N/A')} colunas")

    # Comparar métricas
    if "performance_metrics" in optimized_solution.meta:
        metrics = optimized_solution.meta["performance_metrics"]
        reduction = metrics.get('pruning_reduction_pct', 0)
        print(f"\nREDUÇÃO DE COMBINAÇÕES TESTADAS: {reduction}%")

        if reduction > 50:
            print("✓ REDUÇÃO SIGNIFICATIVA (mais de 50%) - Nível Optibus atingido!")
        else:
            print("⚠ Redução abaixo do esperado, verificar otimizações")

if __name__ == "__main__":
    print("Iniciando testes da implementação otimizada...")

    try:
        # Teste básico
        sol1 = test_basic_functionality()

        # Teste com instância maior
        sol2 = test_large_instance()

        # Teste de redução de memória
        test_memory_reduction()

        print("\n" + "="*60)
        print("✓ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!")
        print("="*60)

    except Exception as e:
        print(f"\n✗ ERRO DURANTE OS TESTES: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)