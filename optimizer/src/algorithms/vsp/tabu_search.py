"""
VSP — Tabu Search (TS).

Vizinhança: Reloc (mover 1 viagem entre blocos).
Lista tabu: conjunto de (trip_id, bloco_origem_id) recentemente movidos — evita reversões.
Critério de aspiração: aceita movimento tabu se melhora o global.
"""
from __future__ import annotations

import random
from collections import deque
from copy import deepcopy
from typing import Deque, List, Optional, Tuple

from ...core.config import get_settings
from ...domain.interfaces import IVSPAlgorithm
from ...domain.models import Block, Trip, VehicleType, VSPSolution
from ..base import BaseAlgorithm
from ..utils import quick_cost_sorted, sort_block_trips, blocks_are_feasible
from .greedy import GreedyVSP
from .simulated_annealing import _quick_cost

settings = get_settings()

# Move: (trip_id, from_block_id, to_block_id, insert_pos) — hashable
Move = Tuple[int, int, int, int]


def _generate_reloc_neighbours(blocks: List[Block], sample_n: int = 30) -> List[Tuple[Move, List[Block]]]:
    """Gera até `sample_n` vizinhos via Relocation."""
    if len(blocks) < 2:
        return []
    neighbours = []
    attempts = min(sample_n, len(blocks) * max(len(b.trips) for b in blocks if b.trips))
    seen: set = set()

    for _ in range(attempts * 3):
        if len(neighbours) >= sample_n:
            break
        src_idx = random.randint(0, len(blocks) - 1)
        if not blocks[src_idx].trips:
            continue
        dst_idx = random.choice([i for i in range(len(blocks)) if i != src_idx])
        trip_pos = random.randint(0, len(blocks[src_idx].trips) - 1)
        insert_pos = random.randint(0, len(blocks[dst_idx].trips))
        key = (src_idx, trip_pos, dst_idx, insert_pos)
        if key in seen:
            continue
        seen.add(key)

        new_blocks = deepcopy(blocks)
        trip = new_blocks[src_idx].trips.pop(trip_pos)
        new_blocks[dst_idx].trips.append(trip)  # Adiciona ao final, depois ordena
        new_blocks = [b for b in new_blocks if b.trips]
        sort_block_trips(new_blocks)  # CORREÇÃO B1: ordena por start_time
        if not blocks_are_feasible(new_blocks):  # Rejeita vizinhos inviáveis
            continue

        move: Move = (trip.id, blocks[src_idx].id, blocks[dst_idx].id, insert_pos)
        neighbours.append((move, new_blocks))

    return neighbours


class TabuSearchVSP(BaseAlgorithm, IVSPAlgorithm):
    """Busca Tabu para VSP com lista circular e critério de aspiração."""

    def __init__(self, vsp_params=None):
        super().__init__(name="tabu_vsp", time_budget_s=settings.hybrid_time_budget_seconds)
        self.tabu_size = settings.ts_tabu_size
        self.max_iterations = settings.ts_max_iterations
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

        current_blocks = deepcopy(GreedyVSP(vsp_params=self.vsp_params).solve(trips, vehicle_types).blocks)
        current_cost = _quick_cost(current_blocks)
        best_blocks = deepcopy(current_blocks)
        best_cost = current_cost

        tabu_list: Deque[Move] = deque(maxlen=self.tabu_size)
        iteration = 0
        stale_count = 0

        # Use time budget instead of fixed max_iterations
        while not self._check_timeout():
            iteration += 1

            neighbours = _generate_reloc_neighbours(current_blocks, sample_n=40)
            if not neighbours:
                # Diversification: perturb and continue
                stale_count += 1
                if stale_count > 10:
                    break
                continue

            # Ordena por custo, aplica lista tabu + aspiração
            scored = [(move, nb, _quick_cost(nb)) for move, nb in neighbours]
            scored.sort(key=lambda x: x[2])

            chosen_move = None
            chosen_blocks = None
            chosen_cost = float("inf")

            for move, nb, cost in scored:
                if move not in tabu_list or cost < best_cost:  # Aspiração
                    chosen_move = move
                    chosen_blocks = nb
                    chosen_cost = cost
                    break

            if chosen_blocks is None:
                # Força o melhor mesmo tabu (diversificação)
                chosen_move, chosen_blocks, chosen_cost = scored[0]

            tabu_list.append(chosen_move)  # type: ignore[arg-type]
            current_blocks = chosen_blocks  # type: ignore[assignment]
            current_cost = chosen_cost

            if current_cost < best_cost:
                best_blocks = deepcopy(current_blocks)
                best_cost = current_cost
                stale_count = 0
            else:
                stale_count += 1

            # Diversification restart if stagnant
            if stale_count > 25:
                current_blocks = deepcopy(best_blocks)
                current_cost = best_cost
                tabu_list.clear()
                stale_count = 0

        sort_block_trips(best_blocks)  # Garante ordenação final (CORREÇÃO B1)
        return VSPSolution(
            blocks=best_blocks,
            algorithm=self.name,
            iterations=iteration,
            elapsed_ms=self._elapsed_ms(),
        )
