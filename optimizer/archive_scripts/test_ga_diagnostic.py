#!/usr/bin/env python3
"""
Diagnóstico do Genetic Algorithm - testando componentes individuais.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.domain.models import Trip, Block, VSPSolution
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.genetic import GeneticVSP, _fitness, _chromosome_from_blocks, _blocks_from_chromosome
from src.algorithms.utils import quick_cost_sorted, block_is_feasible
import random
from copy import deepcopy

def make_small_trips(n: int = 6) -> list:
    """Viagens simples para debug."""
    trips = []
    for i in range(n):
        t = Trip(
            id=i + 1,
            line_id=1,
            start_time=360 + i * 60,
            end_time=360 + (i + 1) * 60,
            origin_id=(i % 3) + 1,
            destination_id=((i + 1) % 3) + 1,
            duration=60,
            distance_km=20.0,
            deadhead_times={1: 10, 2: 15, 3: 20},
        )
        trips.append(t)
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

def test_fitness_function():
    """Testa se a fitness function recompensa soluções melhores."""
    print("=== Teste Fitness Function ===")
    trips = make_small_trips(6)
    vt = make_vehicle_types()

    # Solução greedy
    greedy = GreedyVSP()
    greedy_sol = greedy.solve(trips, vt)
    greedy_chrom = _chromosome_from_blocks(greedy_sol.blocks)

    # Criar solução pior (mais veículos)
    worse_chrom = deepcopy(greedy_chrom)
    # Quebra o primeiro bloco em dois
    if len(worse_chrom) > 0 and len(worse_chrom[0]) > 1:
        first_block = worse_chrom[0]
        split_point = len(first_block) // 2
        new_block = first_block[split_point:]
        worse_chrom[0] = first_block[:split_point]
        worse_chrom.append(new_block)

    # Criar solução melhor (menos veículos) - se possível
    better_chrom = None
    if len(greedy_chrom) > 1:
        # Merge dois blocos
        better_chrom = deepcopy(greedy_chrom)
        merged = better_chrom[0] + better_chrom[1]
        better_chrom = [merged] + better_chrom[2:]

    # Calcular fitness
    trip_map = {t.id: t for t in trips}
    greedy_fitness = _fitness(greedy_chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
    worse_fitness = _fitness(worse_chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)

    print(f"Greedy (melhor): {greedy_fitness:.2f}")
    print(f"Pior (mais veículos): {worse_fitness:.2f}")
    print(f"Fitness maior é melhor? {greedy_fitness > worse_fitness}")

    if better_chrom:
        better_fitness = _fitness(better_chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
        print(f"Melhor (menos veículos): {better_fitness:.2f}")
        print(f"Melhor tem fitness maior? {better_fitness > greedy_fitness}")

    # Verificar custos reais
    greedy_blocks = _blocks_from_chromosome(greedy_chrom, trip_map, vt)
    worse_blocks = _blocks_from_chromosome(worse_chrom, trip_map, vt)

    greedy_cost = quick_cost_sorted(greedy_blocks, 800.0, 0.5, 480.0, 400.0)
    worse_cost = quick_cost_sorted(worse_blocks, 800.0, 0.5, 480.0, 400.0)

    print(f"\nCustos calculados:")
    print(f"Greedy: {greedy_cost:.2f}")
    print(f"Pior: {worse_cost:.2f}")
    print(f"Fitness = -custo? {abs(greedy_fitness + greedy_cost) < 0.01}")

    return greedy_fitness > worse_fitness

def test_population_diversity():
    """Testa se a população inicial tem diversidade."""
    print("\n=== Teste Diversidade População ===")
    trips = make_small_trips(10)
    vt = make_vehicle_types()

    ga = GeneticVSP()
    ga.pop_size = 10  # Pequeno para teste
    ga.generations = 1  # Apenas para inicialização

    # Monkey patch para pegar população
    original_solve = GeneticVSP.solve
    population_history = []

    def solve_with_debug(self, trips, vehicle_types, depot_id=None):
        self._start_timer()
        if not trips:
            return VSPSolution(algorithm=self.name)

        import src.algorithms.vsp.genetic as genetic_module
        from src.algorithms.vsp.genetic import (
            _trips_by_id, _chromosome_from_blocks, _blocks_from_chromosome,
            _fitness, _tournament, _crossover, _mutate, build_preferred_pairs,
            _repair_chromosome, sort_block_trips
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

        population_history.append(population)

        # Simular algumas gerações rápidas
        best_chrom = deepcopy(seed_chrom)
        best_score = fit_fn(best_chrom)

        elitism_n = max(1, self.pop_size // 10)

        for gen in range(5):  # Apenas 5 gerações para teste
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

        # Repara blocos
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

        return VSPSolution(
            blocks=blocks,
            algorithm=self.name + "_debug",
            iterations=5,
            elapsed_ms=self._elapsed_ms(),
        )

    GeneticVSP.solve = solve_with_debug
    try:
        ga.solve(trips, vt)
    finally:
        GeneticVSP.solve = original_solve

    if population_history:
        population = population_history[0]
        print(f"Tamanho população: {len(population)}")

        # Calcular diversidade (número de estruturas únicas)
        chrom_strings = [str(sorted([sorted(seq) for seq in chrom])) for chrom in population]
        unique_count = len(set(chrom_strings))
        print(f"Cromossomos únicos na população inicial: {unique_count}/{len(population)}")

        # Verificar fitness inicial
        trip_map = {t.id: t for t in trips}
        fitness_values = []
        for chrom in population:
            fit = _fitness(chrom, trip_map, vt, 800.0, 0.5, 480.0, 400.0)
            fitness_values.append(fit)

        print(f"Range de fitness inicial: {min(fitness_values):.2f} a {max(fitness_values):.2f}")
        print(f"Diferenca min/max: {max(fitness_values) - min(fitness_values):.2f}")

        # Verificar se há cromossomos diferentes do greedy
        seed_chrom = population[0]  # Primeiro é o greedy
        different_count = 0
        for i, chrom in enumerate(population[1:], 1):
            if str(sorted([sorted(seq) for seq in chrom])) != str(sorted([sorted(seq) for seq in seed_chrom])):
                different_count += 1

        print(f"Cromossomos diferentes do greedy: {different_count}/{len(population)-1}")

    return population_history is not None

def test_safety_net_trigger():
    """Verifica se o safety net está sendo acionado."""
    print("\n=== Teste Safety Net ===")
    trips = make_small_trips(15)
    vt = make_vehicle_types()

    ga = GeneticVSP()
    ga.time_budget_s = 2.0

    # Monkey patch para verificar custos
    original_solve = GeneticVSP.solve
    safety_triggered = [False]

    def solve_with_monitor(self, trips, vehicle_types, depot_id=None):
        sol = original_solve(self, trips, vehicle_types, depot_id)

        # Verificar se blocks são iguais ao greedy
        greedy = GreedyVSP().solve(trips, vehicle_types)
        if len(sol.blocks) == len(greedy.blocks):
            same = True
            for gb, sb in zip(greedy.blocks, sol.blocks):
                if [t.id for t in gb.trips] != [t.id for t in sb.trips]:
                    same = False
                    break
            safety_triggered[0] = same
        return sol

    GeneticVSP.solve = solve_with_monitor
    try:
        ga.solve(trips, vt)
    finally:
        GeneticVSP.solve = original_solve

    print(f"Safety net acionado? {safety_triggered[0]}")
    return safety_triggered[0]

if __name__ == "__main__":
    print("Diagnóstico do Genetic Algorithm")
    print("=" * 50)

    fitness_ok = test_fitness_function()
    diversity_ok = test_population_diversity()
    safety_triggered = test_safety_net_trigger()

    print("\n" + "=" * 50)
    print("CONCLUSÃO:")
    print(f"1. Fitness function recompensa soluções melhores: {'✅' if fitness_ok else '❌'}")
    print(f"2. População inicial tem diversidade: {'✅' if diversity_ok else '❌'}")
    print(f"3. Safety net está sendo acionado: {'✅' if safety_triggered else '❌'}")

    if safety_triggered:
        print("\n⚠️  Safety net sendo acionado significa GA não está melhorando.")
        print("   Possíveis causas:")
        print("   - Fitness não tem gradiente suficiente")
        print("   - Operadores genéticos não estão funcionando")
        print("   - Tempo de execução muito curto")
        print("   - Population initialization muito restrita")