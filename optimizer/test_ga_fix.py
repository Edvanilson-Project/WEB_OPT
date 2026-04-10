#!/usr/bin/env python3
"""
Teste para verificar se o Genetic Algorithm funciona sem safety net.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block, VSPSolution
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import GeneticVSP
from src.algorithms.utils import quick_cost_sorted

def make_trips(n: int = 10) -> list:
    """Gera n viagens com alguma complexidade."""
    trips = []
    start = 360  # 06:00
    for i in range(n):
        t = Trip(
            id=i + 1,
            line_id=1,
            start_time=start,
            end_time=start + 60,
            origin_id=(i % 3) + 1,
            destination_id=((i + 1) % 3) + 1,
            duration=60,
            distance_km=20.0,
            deadhead_times={1: 10, 2: 15, 3: 20},
        )
        trips.append(t)
        start += 90  # 1h30 de intervalo
    return trips

def make_vehicle_types():
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
        })()
    ]

def test_ga_without_safety_net():
    """Testa GA com safety net temporariamente desabilitado."""
    trips = make_trips(8)
    vt = make_vehicle_types()

    print("=== Testando Genetic Algorithm ===")
    print(f"Total trips: {len(trips)}")

    # Greedy baseline
    greedy = GreedyVSP()
    greedy_sol = greedy.solve(trips, vt)
    greedy_cost = quick_cost_sorted(greedy_sol.blocks, 800.0, 0.5, 480.0, 400.0)
    print(f"Greedy solution: {greedy_sol.num_vehicles} vehicles, cost: {greedy_cost:.2f}")

    # Genetic with safety net (default)
    ga_default = GeneticVSP()
    ga_default.time_budget_s = 5.0  # tempo curto para teste rápido
    ga_sol_default = ga_default.solve(trips, vt)
    ga_cost_default = quick_cost_sorted(ga_sol_default.blocks, 800.0, 0.5, 480.0, 400.0)
    print(f"GA (com safety net): {ga_sol_default.num_vehicles} vehicles, cost: {ga_cost_default:.2f}")

    # Verificar se é igual ao greedy (safety net ativado)
    blocks_equal = len(ga_sol_default.blocks) == len(greedy_sol.blocks)
    if blocks_equal:
        for i, (gb, sb) in enumerate(zip(ga_sol_default.blocks, greedy_sol.blocks)):
            if len(gb.trips) != len(sb.trips):
                blocks_equal = False
                break
    print(f"GA igual ao greedy? {blocks_equal}")

    # Testar modificando a classe GeneticVSP para desabilitar safety net
    import src.algorithms.vsp.genetic as genetic_module
    original_solve = GeneticVSP.solve

    def solve_without_safety_net(self, trips, vehicle_types, depot_id=None):
        """Versão modificada sem safety net."""
        self._start_timer()
        if not trips:
            return VSPSolution(algorithm=self.name)

        # Copiar código do solve original, mas remover safety net
        import random
        from copy import deepcopy
        from src.algorithms.vsp.genetic import (
            _trips_by_id, _chromosome_from_blocks, _blocks_from_chromosome,
            _fitness, _tournament, _crossover, _mutate, build_preferred_pairs,
            _repair_chromosome, sort_block_trips, preferred_pair_penalty
        )

        trip_map = _trips_by_id(trips)

        fvc = 800.0
        icpm = 0.5
        max_work = 480.0
        crew_cw = 400.0
        pair_break_penalty = 1000.0
        paired_trip_bonus = 40.0
        preferred_pairs = {}
        hard_pairing_penalty = 0.0

        fit_fn = lambda c: _fitness(
            c,
            trip_map,
            vehicle_types,
            fvc,
            icpm,
            max_work,
            crew_cw,
            preferred_pairs,
            pair_break_penalty,
            paired_trip_bonus,
            hard_pairing_penalty,
        )

        # Semente inicial
        seed = GreedyVSP().solve(trips, vehicle_types)
        seed_chrom = _chromosome_from_blocks(seed.blocks)

        # População inicial
        all_tids = {tid for seq in seed_chrom for tid in seq}
        population = [seed_chrom]
        for p in range(self.pop_size - 1):
            variant = deepcopy(seed_chrom)
            n_moves = min(1 + p, len(trips) // 3)
            for _ in range(n_moves):
                if len(variant) < 2:
                    break
                src = random.randint(0, len(variant) - 1)
                if not variant[src]:
                    continue
                tid = variant[src].pop(random.randint(0, len(variant[src]) - 1))
                dst = random.choice([i for i in range(len(variant)) if i != src])
                variant[dst].append(tid)
            variant = [seq for seq in variant if seq]
            if not variant:
                variant = deepcopy(seed_chrom)
            population.append(variant)

        best_chrom = deepcopy(seed_chrom)
        best_score = fit_fn(best_chrom)

        elitism_n = max(1, self.pop_size // 10)

        for gen in range(self.generations):
            if self._check_timeout():
                break

            scores = [fit_fn(c) for c in population]

            # Elitismo
            elite_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:elitism_n]
            new_pop = [deepcopy(population[i]) for i in elite_idx]

            # Reprodução
            while len(new_pop) < self.pop_size:
                p1 = _tournament(population, scores)
                p2 = _tournament(population, scores)
                c1, c2 = _crossover(p1, p2, trip_map)
                new_pop.append(_mutate(c1, self.mutation_rate, trip_map))
                if len(new_pop) < self.pop_size:
                    new_pop.append(_mutate(c2, self.mutation_rate, trip_map))

            population = new_pop
            gen_best_idx = max(range(len(population)), key=lambda i: fit_fn(population[i]))
            gen_best_score = fit_fn(population[gen_best_idx])
            if gen_best_score > best_score:
                best_score = gen_best_score
                best_chrom = deepcopy(population[gen_best_idx])

        blocks = _blocks_from_chromosome(best_chrom, trip_map, vehicle_types)
        sort_block_trips(blocks)

        # Repara blocos com deadhead inviável
        _next_id = max((b.id for b in blocks), default=0) + 1
        repaired = []
        for b in blocks:
            if not b.trips:
                continue
            cur_trips = [b.trips[0]]
            for t in b.trips[1:]:
                prev = cur_trips[-1]
                gap = t.start_time - prev.end_time
                needed = int(prev.deadhead_times.get(t.origin_id, 0))
                if gap < needed:
                    new_b = Block(id=_next_id, trips=list(cur_trips))
                    if b.vehicle_type_id is not None:
                        new_b.vehicle_type_id = b.vehicle_type_id
                    repaired.append(new_b)
                    _next_id += 1
                    cur_trips = [t]
                else:
                    cur_trips.append(t)
            last_b = Block(id=b.id, trips=cur_trips)
            if b.vehicle_type_id is not None:
                last_b.vehicle_type_id = b.vehicle_type_id
            repaired.append(last_b)
        blocks = repaired

        # SEM SAFETY NET - sempre retorna a solução GA
        return VSPSolution(
            blocks=blocks,
            algorithm=self.name + "_no_safety",
            iterations=self.generations,
            elapsed_ms=self._elapsed_ms(),
        )

    # Monkey patch temporário
    GeneticVSP.solve = solve_without_safety_net
    try:
        ga_no_safety = GeneticVSP()
        ga_no_safety.time_budget_s = 5.0
        ga_sol_no_safety = ga_no_safety.solve(trips, vt)
        ga_cost_no_safety = quick_cost_sorted(ga_sol_no_safety.blocks, 800.0, 0.5, 480.0, 400.0)
        print(f"GA (sem safety net): {ga_sol_no_safety.num_vehicles} vehicles, cost: {ga_cost_no_safety:.2f}")

        # Comparar estrutura
        print(f"\n=== Análise ===")
        print(f"Diferença de custo (GA sem safety - Greedy): {ga_cost_no_safety - greedy_cost:.2f}")

        # Verificar diversidade
        ga_trip_assignments = {}
        for i, block in enumerate(ga_sol_no_safety.blocks):
            for trip in block.trips:
                ga_trip_assignments[trip.id] = i

        greedy_trip_assignments = {}
        for i, block in enumerate(greedy_sol.blocks):
            for trip in block.trips:
                greedy_trip_assignments[trip.id] = i

        assignments_different = sum(1 for tid in ga_trip_assignments
                                  if ga_trip_assignments[tid] != greedy_trip_assignments[tid])
        print(f"Viagens com atribuição diferente do greedy: {assignments_different}/{len(trips)}")

    finally:
        # Restaurar método original
        GeneticVSP.solve = original_solve

if __name__ == "__main__":
    test_ga_without_safety_net()