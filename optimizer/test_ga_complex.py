#!/usr/bin/env python3
"""
Teste mais complexo para Genetic Algorithm com muitas viagens e múltiplos veículos.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block, VSPSolution
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import GeneticVSP
from src.algorithms.utils import quick_cost_sorted

def make_complex_trips(n: int = 50) -> list:
    """Gera viagens mais complexas com múltiplos terminais e tempos variados."""
    trips = []
    terminals = list(range(1, 11))  # 10 terminais

    for i in range(n):
        origin = terminals[i % len(terminals)]
        destination = terminals[(i + 1) % len(terminals)]
        start_time = 360 + (i % 20) * 45  # Grupos de 20 viagens com intervalos de 45min
        duration = 30 + (i % 3) * 15  # Duração variada: 30, 45, 60 minutos
        end_time = start_time + duration

        # Deadhead times baseados na distância entre terminais
        deadhead_times = {tid: 10 + abs(tid - origin) * 2 for tid in terminals}

        t = Trip(
            id=i + 1,
            line_id=1 + (i % 5),  # 5 linhas diferentes
            start_time=start_time,
            end_time=end_time,
            origin_id=origin,
            destination_id=destination,
            duration=duration,
            distance_km=15.0 + (i % 10),
            deadhead_times=deadhead_times,
        )
        trips.append(t)
    return trips

def make_vehicle_types():
    """Cria múltiplos tipos de veículo com capacidades diferentes."""
    return [
        type('VehicleType', (), {
            'id': 1,
            'name': 'Bus Standard',
            'passenger_capacity': 40,
            'cost_per_km': 2.0,
            'cost_per_hour': 50.0,
            'fixed_cost': 800.0,
            'is_electric': False,
            'battery_capacity_kwh': 0.0,
            'minimum_soc': 0.15,
            'charge_rate_kw': 0.0,
            'energy_cost_per_kwh': 0.0,
            'depot_id': None,
        })(),
        type('VehicleType', (), {
            'id': 2,
            'name': 'Bus Large',
            'passenger_capacity': 60,
            'cost_per_km': 2.5,
            'cost_per_hour': 60.0,
            'fixed_cost': 1000.0,
            'is_electric': False,
            'battery_capacity_kwh': 0.0,
            'minimum_soc': 0.15,
            'charge_rate_kw': 0.0,
            'energy_cost_per_kwh': 0.0,
            'depot_id': None,
        })(),
    ]

def test_ga_vs_greedy():
    """Compara GA com greedy em problema complexo."""
    trips = make_complex_trips(40)
    vt = make_vehicle_types()

    print("=== Teste Complexo GA vs Greedy ===")
    print(f"Total trips: {len(trips)}")
    print(f"Terminals: 10, Lines: 5, Vehicle types: {len(vt)}")

    # Greedy baseline
    greedy = GreedyVSP()
    greedy_sol = greedy.solve(trips, vt)
    greedy_cost = quick_cost_sorted(greedy_sol.blocks, 800.0, 0.5, 480.0, 400.0)
    print(f"Greedy solution: {greedy_sol.num_vehicles} vehicles, cost: {greedy_cost:.2f}")

    # Genetic with default settings
    ga = GeneticVSP()
    ga.time_budget_s = 10.0  # Mais tempo para problema maior
    ga_sol = ga.solve(trips, vt)
    ga_cost = quick_cost_sorted(ga_sol.blocks, 800.0, 0.5, 480.0, 400.0)
    print(f"GA solution: {ga_sol.num_vehicles} vehicles, cost: {ga_cost:.2f}")

    # Comparação detalhada
    print(f"\n=== Análise Detalhada ===")
    print(f"Diferença de custo (GA - Greedy): {ga_cost - greedy_cost:.2f}")
    print(f"GA melhor? {ga_cost < greedy_cost}")

    # Verificar diferença de estrutura
    greedy_assignments = {}
    for i, block in enumerate(greedy_sol.blocks):
        for trip in block.trips:
            greedy_assignments[trip.id] = i

    ga_assignments = {}
    for i, block in enumerate(ga_sol.blocks):
        for trip in block.trips:
            ga_assignments[trip.id] = i

    assignments_different = sum(1 for tid in ga_assignments
                              if ga_assignments.get(tid) != greedy_assignments.get(tid))
    print(f"Viagens com atribuição diferente: {assignments_different}/{len(trips)}")

    # Distribuição por veículo
    print(f"\nDistribuição de viagens por veículo (Greedy):")
    greedy_counts = {}
    for block in greedy_sol.blocks:
        count = len(block.trips)
        greedy_counts[count] = greedy_counts.get(count, 0) + 1
    for count, num in sorted(greedy_counts.items()):
        print(f"  {count} viagens: {num} veículos")

    print(f"Distribuição de viagens por veículo (GA):")
    ga_counts = {}
    for block in ga_sol.blocks:
        count = len(block.trips)
        ga_counts[count] = ga_counts.get(count, 0) + 1
    for count, num in sorted(ga_counts.items()):
        print(f"  {count} viagens: {num} veículos")

    # Verificar se GA usou tipos de veículo diferentes
    greedy_vtypes = set(b.vehicle_type_id for b in greedy_sol.blocks if b.vehicle_type_id)
    ga_vtypes = set(b.vehicle_type_id for b in ga_sol.blocks if b.vehicle_type_id)
    print(f"Tipos de veículo usados - Greedy: {greedy_vtypes}, GA: {ga_vtypes}")

    return ga_cost < greedy_cost

if __name__ == "__main__":
    ga_better = test_ga_vs_greedy()
    if not ga_better:
        print("\n⚠️  GA não melhorou o greedy. Investigando razões...")
        print("1. Fitness function pode estar penalizando demais")
        print("2. Crossover/mutation podem não estar gerando diversidade suficiente")
        print("3. Population initialization pode ser muito similar ao greedy")
        print("4. Safety net pode estar sendo ativada")