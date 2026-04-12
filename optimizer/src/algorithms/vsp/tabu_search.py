"""
VSP — Tabu Search (TS).

Vizinhança: Reloc (mover 1 viagem entre blocos).
Lista tabu: conjunto de (trip_id, bloco_origem_id) recentemente movidos — evita reversões.
Critério de aspiração: aceita movimento tabu se melhora o global.
"""
from __future__ import annotations

import random
from collections import deque
from typing import Deque, List, Optional, Tuple

from ...core.config import get_settings
from ...domain.interfaces import IVSPAlgorithm
from ...domain.models import Block, Trip, VehicleType, VSPSolution


def _copy_blocks(blocks: List[Block]) -> List[Block]:
    """Shallow copy: new list + new Block/trips-list wrappers, shared Trip refs."""
    return [Block(id=b.id, trips=list(b.trips), vehicle_type_id=b.vehicle_type_id,
                  warnings=b.warnings, meta=dict(b.meta)) for b in blocks]
from ..base import BaseAlgorithm
from ..utils import blocks_are_feasible, preferred_pair_penalty, quick_cost_sorted, sort_block_trips
from .greedy import GreedyVSP, build_preferred_pairs

settings = get_settings()

# Move: (trip_id, from_block_id, to_block_id, insert_pos) — hashable
Move = Tuple[int, int, int, int]


def _generate_reloc_neighbours(blocks: List[Block], sample_n: int = 30, min_gap: int = 8) -> List[Tuple[Move, List[Block]]]:
    """Gera até `sample_n` vizinhos via Relocation e Merge."""
    if len(blocks) < 2:
        return []
    neighbours = []
    attempts = min(sample_n, len(blocks) * max((len(b.trips) for b in blocks if b.trips), default=1))
    seen: set = set()

    # Reloc neighbours
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

        new_blocks = _copy_blocks(blocks)
        trip = new_blocks[src_idx].trips.pop(trip_pos)
        new_blocks[dst_idx].trips.append(trip)
        new_blocks = [b for b in new_blocks if b.trips]
        sort_block_trips(new_blocks)
        if not blocks_are_feasible(new_blocks, min_gap):
            continue

        move: Move = (trip.id, blocks[src_idx].id, blocks[dst_idx].id, insert_pos)
        neighbours.append((move, new_blocks))

    # Merge neighbours — tenta combinar pares de blocos
    merge_tries = min(sample_n // 3, len(blocks) * (len(blocks) - 1) // 2)
    for _ in range(merge_tries):
        if len(neighbours) >= sample_n + merge_tries:
            break
        i, j = random.sample(range(len(blocks)), 2)
        merge_key = ("merge", min(blocks[i].id, blocks[j].id), max(blocks[i].id, blocks[j].id), 0)
        if merge_key in seen:
            continue
        seen.add(merge_key)
        new_blocks = _copy_blocks(blocks)
        new_blocks[i].trips.extend(new_blocks[j].trips)
        del new_blocks[j]
        sort_block_trips(new_blocks)
        if not blocks_are_feasible(new_blocks, min_gap):
            continue
        move: Move = (-1, blocks[j].id, blocks[i].id, -1)  # sentinel -1 distinguishes merge from reloc
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
        random_seed = self.vsp_params.get("random_seed")
        if random_seed is not None:
            random.seed(int(random_seed))

        # Custos parametrizáveis
        fvc = float(self.vsp_params.get("fixed_vehicle_activation_cost", 800.0))
        icpm = float(self.vsp_params.get("idle_cost_per_minute", 0.5))
        max_work = float(self.vsp_params.get("max_work_minutes", 480.0))
        crew_cw = float(self.vsp_params.get("crew_cost_weight", fvc * 0.5))
        pair_break_penalty = float(self.vsp_params.get("pair_break_penalty", fvc * 1.25))
        paired_trip_bonus = float(self.vsp_params.get("paired_trip_bonus", fvc * 0.05))
        min_gap = int(self.vsp_params.get("min_layover_minutes", 8) or 8)
        preferred_pairs = (
            build_preferred_pairs(
                trips,
                int(self.vsp_params.get("min_layover_minutes", 8) or 8),
                int(self.vsp_params.get("preferred_pair_window_minutes", 120) or 120),
            )
            if bool(self.vsp_params.get("preserve_preferred_pairs", True))
            else {}
        )
        hard_pairing_penalty = (
            float(self.vsp_params.get("hard_pairing_penalty", max(pair_break_penalty * 10.0, fvc * 25.0)))
            if bool(self.vsp_params.get("hard_pairing_vehicle_level", False))
            else 0.0
        )
        cost_fn = lambda blks: quick_cost_sorted(blks, fvc, icpm, max_work, crew_cw) + preferred_pair_penalty(
            blks,
            preferred_pairs,
            pair_break_penalty,
            paired_trip_bonus,
            hard_pairing_penalty,
        )

        current_blocks = _copy_blocks(GreedyVSP(vsp_params=self.vsp_params).solve(trips, vehicle_types).blocks)
        current_cost = cost_fn(current_blocks)
        best_blocks = _copy_blocks(current_blocks)
        best_cost = current_cost

        tabu_list: Deque[Move] = deque(maxlen=self.tabu_size)
        iteration = 0
        stale_count = 0

        # Use time budget instead of fixed max_iterations
        while not self._check_timeout():
            iteration += 1

            neighbours = _generate_reloc_neighbours(current_blocks, sample_n=40, min_gap=min_gap)
            if not neighbours:
                # Diversification: perturb and continue
                stale_count += 1
                if stale_count > 10:
                    break
                continue

            # Ordena por custo, aplica lista tabu + aspiração
            scored = [(move, nb, cost_fn(nb)) for move, nb in neighbours]
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
                best_blocks = _copy_blocks(current_blocks)
                best_cost = current_cost
                stale_count = 0
            else:
                stale_count += 1

            # Diversification restart if stagnant
            if stale_count > 25:
                current_blocks = _copy_blocks(best_blocks)
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
