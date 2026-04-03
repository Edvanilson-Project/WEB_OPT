"""
Testes unitários dos algoritmos VSP e CSP.
Execute com: pytest tests/unit/test_algorithms.py -v
"""
import sys
import os

# Garante que o package raiz seja encontrado
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from src.domain.models import Block, Trip, VehicleType
from src.algorithms.vsp.greedy import GreedyVSP
from src.algorithms.vsp.simulated_annealing import SimulatedAnnealingVSP
from src.algorithms.vsp.tabu_search import TabuSearchVSP
from src.algorithms.csp.greedy import GreedyCSP
from src.algorithms.evaluator import CostEvaluator
from src.services.optimizer_service import OptimizerService
from src.domain.models import AlgorithmType


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_trips(n: int = 6) -> list:
    """Gera n viagens simples consecutivas."""
    trips = []
    start = 360  # 06:00
    for i in range(n):
        t = Trip(
            id=i + 1,
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


def make_vehicle_types() -> list:
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


# ── VSP Greedy ────────────────────────────────────────────────────────────────

class TestGreedyVSP:
    def test_returns_solution(self):
        trips = make_trips(4)
        vt = make_vehicle_types()
        sol = GreedyVSP().solve(trips, vt)
        assert sol is not None
        assert sol.num_vehicles > 0

    def test_all_trips_covered(self):
        trips = make_trips(6)
        vt = make_vehicle_types()
        sol = GreedyVSP().solve(trips, vt)
        covered = {t.id for b in sol.blocks for t in b.trips}
        trip_ids = {t.id for t in trips}
        assert covered == trip_ids

    def test_empty_input(self):
        sol = GreedyVSP().solve([], [])
        assert sol.num_vehicles == 0

    def test_single_trip(self):
        trip = Trip(id=1, line_id=1, start_time=360, end_time=420, origin_id=1, destination_id=2)
        sol = GreedyVSP().solve([trip], make_vehicle_types())
        assert sol.num_vehicles == 1
        assert sol.blocks[0].trips[0].id == 1


# ── CSP Greedy ────────────────────────────────────────────────────────────────

class TestGreedyCSP:
    def test_covers_all_blocks(self):
        trips = make_trips(4)
        vsp = GreedyVSP().solve(trips, make_vehicle_types())
        csp = GreedyCSP().solve(vsp.blocks)
        # CSP run-cutting may split blocks into sub-tasks; verify all trip_ids are covered
        covered_trip_ids = {t.id for d in csp.duties for task in d.tasks for t in task.trips}
        original_trip_ids = {t.id for b in vsp.blocks for t in b.trips}
        assert covered_trip_ids == original_trip_ids

    def test_empty_blocks(self):
        csp = GreedyCSP().solve([])
        assert csp.num_crew == 0


# ── SA VSP ────────────────────────────────────────────────────────────────────

class TestSimulatedAnnealingVSP:
    def test_returns_solution(self):
        trips = make_trips(5)
        sa = SimulatedAnnealingVSP()
        sa.time_budget_s = 2.0
        sol = sa.solve(trips, make_vehicle_types())
        assert sol.num_vehicles > 0


# ── Tabu VSP ──────────────────────────────────────────────────────────────────

class TestTabuSearchVSP:
    def test_returns_solution(self):
        trips = make_trips(5)
        ts = TabuSearchVSP()
        ts.time_budget_s = 2.0
        ts.max_iterations = 20
        sol = ts.solve(trips, make_vehicle_types())
        assert sol.num_vehicles > 0


# ── Evaluator ─────────────────────────────────────────────────────────────────

class TestCostEvaluator:
    def test_vsp_cost_positive(self):
        trips = make_trips(3)
        vt = make_vehicle_types()
        sol = GreedyVSP().solve(trips, vt)
        from src.domain.models import VSPSolution, CSPSolution, OptimizationResult
        csp = GreedyCSP().solve(sol.blocks)
        result = OptimizationResult(vsp=sol, csp=csp)
        ev = CostEvaluator()
        cost = ev.total_cost(result, vt)
        assert cost > 0


# ── OptimizerService ──────────────────────────────────────────────────────────

class TestOptimizerService:
    def test_greedy_pipeline(self):
        trips = make_trips(4)
        vt = make_vehicle_types()
        svc = OptimizerService()
        result = svc.run(trips, vt, algorithm=AlgorithmType.GREEDY)
        assert result.vsp.num_vehicles > 0
        assert result.csp.num_crew > 0
        assert result.total_cost > 0

    def test_hybrid_pipeline_small(self):
        trips = make_trips(6)
        vt = make_vehicle_types()
        svc = OptimizerService()
        result = svc.run(trips, vt, algorithm=AlgorithmType.HYBRID_PIPELINE, time_budget_s=5.0)
        assert result.vsp.num_vehicles > 0

    def test_empty_trips_raises(self):
        from src.core.exceptions import NoProblemDataError
        svc = OptimizerService()
        with pytest.raises(NoProblemDataError):
            svc.run([], [], algorithm=AlgorithmType.GREEDY)
