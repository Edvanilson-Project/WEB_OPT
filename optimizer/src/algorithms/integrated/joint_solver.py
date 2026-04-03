"""
Solver Integrado VSP+CSP.

Estratégia de iteração:
  1. Resolve VSP com o algoritmo configurado.
  2. Resolve CSP sobre os blocos resultantes.
  3. Usa o custo total como sinal de feedback:
     se violações CCT > 0, relança o VSP pedindo blocos menores
     (prefere blocos curtos que facilitem deveres viáveis).
  4. Repete até orçamento de tempo ou 0 violações.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ...core.config import get_settings
from ...core.exceptions import InfeasibleProblemError
from ...domain.interfaces import IIntegratedSolver
from ...domain.models import OptimizationResult, Trip, VehicleType
from ..csp.greedy import GreedyCSP
from ..csp.set_partitioning import SetPartitioningCSP
from ..vsp.greedy import GreedyVSP
from ..vsp.simulated_annealing import SimulatedAnnealingVSP
from ..vsp.tabu_search import TabuSearchVSP
from ..base import BaseAlgorithm
from ..evaluator import CostEvaluator

settings = get_settings()
logger = logging.getLogger(__name__)
evaluator = CostEvaluator()


class JointSolver(BaseAlgorithm, IIntegratedSolver):
    """
    Solver VSP+CSP com loop de feedback iterativo.
    """

    def __init__(
        self,
        vsp_algorithm: str = "tabu",
        csp_algorithm: str = "set_partitioning",
        max_rounds: int = 3,
        cct_params: Optional[Dict[str, Any]] = None,
        vsp_params: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(name="joint_solver", time_budget_s=settings.hybrid_time_budget_seconds)
        self.vsp_algorithm = vsp_algorithm
        self.csp_algorithm = csp_algorithm
        self.max_rounds = max_rounds
        self.cct_params = cct_params or {}
        self.vsp_params = vsp_params or {}

    # ── Seleção de algoritmos por nome ────────────────────────────────────────

    def _vsp_solver(self):
        mapping = {
            "greedy": lambda: GreedyVSP(vsp_params=self.vsp_params),
            "sa": SimulatedAnnealingVSP,
            "tabu": TabuSearchVSP,
        }
        factory = mapping.get(self.vsp_algorithm, TabuSearchVSP)
        return factory() if callable(factory) else factory()

    def _csp_solver(self):
        if self.csp_algorithm == "ilp":
            return SetPartitioningCSP(vsp_params=self.vsp_params, **self.cct_params)
        return GreedyCSP(vsp_params=self.vsp_params, **self.cct_params)

    # ── Solver principal ───────────────────────────────────────────────────────

    def solve(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depot_id: Optional[int] = None,
    ) -> OptimizationResult:
        self._start_timer()
        if not trips:
            raise InfeasibleProblemError("No trips provided")

        best_result: Optional[OptimizationResult] = None

        for round_n in range(self.max_rounds):
            if self._check_timeout():
                break

            logger.info("joint_solver round=%d/%d", round_n + 1, self.max_rounds)

            # 1) VSP
            vsp_sol = self._vsp_solver().solve(trips, vehicle_types, depot_id)

            if not vsp_sol.blocks:
                continue

            # 2) CSP
            csp_sol = self._csp_solver().solve(vsp_sol.blocks, trips)

            # 3) Custo total
            result = OptimizationResult(
                vsp=vsp_sol,
                csp=csp_sol,
                algorithm=self.name,  # type: ignore[arg-type]
                total_elapsed_ms=self._elapsed_ms(),
            )
            result.total_cost = evaluator.total_cost(result, vehicle_types)

            if best_result is None or result.total_cost < best_result.total_cost:
                best_result = result

            # Se sem violações, para cedo
            if csp_sol.cct_violations == 0 and not vsp_sol.unassigned_trips:
                break

        if best_result is None:
            raise InfeasibleProblemError("JointSolver could not find any feasible solution")

        best_result.total_elapsed_ms = self._elapsed_ms()
        return best_result
