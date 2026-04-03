"""
VSP — Algoritmo Genético (GA).

Representação cromossômica:
  chromosome[i] = índice da viagem que a viagem i segue no roteiro
                  Se chromosome[i] == -1, a viagem i inicia um novo bloco.

Operadores:
  - Seleção por torneio (k=3)
  - Cruzamento por ponto (Order Crossover adaptado para blocos)
  - Mutação: troca de atribuição de veículo / reordenação local
  - Elitismo: 10% melhores sobrevivem diretamente
"""
from __future__ import annotations

import random
from copy import deepcopy
from typing import Dict, List, Optional, Tuple

from ...core.config import get_settings
from ...core.exceptions import InfeasibleProblemError
from ...domain.interfaces import IVSPAlgorithm
from ...domain.models import Block, Trip, VehicleType, VSPSolution
from ..base import BaseAlgorithm
from ..evaluator import CostEvaluator
from ..utils import quick_cost_sorted, sort_block_trips, blocks_are_feasible
from .greedy import GreedyVSP

settings = get_settings()
evaluator = CostEvaluator()

# Tipo: lista de IDs de viagem ordenados em cada bloco (cromossomo = lista de listas)
Chromosome = List[List[int]]


def _trips_by_id(trips: List[Trip]) -> Dict[int, Trip]:
    return {t.id: t for t in trips}


def _chromosome_from_blocks(blocks: List[Block]) -> Chromosome:
    return [[t.id for t in b.trips] for b in blocks]


def _blocks_from_chromosome(
    chrom: Chromosome,
    trip_map: Dict[int, Trip],
    vehicle_types: List[VehicleType],
    start_id: int = 1,
) -> List[Block]:
    blocks = []
    for i, seq in enumerate(chrom):
        block_trips = [trip_map[tid] for tid in seq if tid in trip_map]
        if block_trips:
            b = Block(id=start_id + i, trips=block_trips)
            if vehicle_types:
                b.vehicle_type_id = vehicle_types[0].id
            blocks.append(b)
    return blocks


def _fitness(chrom: Chromosome, trip_map: Dict[int, Trip], vt: List[VehicleType]) -> float:
    """Menor custo estimado = maior fitness (retorna negativo do custo).
    Penaliza fortemente blocos inviáveis (corrige B3).
    """
    blocks = _blocks_from_chromosome(chrom, trip_map, vt)
    sort_block_trips(blocks)  # CORREÇÃO B1: ordena antes de avaliar
    # Penaliza viagens não cobertas
    covered = {tid for seq in chrom for tid in seq}
    missing = len(trip_map) - len(covered)
    base_cost = quick_cost_sorted(blocks)  # usa função corrigida
    # Penalidade extra por duplicatas (CORREÇÃO B2)
    all_tids = [tid for seq in chrom for tid in seq]
    duplicates = len(all_tids) - len(set(all_tids))
    return -(base_cost + missing * 5000.0 + duplicates * 10000.0)


def _tournament(population: List[Chromosome], scores: List[float], k: int = 3) -> Chromosome:
    k = min(k, len(population))
    contestants = random.sample(range(len(population)), k)
    best = max(contestants, key=lambda i: scores[i])
    return deepcopy(population[best])


def _repair_chromosome(chrom: Chromosome, all_trip_ids: set, trip_map: Dict[int, Trip] = None) -> Chromosome:
    """
    Repara um cromossomo após crossover/mutação:
    1. Remove trip_ids duplicados (mantém a primeira ocorrência no cromossomo)
    2. Adiciona trip_ids ausentes ao menor bloco existente
    Correção Bug B2: evita trips duplicadas entre blocos.
    """
    seen: set = set()
    repaired: Chromosome = []
    for seq in chrom:
        new_seq = []
        for tid in seq:
            if tid not in seen:
                seen.add(tid)
                new_seq.append(tid)
        if new_seq:
            repaired.append(new_seq)

    # Adiciona trips ausentes ao menor bloco (ou cria novo se não houver blocos)
    missing = all_trip_ids - seen
    if missing:
        # Ordena por start_time para manter viabilidade temporal do bloco
        if trip_map:
            sorted_missing = sorted(missing, key=lambda tid: (trip_map[tid].start_time, tid))
        else:
            sorted_missing = sorted(missing)
        if repaired:
            # Adiciona ao menor bloco existente
            smallest = min(range(len(repaired)), key=lambda i: len(repaired[i]))
            repaired[smallest].extend(sorted_missing)
        else:
            repaired.append(sorted_missing)

    return repaired if repaired else [sorted(all_trip_ids)]


def _crossover(
    parent1: Chromosome, parent2: Chromosome, trip_map: Dict[int, Trip] = None
) -> Tuple[Chromosome, Chromosome]:
    """Troca um bloco aleatório entre pais, com reparo de duplicatas (corrige B2)."""
    if not parent1 or not parent2:
        return deepcopy(parent1), deepcopy(parent2)
    # Coleta todos os trip_ids para reparo
    all_tids = {tid for seq in parent1 for tid in seq}
    all_tids |= {tid for seq in parent2 for tid in seq}

    idx1 = random.randint(0, len(parent1) - 1)
    idx2 = random.randint(0, len(parent2) - 1)
    child1 = deepcopy(parent1)
    child2 = deepcopy(parent2)
    seq1, seq2 = parent1[idx1][:], parent2[idx2][:]
    child1[idx1] = seq2
    child2[idx2] = seq1

    # Repara duplicatas e trips ausentes — CORREÇÃO B2
    child1 = _repair_chromosome(child1, all_tids, trip_map)
    child2 = _repair_chromosome(child2, all_tids, trip_map)
    return child1, child2


def _mutate(chrom: Chromosome, mutation_rate: float, trip_map: Dict[int, Trip] = None) -> Chromosome:
    """Move uma viagem aleatória de um bloco para outro. Re-ordena para garantir factibilidade."""
    if len(chrom) < 2 or random.random() > mutation_rate:
        return chrom
    all_tids = {tid for seq in chrom for tid in seq}
    chrom = deepcopy(chrom)
    src = random.randint(0, len(chrom) - 1)
    if not chrom[src]:
        return chrom
    trip_idx = random.randint(0, len(chrom[src]) - 1)
    trip_id = chrom[src].pop(trip_idx)
    dst = random.randint(0, len(chrom) - 1)
    chrom[dst].append(trip_id)  # Adiciona ao final; fitness/decode vai reordenar por start_time
    # Remove blocos vazios
    chrom = [seq for seq in chrom if seq]
    return _repair_chromosome(chrom, all_tids, trip_map)  # Garante consistência


class GeneticVSP(BaseAlgorithm, IVSPAlgorithm):
    """
    GA para VSP com elitismo 10%, torneio k=3,
    cruzamento de blocos e mutação de realocação.
    """

    def __init__(self, vsp_params=None):
        super().__init__(
            name="genetic_vsp",
            time_budget_s=settings.hybrid_time_budget_seconds,
        )
        self.pop_size = settings.ga_population_size
        self.generations = settings.ga_generations
        self.mutation_rate = settings.ga_mutation_rate
        self.vsp_params = vsp_params or {}

    def solve(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depot_id: Optional[int] = None,
    ) -> VSPSolution:
        self._start_timer()
        if not trips:
            return VSPSolution(algorithm=self.name)

        trip_map = _trips_by_id(trips)

        # Semente inicial — greedy já factível
        seed = GreedyVSP(vsp_params=self.vsp_params).solve(trips, vehicle_types)
        seed_chrom = _chromosome_from_blocks(seed.blocks)

        # Gera população inicial variando o greedy
        population: List[Chromosome] = [seed_chrom]
        for _ in range(self.pop_size - 1):
            shuffled = deepcopy(seed_chrom)
            random.shuffle(shuffled)
            population.append(shuffled)

        best_chrom = deepcopy(seed_chrom)
        best_score = _fitness(best_chrom, trip_map, vehicle_types)

        elitism_n = max(1, self.pop_size // 10)

        for gen in range(self.generations):
            if self._check_timeout():
                break

            scores = [_fitness(c, trip_map, vehicle_types) for c in population]

            # Elitismo
            elite_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:elitism_n]
            new_pop: List[Chromosome] = [deepcopy(population[i]) for i in elite_idx]

            # Reprodução
            while len(new_pop) < self.pop_size:
                p1 = _tournament(population, scores)
                p2 = _tournament(population, scores)
                c1, c2 = _crossover(p1, p2, trip_map)
                new_pop.append(_mutate(c1, self.mutation_rate, trip_map))
                if len(new_pop) < self.pop_size:
                    new_pop.append(_mutate(c2, self.mutation_rate, trip_map))

            population = new_pop
            gen_best_idx = max(range(len(population)), key=lambda i: _fitness(population[i], trip_map, vehicle_types))
            gen_best_score = _fitness(population[gen_best_idx], trip_map, vehicle_types)
            if gen_best_score > best_score:
                best_score = gen_best_score
                best_chrom = deepcopy(population[gen_best_idx])

        blocks = _blocks_from_chromosome(best_chrom, trip_map, vehicle_types)
        sort_block_trips(blocks)  # CORREÇÃO FINAL B1: garante ordem correta ao retornar

        # CORREÇÃO FINAL B6: divide blocos com viagens incompatíveis em sub-blocos
        _next_id = max((b.id for b in blocks), default=0) + 1
        repaired: List[Block] = []
        for b in blocks:
            if not b.trips:
                continue
            cur_trips = [b.trips[0]]
            for t in b.trips[1:]:
                prev = cur_trips[-1]
                gap = t.start_time - prev.end_time
                dest, orig = prev.destination_id, t.origin_id
                needed = int(prev.deadhead_times.get(orig, 0))
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
            algorithm=self.name,
            iterations=self.generations,
            elapsed_ms=self._elapsed_ms(),
        )
