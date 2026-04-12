"""
VSP — Simulated Annealing (SA).

Estado: lista de blocos (VSPSolution.blocks).
Vizinhança: três operadores de perturbação
  1. Reloc  — move 1 viagem para outro bloco
  2. Swap2  — troca 1 viagem entre dois blocos distintos
  3. Split  — divide um bloco em dois em posição aleatória
Aceita soluções piores com P = exp(-Δcost / T).
"""
from __future__ import annotations

import math
import random
from typing import List, Optional

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


def _quick_cost(
    blocks: List[Block],
    fixed_vehicle_cost: float = 800.0,
    idle_cost_per_minute: float = 0.5,
    max_work_minutes: float = 480.0,
    crew_cost_weight: float = 400.0,
) -> float:
    """Estimativa de custo parametrizável (vehicle + idle + crew)."""
    return quick_cost_sorted(blocks, fixed_vehicle_cost, idle_cost_per_minute,
                             max_work_minutes, crew_cost_weight)


def _reloc(blocks: List[Block], min_gap: int = 8) -> List[Block]:
    """Move 1 viagem aleatória de um bloco para outro. Re-ordena e valida (corrige B1)."""
    if len(blocks) < 2:
        return blocks
    original = blocks
    blocks = _copy_blocks(blocks)
    src = random.randint(0, len(blocks) - 1)
    if not blocks[src].trips:
        return original
    trip_idx = random.randint(0, len(blocks[src].trips) - 1)
    trip = blocks[src].trips.pop(trip_idx)
    dst = random.choice([i for i in range(len(blocks)) if i != src])
    blocks[dst].trips.append(trip)  # Adiciona ao final, depois ordena
    blocks = [b for b in blocks if b.trips]
    sort_block_trips(blocks)  # CORREÇÃO B1: ordena por start_time
    if not blocks_are_feasible(blocks, min_gap):  # Rejeita movimentos inviáveis
        return original
    return blocks


def _swap2(blocks: List[Block], min_gap: int = 8) -> List[Block]:
    """Troca 1 viagem entre dois blocos distintos. Re-ordena e valida (corrige B1)."""
    if len(blocks) < 2:
        return blocks
    original = blocks
    blocks = _copy_blocks(blocks)
    i, j = random.sample(range(len(blocks)), 2)
    if not blocks[i].trips or not blocks[j].trips:
        return original
    ii = random.randint(0, len(blocks[i].trips) - 1)
    jj = random.randint(0, len(blocks[j].trips) - 1)
    blocks[i].trips[ii], blocks[j].trips[jj] = blocks[j].trips[jj], blocks[i].trips[ii]
    sort_block_trips(blocks)  # CORREÇÃO B1: re-ordena por start_time
    if not blocks_are_feasible(blocks, min_gap):  # Rejeita movimentos inviáveis
        return original
    return blocks


def _split(blocks: List[Block], next_id: int) -> List[Block]:
    """Divide um bloco aleatório em dois na posição aleatória."""
    if not blocks:
        return blocks
    blocks = _copy_blocks(blocks)
    idx = random.randint(0, len(blocks) - 1)
    if len(blocks[idx].trips) < 2:
        return blocks
    cut = random.randint(1, len(blocks[idx].trips) - 1)
    new_block = Block(id=next_id, trips=blocks[idx].trips[cut:])
    blocks[idx].trips = blocks[idx].trips[:cut]
    if new_block.trips:
        new_block.vehicle_type_id = blocks[idx].vehicle_type_id
        new_block.meta = dict(blocks[idx].meta)
        blocks.append(new_block)
    return blocks


def _merge(blocks: List[Block], min_gap: int = 8) -> List[Block]:
    """Combina dois blocos em um, reduzindo o número de veículos."""
    if len(blocks) < 2:
        return blocks
    original = blocks
    blocks = _copy_blocks(blocks)
    i, j = random.sample(range(len(blocks)), 2)
    blocks[i].trips.extend(blocks[j].trips)
    del blocks[j]
    sort_block_trips(blocks)
    if not blocks_are_feasible(blocks, min_gap):
        return original
    return blocks


_OPERATORS = [_reloc, _swap2, _split, _merge]


class SimulatedAnnealingVSP(BaseAlgorithm, IVSPAlgorithm):
    """SA para VSP com resfriamento geométrico."""

    def __init__(self, vsp_params=None):
        super().__init__(name="sa_vsp", time_budget_s=settings.hybrid_time_budget_seconds)
        self.initial_temp = float(settings.sa_initial_temp)
        self.cooling_rate = float(settings.sa_cooling_rate)
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

        # Custos parametrizáveis a partir de vsp_params
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
        cost_fn = lambda blks: _quick_cost(blks, fvc, icpm, max_work, crew_cw) + preferred_pair_penalty(
            blks,
            preferred_pairs,
            pair_break_penalty,
            paired_trip_bonus,
            hard_pairing_penalty,
        )

        # Estado inicial via Greedy
        current_sol = GreedyVSP(vsp_params=self.vsp_params).solve(trips, vehicle_types)
        current_blocks = _copy_blocks(current_sol.blocks)
        current_cost = cost_fn(current_blocks)

        best_blocks = _copy_blocks(current_blocks)
        best_cost = current_cost

        min_temp = 0.1
        iteration = 0
        restarts = 0

        # Multi-restart: when cooling finishes but budget remains, reheat
        while not self._check_timeout():
            temp = self.initial_temp
            # On restart, perturb from best known solution
            if restarts > 0:
                current_blocks = _copy_blocks(best_blocks)
                current_cost = best_cost
                # Apply random perturbations to escape local optima
                for _ in range(min(5 + restarts, 20)):
                    op = random.choice(_OPERATORS)
                    if op is _split:
                        perturbed = _split(current_blocks, self._next_block_id())
                    else:
                        perturbed = op(current_blocks, min_gap)
                    if perturbed:
                        current_blocks = perturbed
                        current_cost = cost_fn(current_blocks)

            while temp > min_temp and not self._check_timeout():
                iteration += 1

                # Escolhe operador + aplica
                op = random.choice(_OPERATORS)
                if op is _split:
                    candidate = _split(current_blocks, self._next_block_id())
                else:
                    candidate = op(current_blocks, min_gap)  # type: ignore[operator]

                if not candidate:
                    temp *= self.cooling_rate
                    continue

                candidate_cost = cost_fn(candidate)
                delta = candidate_cost - current_cost

                if delta < 0 or math.exp(-delta / temp) > random.random():
                    current_blocks = candidate
                    current_cost = candidate_cost

                if current_cost < best_cost:
                    best_blocks = _copy_blocks(current_blocks)
                    best_cost = current_cost

                temp *= self.cooling_rate

            restarts += 1

        sort_block_trips(best_blocks)  # Garante ordenação final (CORREÇÃO B1)
        return VSPSolution(
            blocks=best_blocks,
            algorithm=self.name,
            iterations=iteration,
            elapsed_ms=self._elapsed_ms(),
            meta={"restarts": restarts},
        )
