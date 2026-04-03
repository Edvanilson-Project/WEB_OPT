"""
OptimizerService — orquestra a seleção e execução de algoritmos.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, List, Optional

from ..algorithms.csp.greedy import GreedyCSP
from ..algorithms.csp.set_partitioning import SetPartitioningCSP
from ..algorithms.evaluator import CostEvaluator
from ..algorithms.hybrid.pipeline import HybridPipeline
from ..algorithms.integrated.joint_solver import JointSolver
from ..algorithms.vsp.genetic import GeneticVSP
from ..algorithms.vsp.greedy import GreedyVSP
from ..algorithms.vsp.simulated_annealing import SimulatedAnnealingVSP
from ..algorithms.vsp.tabu_search import TabuSearchVSP
from ..core.config import get_settings
from ..core.exceptions import HardConstraintViolationError, InvalidAlgorithmError, NoProblemDataError
from ..domain.models import AlgorithmType, OptimizationResult, Trip, VehicleType
from .hard_constraint_validator import HardConstraintValidator

settings = get_settings()
logger = logging.getLogger(__name__)
evaluator = CostEvaluator()
validator = HardConstraintValidator()


class OptimizerService:
    def run(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        algorithm: AlgorithmType = AlgorithmType.HYBRID_PIPELINE,
        depot_id: Optional[int] = None,
        time_budget_s: Optional[float] = None,
        cct_params: Any = None,
        vsp_params: Any = None,
    ) -> OptimizationResult:
        if not trips:
            raise NoProblemDataError("trips list is empty")

        t0 = time.perf_counter()
        cct_params = self._normalize_rules(cct_params)
        vsp_params = self._normalize_rules(vsp_params)
        had_explicit_mandatory_groups = bool(cct_params.get("mandatory_trip_groups_same_duty"))
        self._inject_trip_group_constraints(trips, cct_params, vsp_params)
        if not had_explicit_mandatory_groups and not bool(cct_params.get("enforce_trip_groups_hard", False)):
            cct_params.pop("mandatory_trip_groups_same_duty", None)
        
        strict_hard_validation = bool(
            vsp_params.get("strict_hard_validation", cct_params.get("strict_hard_validation", True))
        )

        input_report = validator.audit_input(trips, cct_params, vsp_params)
        if strict_hard_validation and not input_report["ok"]:
            raise HardConstraintViolationError(input_report["issues"])

        result = self._dispatch(
            algorithm,
            trips,
            vehicle_types,
            depot_id,
            time_budget_s,
            cct_params,
            vsp_params,
        )
        result.total_elapsed_ms = (time.perf_counter() - t0) * 1000
        result.total_cost = evaluator.total_cost(result, vehicle_types)
        result.algorithm = algorithm
        result.meta.setdefault("input", {})
        result.meta["hard_constraint_report"] = {
            "strict": strict_hard_validation,
            "input": input_report,
        }

        output_report = validator.audit_result(result, trips, cct_params, vsp_params)
        result.meta["hard_constraint_report"]["output"] = output_report
        if strict_hard_validation and not output_report["ok"]:
            raise HardConstraintViolationError(output_report["issues"])

        result.meta["operational_kpis"] = self._build_operational_kpis(result, cct_params)

        result.meta["input"].update(
            {
                "n_trips": len(trips),
                "n_vehicle_types": len(vehicle_types),
                "cct_params": cct_params,
                "vsp_params": vsp_params,
            }
        )
        return result

    def _build_operational_kpis(self, result: OptimizationResult, cct_params: Dict[str, Any]) -> Dict[str, Any]:
        duties = list(result.csp.duties or [])
        if not duties:
            return {
                "vehicles": len(result.vsp.blocks or []),
                "crew": 0,
                "work_minutes": 0,
                "paid_minutes": 0,
                "paid_work_delta_minutes": 0,
                "fairness": {
                    "target_work_minutes": int(cct_params.get("fairness_target_work_minutes", 420) or 420),
                    "tolerance_minutes": int(cct_params.get("fairness_tolerance_minutes", 30) or 30),
                    "d_plus_total": 0,
                    "d_minus_total": 0,
                    "within_band_count": 0,
                    "outside_band_count": 0,
                },
            }

        target = int(cct_params.get("fairness_target_work_minutes", 420) or 420)
        tolerance = int(cct_params.get("fairness_tolerance_minutes", 30) or 30)

        total_work = sum(int(duty.work_time or 0) for duty in duties)
        total_paid = sum(int(duty.paid_minutes or duty.work_time or 0) for duty in duties)

        d_plus_total = 0
        d_minus_total = 0
        within_band = 0
        outside_band = 0

        operator_blocks: Dict[int, set[int]] = {}
        for duty in duties:
            work = int(duty.work_time or 0)
            d_plus = max(0, work - target)
            d_minus = max(0, target - work)
            d_plus_total += d_plus
            d_minus_total += d_minus

            if abs(work - target) <= tolerance:
                within_band += 1
            else:
                outside_band += 1

            operator_id = duty.meta.get("operator_id")
            if operator_id is None:
                continue
            source_blocks = {
                int(item)
                for item in duty.meta.get("source_block_ids", [])
                if item is not None
            }
            operator_blocks.setdefault(int(operator_id), set()).update(source_blocks)

        stretch_values = [max(0, len(blocks) - 1) for blocks in operator_blocks.values() if blocks]
        avg_vehicle_changes_per_operator = round(sum(stretch_values) / len(stretch_values), 3) if stretch_values else 0.0

        return {
            "vehicles": len(result.vsp.blocks or []),
            "crew": len(duties),
            "work_minutes": total_work,
            "paid_minutes": total_paid,
            "paid_work_delta_minutes": max(0, total_paid - total_work),
            "fairness": {
                "target_work_minutes": target,
                "tolerance_minutes": tolerance,
                "d_plus_total": d_plus_total,
                "d_minus_total": d_minus_total,
                "within_band_count": within_band,
                "outside_band_count": outside_band,
                "avg_work_minutes": round(total_work / max(1, len(duties)), 2),
            },
            "stretch_kpi": {
                "operators_with_assignment": len(operator_blocks),
                "avg_vehicle_changes_per_operator": avg_vehicle_changes_per_operator,
            },
        }

    def _dispatch(
        self,
        algorithm: AlgorithmType,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depot_id: Optional[int],
        time_budget_s: Optional[float],
        cct_params: Dict[str, Any],
        vsp_params: Dict[str, Any],
    ) -> OptimizationResult:
        budget = time_budget_s or vsp_params.get("time_budget_s", settings.hybrid_time_budget_seconds)
        csp = self._make_csp(cct_params, vsp_params)
        vsp_solver = GreedyVSP(vsp_params=vsp_params)

        if algorithm == AlgorithmType.GREEDY:
            vsp = vsp_solver.solve(trips, vehicle_types, depot_id)
            return OptimizationResult(vsp=vsp, csp=csp.solve(vsp.blocks, trips))

        if algorithm == AlgorithmType.GENETIC:
            ga = GeneticVSP(vsp_params=vsp_params)
            ga.time_budget_s = budget * 0.8
            vsp = ga.solve(trips, vehicle_types, depot_id)
            return OptimizationResult(vsp=vsp, csp=csp.solve(vsp.blocks, trips))

        if algorithm == AlgorithmType.SIMULATED_ANNEALING:
            sa = SimulatedAnnealingVSP(vsp_params=vsp_params)
            sa.time_budget_s = budget * 0.8
            vsp = sa.solve(trips, vehicle_types, depot_id)
            return OptimizationResult(vsp=vsp, csp=csp.solve(vsp.blocks, trips))

        if algorithm == AlgorithmType.TABU_SEARCH:
            ts = TabuSearchVSP(vsp_params=vsp_params)
            ts.time_budget_s = budget * 0.8
            vsp = ts.solve(trips, vehicle_types, depot_id)
            return OptimizationResult(vsp=vsp, csp=csp.solve(vsp.blocks, trips))

        if algorithm == AlgorithmType.SET_PARTITIONING:
            vsp = vsp_solver.solve(trips, vehicle_types, depot_id)
            ilp = self._make_set_covering_csp(cct_params, vsp_params)
            ilp.time_budget_s = budget * 0.9
            return OptimizationResult(vsp=vsp, csp=ilp.solve(vsp.blocks, trips))

        if algorithm == AlgorithmType.JOINT_SOLVER:
            return JointSolver(cct_params=cct_params, vsp_params=vsp_params).solve(trips, vehicle_types, depot_id)

        if algorithm == AlgorithmType.HYBRID_PIPELINE:
            return HybridPipeline(time_budget_s=budget, cct_params=cct_params, vsp_params=vsp_params).solve(trips, vehicle_types, depot_id)

        raise InvalidAlgorithmError(str(algorithm))

    def _as_dict(self, params: Any) -> Dict[str, Any]:
        if params is None:
            return {}
        if isinstance(params, dict):
            return dict(params)
        if hasattr(params, "model_dump"):
            return params.model_dump(exclude_none=True)
        return {
            key: value
            for key, value in vars(params).items()
            if not key.startswith("_") and value is not None
        }

    def _normalize_rules(self, params: Any) -> Dict[str, Any]:
        normalized = self._as_dict(params)
        fairness_weight = normalized.get("fairness_weight")
        if fairness_weight is not None:
            try:
                fairness = float(fairness_weight)
                if fairness > 1.0:
                    fairness = fairness / 100.0
                fairness = max(0.0, fairness)
                goal_weights = dict(normalized.get("goal_weights") or {})
                goal_weights.setdefault("fairness", fairness)
                normalized["goal_weights"] = goal_weights
            except (TypeError, ValueError):
                pass

        rules = normalized.get("natural_language_rules") or []
        for rule in rules:
            parsed = self._parse_rule(rule)
            for key, value in parsed.items():
                normalized.setdefault(key, value)
        return normalized

    def _inject_trip_group_constraints(
        self,
        trips: List[Trip],
        cct_params: Dict[str, Any],
        vsp_params: Dict[str, Any],
    ) -> None:
        hard_pairing = bool(cct_params.get("enforce_trip_groups_hard", False)) or bool(
            cct_params.get("operator_pairing_hard", False)
        )
        if cct_params.get("mandatory_trip_groups_same_duty"):
            return
        if not bool(vsp_params.get("preserve_preferred_pairs", True)):
            return

        grouped: Dict[tuple[int, int], List[int]] = {}
        for trip in trips:
            if trip.trip_group_id is None:
                continue
            grouped.setdefault((trip.line_id, trip.trip_group_id), []).append(trip.id)

        explicit_pairs: List[List[int]] = [sorted(ids) for ids in grouped.values() if len(ids) == 2]

        if not explicit_pairs and hard_pairing:
            inferred = self._infer_round_trip_pairs(trips, vsp_params)
            trip_by_id = {trip.id: trip for trip in trips}
            synthetic_group = -1
            for a_id, b_id in inferred:
                a_trip = trip_by_id.get(a_id)
                b_trip = trip_by_id.get(b_id)
                if a_trip is None or b_trip is None:
                    continue
                if a_trip.trip_group_id is None and b_trip.trip_group_id is None:
                    a_trip.trip_group_id = synthetic_group
                    b_trip.trip_group_id = synthetic_group
                    explicit_pairs.append(sorted([a_id, b_id]))
                    synthetic_group -= 1

        if hard_pairing and explicit_pairs:
            cct_params["mandatory_trip_groups_same_duty"] = explicit_pairs

    def _infer_round_trip_pairs(self, trips: List[Trip], vsp_params: Dict[str, Any]) -> List[List[int]]:
        pair_window = int(vsp_params.get("preferred_pair_window_minutes", 30) or 30)
        pair_window = max(5, min(pair_window, 90))

        by_line: Dict[int, List[Trip]] = {}
        for trip in trips:
            by_line.setdefault(int(trip.line_id), []).append(trip)

        used: set[int] = set()
        pairs: List[List[int]] = []
        for line_id in sorted(by_line.keys()):
            ordered = sorted(by_line[line_id], key=lambda item: (item.start_time, item.id))
            for index, trip in enumerate(ordered):
                if trip.id in used:
                    continue

                best: Optional[Trip] = None
                best_gap = 10**9
                for nxt in ordered[index + 1 :]:
                    if nxt.id in used:
                        continue
                    gap = int(nxt.start_time - trip.end_time)
                    if gap < 0:
                        continue
                    if gap > pair_window:
                        break
                    if trip.destination_id != nxt.origin_id:
                        continue
                    if trip.origin_id != nxt.destination_id:
                        continue
                    if gap < best_gap:
                        best = nxt
                        best_gap = gap

                if best is None:
                    continue

                used.add(trip.id)
                used.add(best.id)
                pairs.append(sorted([trip.id, best.id]))

        return pairs

    def _parse_rule(self, rule: str) -> Dict[str, Any]:
        text = rule.lower().strip()
        parsed: Dict[str, Any] = {}

        def _hours_to_minutes(raw: str) -> int:
            return int(round(float(raw.replace(",", ".")) * 60))

        m = re.search(r"pausa de\s+(\d+)\s+min", text)
        if m:
            parsed.setdefault("min_break_minutes", int(m.group(1)))

        m = re.search(r"após\s+cada\s+(\d+[\.,]?\d*)\s+horas", text)
        if m:
            parsed.setdefault("mandatory_break_after_minutes", _hours_to_minutes(m.group(1)))

        m = re.search(r"máximo de\s+(\d+)\s+horas\s+por\s+semana", text)
        if m:
            parsed.setdefault("weekly_driving_limit_minutes", int(m.group(1)) * 60)

        m = re.search(r"(?:nenhum motorista|motorista)\s+deve\s+trabalhar\s+mais\s+de\s+(\d+[\.,]?\d*)\s+horas", text)
        if m:
            parsed.setdefault("max_shift_minutes", _hours_to_minutes(m.group(1)))

        m = re.search(r"spread\s+(?:máximo|maximo|limitado)?\s*(?:de)?\s*(\d+[\.,]?\d*)\s+horas", text)
        if m:
            parsed.setdefault("max_shift_minutes", _hours_to_minutes(m.group(1)))

        m = re.search(r"reduzir\s+horas\s+extras", text)
        if m:
            parsed.setdefault("goal_weights", {})
            parsed["goal_weights"].setdefault("overtime", 1.0)

        m = re.search(r"reduzir\s+o?\s*spread", text)
        if m:
            parsed.setdefault("goal_weights", {})
            parsed["goal_weights"].setdefault("spread", 0.8)

        m = re.search(r"reduzir\s+deslocamentos?\s+passivos", text)
        if m:
            parsed.setdefault("goal_weights", {})
            parsed["goal_weights"].setdefault("passive_transfer", 0.8)

        m = re.search(r"equidade|balancear\s+jornadas|fairness", text)
        if m:
            parsed.setdefault("goal_weights", {})
            parsed["goal_weights"].setdefault("fairness", 0.5)

        m = re.search(r"descanso\s+interjornada\s+de\s+(\d+)\s*h", text)
        if m:
            parsed.setdefault("inter_shift_rest_minutes", int(m.group(1)) * 60)

        m = re.search(r"descanso\s+semanal\s+de\s+(\d+)\s*h", text)
        if m:
            parsed.setdefault("weekly_rest_minutes", int(m.group(1)) * 60)

        m = re.search(r"máximo de\s+(\d+)\s+jornadas\s+acima\s+de\s+(\d+)\s*horas", text)
        if m:
            parsed.setdefault("max_long_duties_per_period", int(m.group(1)))
            parsed.setdefault("extended_daily_driving_limit_minutes", int(m.group(2)) * 60)

        if "mesmo depósito" in text or "mesmo deposito" in text:
            parsed.setdefault("same_depot_required", True)
            parsed.setdefault("enforce_same_depot_start_end", True)

        return parsed

    def _make_csp(self, cct_params: Dict[str, Any], vsp_params: Dict[str, Any]):
        if vsp_params.get("use_set_covering") or vsp_params.get("pricing_enabled"):
            return self._make_set_covering_csp(cct_params, vsp_params)
        return GreedyCSP(vsp_params=vsp_params, **cct_params)

    def _make_set_covering_csp(self, cct_params: Dict[str, Any], vsp_params: Dict[str, Any]):
        return SetPartitioningCSP(vsp_params=vsp_params, **cct_params)
