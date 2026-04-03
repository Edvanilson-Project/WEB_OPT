"""
CSP Guloso parametrizado.

Fluxo:
1. Run-cutting: converte blocos de veículo em tarefas/peças dirigíveis.
2. Duty building: combina tarefas em jornadas legais.
3. Rostering: agrupa jornadas em escalas multi-dia respeitando descanso.

O objetivo operacional continua sendo cobrir todas as tarefas geradas, reduzindo
custos, horas extras, spread excessivo e transferências passivas.
"""
from __future__ import annotations

import copy
import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

_log = logging.getLogger(__name__)

from ...core.config import get_settings
from ...domain.interfaces import ICSPAlgorithm
from ...domain.models import Block, CSPSolution, Duty, Trip
from ..base import BaseAlgorithm

settings = get_settings()

_DEF_MAX_SHIFT = getattr(settings, "cct_max_shift_minutes", 560)
_DEF_MAX_WORK = 480
_DEF_MAX_DRIVING = getattr(settings, "cct_max_driving_minutes", 270)
_DEF_MIN_BREAK = getattr(settings, "cct_min_break_minutes", 30)


def _nocturnal_overlap(start: int, end: int, noct_start_h: int, noct_end_h: int) -> int:
    total = 0
    t = start
    while t < end:
        minute_of_day = t % 1440
        start_noct = noct_start_h * 60
        end_noct = noct_end_h * 60
        in_window = minute_of_day >= start_noct or minute_of_day < end_noct
        if in_window:
            total += 1
        t += 1
    return total


def _shift_type_from_minutes(minutes: int) -> str:
    minute_of_day = minutes % 1440
    if 180 <= minute_of_day < 540:
        return "early"
    if 540 <= minute_of_day < 900:
        return "mid"
    if 900 <= minute_of_day < 1260:
        return "late"
    return "night"


class GreedyCSP(BaseAlgorithm, ICSPAlgorithm):
    MAX_SHIFT_MINUTES = _DEF_MAX_SHIFT
    MAX_DRIVING_MINUTES = _DEF_MAX_DRIVING
    MIN_BREAK_MINUTES = _DEF_MIN_BREAK

    def __init__(self, vsp_params: Optional[Dict[str, Any]] = None, **params: Any):
        super().__init__(name="greedy_csp", time_budget_s=30.0)
        self.params = params
        self.vsp_params = vsp_params or {}
        self.legal_max_shift = int(params.get("legal_max_shift_minutes", 720))
        self.legal_max_continuous_driving = 600
        self.max_shift = min(int(params.get("max_shift_minutes", _DEF_MAX_SHIFT)), self.legal_max_shift)
        self.max_work = int(params.get("max_work_minutes", _DEF_MAX_WORK))
        self.min_work = int(params.get("min_work_minutes", 0))
        self.min_shift = int(params.get("min_shift_minutes", 0))
        self.overtime_limit = int(params.get("overtime_limit_minutes", 120))
        self.max_driving = min(int(params.get("max_driving_minutes", _DEF_MAX_DRIVING)), self.legal_max_continuous_driving)
        self.min_break = int(params.get("min_break_minutes", _DEF_MIN_BREAK))
        self.mandatory_break_after = min(int(params.get("mandatory_break_after_minutes", self.max_driving)), self.legal_max_continuous_driving)
        self.split_break_first = int(params.get("split_break_first_minutes", 15))
        self.split_break_second = int(params.get("split_break_second_minutes", max(self.min_break, 30)))
        self.meal_break_minutes = int(params.get("meal_break_minutes", 0))
        self.inter_shift_rest = max(int(params.get("inter_shift_rest_minutes", 660)), 660)
        self.weekly_rest = int(params.get("weekly_rest_minutes", 1440))
        self.daily_driving_limit = int(params.get("daily_driving_limit_minutes", 540))
        self.extended_daily_driving_limit = int(params.get("extended_daily_driving_limit_minutes", 600))
        self.max_extended_days = int(params.get("max_extended_driving_days_per_week", 2))
        self.weekly_driving_limit = int(params.get("weekly_driving_limit_minutes", 3360))
        self.fortnight_driving_limit = int(params.get("fortnight_driving_limit_minutes", 5400))
        self.min_layover = int(params.get("min_layover_minutes", self.vsp_params.get("min_layover_minutes", 8)))
        self.pullout = int(params.get("pullout_minutes", 10))
        self.pullback = int(params.get("pullback_minutes", 10))
        self.idle_time_is_paid = bool(params.get("idle_time_is_paid", True))
        self.waiting_time_pay_pct = float(params.get("waiting_time_pay_pct", 0.30))
        max_unpaid_break = params.get("max_unpaid_break_minutes", None)
        self.max_unpaid_break = None if max_unpaid_break is None else max(0, int(max_unpaid_break))
        self.long_unpaid_break_limit = int(params.get("long_unpaid_break_limit_minutes", 180))
        self.long_unpaid_break_penalty_weight = float(params.get("long_unpaid_break_penalty_weight", 4.0))
        max_total_unpaid_break = params.get("max_total_unpaid_break_minutes", None)
        self.max_total_unpaid_break = None if max_total_unpaid_break is None else max(0, int(max_total_unpaid_break))
        self.min_guaranteed_work = int(params.get("min_guaranteed_work_minutes", 0))
        self.allow_relief_points = bool(params.get("allow_relief_points", False))
        self.enforce_same_depot = bool(params.get("enforce_same_depot_start_end", False))
        self.enforce_single_line_duty = bool(params.get("enforce_single_line_duty", False))
        self.operator_single_vehicle_only = bool(params.get("operator_single_vehicle_only", False))
        self.nocturnal_start_hour = int(params.get("nocturnal_start_hour", 22))
        self.nocturnal_end_hour = int(params.get("nocturnal_end_hour", 5))
        self.nocturnal_extra_pct = float(params.get("nocturnal_extra_pct", 0.20))
        self.holiday_extra_pct = float(params.get("holiday_extra_pct", 1.0))
        self.goal_weights = dict(params.get("goal_weights") or self.vsp_params.get("goal_weights") or {})
        fairness_weight = params.get("fairness_weight", self.goal_weights.get("fairness", 0.0))
        try:
            fairness_weight = float(fairness_weight)
        except (TypeError, ValueError):
            fairness_weight = 0.0
        if fairness_weight > 1.0:
            fairness_weight = fairness_weight / 100.0
        self.fairness_weight = max(0.0, fairness_weight)
        self.fairness_target_work = int(params.get("fairness_target_work_minutes", self.goal_weights.get("target_work_minutes", 420)))
        self.fairness_tolerance = int(params.get("fairness_tolerance_minutes", 30))
        self.operator_change_terminals_only = bool(params.get("operator_change_terminals_only", True))
        self.strict_union_rules = bool(params.get("strict_union_rules", True))
        self.operator_profiles = list(params.get("operator_profiles") or [])

    def _block_drive(self, block: Block) -> int:
        return sum(t.duration for t in block.trips)

    def _service_day(self, block: Block) -> int:
        return block.start_time // 1440

    def _transfer_needed(self, a: Block, b: Block) -> int:
        last = a.trips[-1]
        first = b.trips[0]
        deadhead_needed = int(
            last.deadhead_times.get(first.origin_id, 0)
        )
        return max(self.min_layover, deadhead_needed)

    def _break_resets(self, state: Dict[str, Any], gap: int) -> Tuple[bool, Dict[str, Any]]:
        state = {"credit": int(state.get("credit", 0)), "has_long": bool(state.get("has_long", False))}
        if gap >= self.min_break:
            state["credit"] = 0
            state["has_long"] = False
            return True, state

        if gap >= self.split_break_first:
            state["credit"] += gap
        if gap >= self.split_break_second:
            state["has_long"] = True
        if state["credit"] >= self.split_break_first + self.split_break_second and state["has_long"]:
            state["credit"] = 0
            state["has_long"] = False
            return True, state
        return False, state

    def _is_relief_boundary(self, current: Trip, nxt: Trip) -> bool:
        if current.destination_id == nxt.origin_id:
            return True
        if current.depot_id is not None and nxt.depot_id is not None and current.depot_id == nxt.depot_id:
            return True
        if self.allow_relief_points:
            if current.is_relief_point or nxt.is_relief_point:
                return True
            if current.relief_point_id is not None and current.relief_point_id in {current.destination_id, nxt.origin_id}:
                return True
            if nxt.relief_point_id is not None and nxt.relief_point_id in {current.destination_id, nxt.origin_id}:
                return True
        return False

    def _valid_operator_change_boundary(self, current: Trip, nxt: Trip) -> bool:
        if current.destination_id == nxt.origin_id:
            return True
        if current.depot_id is not None and nxt.depot_id is not None and current.depot_id == nxt.depot_id:
            return True
        if self.allow_relief_points:
            if current.is_relief_point or nxt.is_relief_point:
                return True
            if current.relief_point_id is not None and current.relief_point_id in {current.destination_id, nxt.origin_id}:
                return True
            if nxt.relief_point_id is not None and nxt.relief_point_id in {current.destination_id, nxt.origin_id}:
                return True
        return False

    def _fairness_penalty(self, projected_work: int) -> float:
        if self.fairness_weight <= 0:
            return 0.0
        deviation = abs(projected_work - self.fairness_target_work)
        exceeded = max(0, deviation - self.fairness_tolerance)
        return (exceeded / 60.0) * self.fairness_weight

    def _make_task(self, source_block: Block, trips: Sequence[Trip], task_id: int) -> Block:
        task = Block(id=task_id, trips=list(trips), vehicle_type_id=source_block.vehicle_type_id)
        task.meta.update(
            {
                "source_block_id": source_block.id,
                "task_id": task_id,
                "relief_start_id": trips[0].origin_id if trips else None,
                "relief_end_id": trips[-1].destination_id if trips else None,
                "task_drive_minutes": sum(t.duration for t in trips),
            }
        )
        return task

    def prepare_tasks(self, blocks: List[Block]) -> Tuple[List[Block], Dict[str, Any]]:
        """Executa run-cutting sobre blocos VSP para gerar tarefas de CSP."""
        tasks: List[Block] = []
        relief_cuts = 0
        max_chunk_drive = max(60, min(self.max_work, self.mandatory_break_after, self.daily_driving_limit))
        meal_trigger = max(240, self.mandatory_break_after - max(0, self.meal_break_minutes)) if self.meal_break_minutes > 0 else self.mandatory_break_after

        for block in sorted(blocks, key=lambda item: (item.start_time, item.id)):
            ordered = sorted(block.trips, key=lambda trip: (trip.start_time, trip.id))
            if not ordered:
                continue

            current: List[Trip] = []
            current_drive = 0
            for index, trip in enumerate(ordered):
                current.append(trip)
                current_drive += trip.duration
                nxt = ordered[index + 1] if index + 1 < len(ordered) else None
                if nxt is None:
                    tasks.append(self._make_task(block, current, self._next_block_id()))
                    break

                gap = nxt.start_time - trip.end_time
                boundary = self._is_relief_boundary(trip, nxt)
                next_duration = nxt.duration
                pair_guard = (
                    trip.trip_group_id is not None
                    and trip.trip_group_id == nxt.trip_group_id
                    and trip.line_id == nxt.line_id
                )
                should_cut = False

                if gap >= self.min_break:
                    should_cut = True
                elif boundary and current_drive >= max_chunk_drive:
                    should_cut = True
                elif boundary and current_drive >= meal_trigger:
                    should_cut = True
                elif boundary and current_drive >= self.max_work:
                    should_cut = True
                elif boundary and current_drive + next_duration > max_chunk_drive:
                    should_cut = True
                elif boundary and self.meal_break_minutes > 0 and current_drive + next_duration > meal_trigger:
                    should_cut = True

                if pair_guard:
                    should_cut = False

                if should_cut:
                    task = self._make_task(block, current, self._next_block_id())
                    task.meta["relief_cut"] = True
                    task.meta["split_reason"] = (
                        "natural_break" if gap >= self.min_break else
                        "mandatory_break" if current_drive >= max_chunk_drive else
                        "meal_break" if current_drive >= meal_trigger else
                        "work_limit"
                    )
                    tasks.append(task)
                    relief_cuts += 1
                    current = []
                    current_drive = 0

        return tasks, {
            "task_count": len(tasks),
            "source_block_count": len(blocks),
            "relief_cuts": relief_cuts,
            "run_cutting": "terminal_relief_and_break_windows",
        }

    def _can_extend(self, duty: Duty, block: Block) -> Tuple[bool, str, Dict[str, Any]]:
        if not duty.tasks:
            return True, "", {}

        last = duty.tasks[-1]
        if self._service_day(last) != self._service_day(block):
            return False, "different_service_day", {}

        gap = block.start_time - last.end_time
        if gap < 0:
            return False, "overlap", {}

        if self.max_unpaid_break is not None and gap > self.max_unpaid_break:
            return False, "max_unpaid_break_exceeded", {"gap": gap, "max_unpaid_break": self.max_unpaid_break}

        transfer_needed = self._transfer_needed(last, block)
        if gap < transfer_needed:
            return False, "transfer_insufficient", {"gap": gap, "transfer_needed": transfer_needed}

        passive_transfer = max(0, transfer_needed - self.min_layover)
        if self.operator_change_terminals_only and not self._valid_operator_change_boundary(last.trips[-1], block.trips[0]):
            return False, "operator_change_non_terminal", {}
        if not self.allow_relief_points and last.trips[-1].destination_id != block.trips[0].origin_id and passive_transfer > 0:
            return False, "relief_point_required", {}

        if self.enforce_single_line_duty:
            duty_lines = set(int(line_id) for line_id in duty.meta.get("line_ids", []))
            block_lines = {int(t.line_id) for t in block.trips}
            if duty_lines and any(line_id not in duty_lines for line_id in block_lines):
                return False, "single_line_duty_required", {}

        if self.operator_single_vehicle_only:
            source_block_id = int(block.meta.get("source_block_id", block.id))
            covered_sources = {
                int(item)
                for item in duty.meta.get("source_block_ids", [])
                if item is not None
            }
            if covered_sources and source_block_id not in covered_sources:
                return False, "operator_single_vehicle_only", {}

        new_spread = (block.end_time - duty.tasks[0].start_time) + self.pullout + self.pullback
        if new_spread > self.max_shift:
            return False, "spread_exceeded", {"new_spread": new_spread}

        block_drive = self._block_drive(block)
        new_work = duty.work_time + block_drive
        if new_work > self.max_work + self.overtime_limit:
            return False, "overtime_hard", {"new_work": new_work}

        start_depot = duty.meta.get("start_depot_id")
        candidate_end_depot = block.trips[-1].depot_id
        if self.enforce_same_depot and start_depot is not None and candidate_end_depot is not None and candidate_end_depot != start_depot:
            return False, "same_depot_required", {}

        had_break, break_state = self._break_resets(duty.meta.get("break_state", {}), gap)
        current_cont = int(duty.meta.get("continuous_drive", 0))
        new_cont = block_drive if had_break else current_cont + block_drive
        if new_cont > self.max_driving or new_cont > self.mandatory_break_after:
            return False, "continuous_drive_exceeded", {"continuous_drive": new_cont}

        daily_drive = int(duty.meta.get("daily_driving", 0)) + block_drive
        extended_days_used = int(duty.meta.get("extended_days_used", 0))
        if daily_drive > self.extended_daily_driving_limit:
            return False, "daily_driving_exceeded", {"daily_drive": daily_drive}
        if daily_drive > self.daily_driving_limit and extended_days_used >= self.max_extended_days:
            return False, "daily_extension_quota_exceeded", {"daily_drive": daily_drive}

        return True, "", {
            "gap": gap,
            "transfer_needed": transfer_needed,
            "had_break": had_break,
            "new_spread": new_spread,
            "new_work": new_work,
            "new_cont": new_cont,
            "daily_drive": daily_drive,
            "extended_days_used": extended_days_used + (1 if daily_drive > self.daily_driving_limit else 0),
            "passive_transfer": passive_transfer,
            "break_state": break_state,
        }

    def _apply_block(self, duty: Duty, block: Block, data: Dict[str, Any]) -> None:
        duty.add_task(block)
        duty.work_time = int(data.get("new_work", self._block_drive(block)))
        duty.spread_time = int(data.get("new_spread", block.total_duration + self.pullout + self.pullback))
        gap = int(data.get("gap", 0))
        duty.meta["continuous_drive"] = int(data.get("new_cont", self._block_drive(block)))
        duty.meta["daily_driving"] = int(data.get("daily_drive", self._block_drive(block)))
        duty.meta["extended_days_used"] = int(data.get("extended_days_used", 0))
        duty.meta["break_state"] = dict(data.get("break_state", duty.meta.get("break_state", {"credit": 0, "has_long": False})))
        duty.meta["waiting_minutes"] = int(duty.meta.get("waiting_minutes", 0)) + max(0, gap - int(data.get("transfer_needed", 0)))
        duty.meta["passive_transfer_minutes"] = int(duty.meta.get("passive_transfer_minutes", 0)) + int(data.get("passive_transfer", 0))
        duty.meta.setdefault("service_day", self._service_day(block))
        duty.meta.setdefault("start_depot_id", block.trips[0].depot_id)
        duty.meta["end_depot_id"] = block.trips[-1].depot_id
        duty.meta.setdefault("line_ids", [])
        for line_id in [t.line_id for t in block.trips]:
            if line_id not in duty.meta["line_ids"]:
                duty.meta["line_ids"].append(line_id)
        duty.meta.setdefault("task_ids", []).append(block.meta.get("task_id", block.id))
        duty.meta.setdefault("source_block_ids", []).append(block.meta.get("source_block_id", block.id))
        duty.meta.setdefault("covered_trip_ids", []).extend(t.id for t in block.trips)
        duty.meta.setdefault("covered_trip_group_ids", [])
        for trip in block.trips:
            group_id = getattr(trip, "trip_group_id", None)
            if group_id is None:
                continue
            if group_id not in duty.meta["covered_trip_group_ids"]:
                duty.meta["covered_trip_group_ids"].append(group_id)

    def _continuous_drive_stats(self, duty: Duty) -> Tuple[int, bool]:
        max_continuous = 0
        meal_break_found = False
        continuous = 0
        all_trips = []
        for block in duty.tasks:
            all_trips.extend(block.trips)
        if not all_trips:
            return 0, False
        all_trips.sort(key=lambda t: t.start_time)
        
        previous_end = None
        for trip in all_trips:
            if previous_end is None:
                continuous = trip.duration
            else:
                gap = trip.start_time - previous_end
                if gap >= self.meal_break_minutes > 0:
                    meal_break_found = True
                if gap >= self.min_break:
                    continuous = trip.duration
                else:
                    continuous += trip.duration
            max_continuous = max(max_continuous, continuous)
            previous_end = trip.end_time
            
        return max_continuous, meal_break_found

    def _would_have_meal_break(self, duty: Duty, candidate_task: Block) -> bool:
        """Check if adding candidate_task to duty would produce a meal break gap."""
        if self.meal_break_minutes <= 0:
            return True
        all_trips = []
        for block in duty.tasks:
            all_trips.extend(block.trips)
        all_trips.extend(candidate_task.trips)
        if not all_trips:
            return True
        all_trips.sort(key=lambda t: t.start_time)
        previous_end = None
        for trip in all_trips:
            if previous_end is not None:
                if trip.start_time - previous_end >= self.meal_break_minutes:
                    return True
            previous_end = trip.end_time
        return False

    def _profile_priority(self, profile: Dict[str, Any]) -> float:
        if profile.get("seniority_score") is not None:
            return float(profile["seniority_score"])
        if profile.get("seniority_rank") is not None:
            return -float(profile["seniority_rank"])
        return 0.0

    def _assign_operator_profiles(self, roster_state: List[Dict[str, Any]], duties: List[Duty]) -> Dict[str, Any]:
        if not self.operator_profiles:
            return {
                "enabled": False,
                "assigned_rosters": 0,
                "unassigned_rosters": len(roster_state),
                "violations": [],
                "rosters": [],
            }

        duty_by_id = {duty.id: duty for duty in duties}
        available = sorted(
            [dict(profile) for profile in self.operator_profiles],
            key=lambda profile: self._profile_priority(profile),
            reverse=True,
        )
        assignments: List[Dict[str, Any]] = []
        violations: List[str] = []

        def roster_signature(roster: Dict[str, Any]) -> Tuple[int, List[int], int]:
            roster_duties = [duty_by_id[duty_id] for duty_id in roster["duties"] if duty_id in duty_by_id]
            first_start = min((duty.tasks[0].start_time for duty in roster_duties if duty.tasks), default=0)
            line_ids = sorted({trip.line_id for duty in roster_duties for task in duty.tasks for trip in task.trips})
            return first_start, line_ids, len(roster_duties)

        for roster in sorted(roster_state, key=lambda item: roster_signature(item)[0]):
            first_start, line_ids, duty_count = roster_signature(roster)
            shift_type = _shift_type_from_minutes(first_start)

            viable: List[Tuple[Tuple[int, int, float], Dict[str, Any]]] = []
            fallback: List[Tuple[Tuple[int, int, float], Dict[str, Any]]] = []
            for profile in available:
                mandatory_shift_types = set(profile.get("mandatory_shift_types") or [])
                mandatory_line_ids = set(int(item) for item in (profile.get("mandatory_line_ids") or []))
                preferred_shift_types = set(profile.get("preferred_shift_types") or [])
                preferred_line_ids = set(int(item) for item in (profile.get("preferred_line_ids") or []))
                mandatory_ok = (not mandatory_shift_types or shift_type in mandatory_shift_types) and (
                    not mandatory_line_ids or set(line_ids).issubset(mandatory_line_ids)
                )
                preferred_score = int(shift_type in preferred_shift_types) + int(bool(preferred_line_ids) and bool(set(line_ids) & preferred_line_ids))
                ranking = (preferred_score, duty_count, self._profile_priority(profile))
                if mandatory_ok:
                    viable.append((ranking, profile))
                else:
                    fallback.append((ranking, profile))

            chosen: Optional[Dict[str, Any]] = None
            if viable:
                chosen = sorted(viable, key=lambda item: item[0], reverse=True)[0][1]
            elif not self.strict_union_rules and fallback:
                chosen = sorted(fallback, key=lambda item: item[0], reverse=True)[0][1]

            if chosen is None:
                violations.append(f"UNASSIGNED_OPERATOR_PROFILE R{roster['id']} shift={shift_type} lines={line_ids}")
                assignments.append({
                    "roster_id": roster["id"],
                    "operator_id": None,
                    "operator_name": None,
                    "shift_type": shift_type,
                    "line_ids": line_ids,
                })
                continue

            available = [profile for profile in available if int(profile.get("id")) != int(chosen.get("id"))]
            assignment = {
                "roster_id": roster["id"],
                "operator_id": int(chosen.get("id")),
                "operator_name": chosen.get("name"),
                "shift_type": shift_type,
                "line_ids": line_ids,
                "seniority_priority": self._profile_priority(chosen),
                "mandatory_shift_types": list(chosen.get("mandatory_shift_types") or []),
                "mandatory_line_ids": list(chosen.get("mandatory_line_ids") or []),
                "preferred_shift_types": list(chosen.get("preferred_shift_types") or []),
                "preferred_line_ids": list(chosen.get("preferred_line_ids") or []),
            }
            assignments.append(assignment)
            for duty_id in roster["duties"]:
                duty = duty_by_id.get(duty_id)
                if duty is None:
                    continue
                duty.meta["operator_id"] = assignment["operator_id"]
                duty.meta["operator_name"] = assignment["operator_name"]
                duty.meta["shift_type"] = shift_type

        return {
            "enabled": True,
            "assigned_rosters": sum(1 for item in assignments if item["operator_id"] is not None),
            "unassigned_rosters": sum(1 for item in assignments if item["operator_id"] is None),
            "violations": violations,
            "rosters": assignments,
        }

    def finalize_selected_duties(self, duties: List[Duty], original_blocks: Optional[List[Block]] = None) -> CSPSolution:
        warnings: List[str] = []
        violations = 0

        covered_source_blocks = {
            int(source_id)
            for duty in duties
            for source_id in duty.meta.get("source_block_ids", [])
        }
        uncovered_source_blocks = [block for block in (original_blocks or []) if int(block.id) not in covered_source_blocks]

        for duty in duties:
            duty.nocturnal_minutes = sum(
                _nocturnal_overlap(t.start_time, t.end_time, self.nocturnal_start_hour, self.nocturnal_end_hour)
                for block in duty.tasks for t in block.trips
            )
            duty.overtime_minutes = max(0, duty.work_time - self.max_work)
            waiting_minutes = int(duty.meta.get("waiting_minutes", max(0, duty.spread_time - duty.work_time)))
            unpaid_total = max(0, duty.spread_time - duty.work_time)
            paid_waiting = int(round(waiting_minutes * self.waiting_time_pay_pct)) if self.idle_time_is_paid else 0
            guaranteed = max(self.min_guaranteed_work, duty.work_time)
            duty.paid_minutes = guaranteed + paid_waiting
            duty.meta["guaranteed_minutes"] = guaranteed
            duty.meta["nocturnal_extra_pct"] = self.nocturnal_extra_pct
            duty.meta["passive_transfer_minutes"] = int(duty.meta.get("passive_transfer_minutes", 0))
            duty.meta["unpaid_break_total_minutes"] = unpaid_total
            duty.meta["task_windows"] = [
                {"block_id": int(task.id), "start": int(task.start_time), "end": int(task.end_time)}
                for task in duty.tasks
            ]

            windows = duty.meta["task_windows"]
            gaps: List[int] = []
            if len(windows) >= 2:
                for idx in range(len(windows) - 1):
                    gaps.append(max(0, int(windows[idx + 1]["start"]) - int(windows[idx]["end"])))
            duty.meta["task_gap_minutes"] = gaps
            duty.meta["task_long_gaps_over_180"] = sum(1 for g in gaps if g > 180)

            max_continuous_drive, meal_break_found = self._continuous_drive_stats(duty)
            duty.meta["max_continuous_drive_minutes"] = max_continuous_drive
            duty.meta["meal_break_found"] = meal_break_found

            if self.min_work > 0 and duty.work_time < self.min_work:
                duty.warnings.append(f"Trabalho abaixo do mínimo: {duty.work_time}min < {self.min_work}min")
            if self.min_shift > 0 and duty.spread_time < self.min_shift:
                duty.warnings.append(f"Turno abaixo do mínimo: {duty.spread_time}min < {self.min_shift}min")
            if duty.spread_time > self.max_shift:
                duty.shift_violations += 1
                duty.warnings.append(f"Spread excedido: {duty.spread_time}min > {self.max_shift}min")
                violations += 1
            if max_continuous_drive > self.max_driving or max_continuous_drive > self.mandatory_break_after:
                duty.rest_violations += 1
                duty.warnings.append(f"Condução contínua excedida: {max_continuous_drive}min")
                violations += 1
            if self.meal_break_minutes > 0 and duty.spread_time >= 360 and not meal_break_found:
                duty.rest_violations += 1
                duty.warnings.append(f"Intervalo de refeição insuficiente: 0min < {self.meal_break_minutes}min")
                violations += 1
            if duty.overtime_minutes > self.overtime_limit:
                duty.shift_violations += 1
                duty.warnings.append(f"Horas extras excedidas: {duty.overtime_minutes}min > {self.overtime_limit}min")
                violations += 1
            if self.max_total_unpaid_break is not None and unpaid_total > self.max_total_unpaid_break:
                duty.shift_violations += 1
                duty.warnings.append(
                    f"Ociosidade total excessiva: {unpaid_total}min > {self.max_total_unpaid_break}min"
                )
                violations += 1
            if duty.meta.get("daily_driving", 0) > self.daily_driving_limit:
                duty.warnings.append("Uso de extensão diária de condução")
            if duty.nocturnal_minutes > 0:
                duty.warnings.append(f"Período noturno aplicado: {duty.nocturnal_minutes}min")
            if any(t.is_holiday for b in duty.tasks for t in b.trips):
                duty.meta["holiday_extra_pct"] = self.holiday_extra_pct
            if self.enforce_same_depot and duty.meta.get("start_depot_id") is not None and duty.meta.get("end_depot_id") is not None and duty.meta["start_depot_id"] != duty.meta["end_depot_id"]:
                duty.shift_violations += 1
                duty.warnings.append("Jornada não encerra no mesmo depósito")
                violations += 1

        roster_state: List[Dict[str, Any]] = []
        group_to_roster: Dict[int, int] = {}
        for duty in sorted(duties, key=lambda item: (item.tasks[0].start_time if item.tasks else 0, item.id)):
            duty_start = duty.tasks[0].start_time if duty.tasks else 0
            duty_end = duty.tasks[-1].end_time if duty.tasks else 0
            daily_drive = int(duty.meta.get("daily_driving", duty.work_time))
            duty_groups = [int(item) for item in duty.meta.get("covered_trip_group_ids", [])]
            preferred_roster = next((group_to_roster[group_id] for group_id in duty_groups if group_id in group_to_roster), None)
            assigned_roster: Optional[Dict[str, Any]] = None
            for roster in sorted(roster_state, key=lambda item: item["last_end"], reverse=True):
                if preferred_roster is not None and roster["id"] != preferred_roster:
                    continue
                if roster["last_end"] + self.inter_shift_rest > duty_start:
                    continue
                week = duty_start // (7 * 1440)
                fortnight = duty_start // (14 * 1440)
                month = duty_start // (30 * 1440)
                week_drive = roster["week_drive"].get(week, 0) + daily_drive
                fortnight_drive = roster["fortnight_drive"].get(fortnight, 0) + daily_drive
                month_drive = roster["month_drive"].get(month, 0) + daily_drive
                if week_drive > self.weekly_driving_limit or fortnight_drive > self.fortnight_driving_limit:
                    continue
                assigned_roster = roster
                roster["last_end"] = duty_end
                roster["week_drive"][week] = week_drive
                roster["fortnight_drive"][fortnight] = fortnight_drive
                roster["month_drive"][month] = month_drive
                roster["duties"].append(duty.id)
                break
            if assigned_roster is None:
                if preferred_roster is not None:
                    warnings.append(f"PAIR_GROUP_ROSTER_SPLIT D{duty.id} expected_roster={preferred_roster}")
                roster_id = len(roster_state) + 1
                assigned_roster = {
                    "id": roster_id,
                    "last_end": duty_end,
                    "week_drive": defaultdict(int),
                    "fortnight_drive": defaultdict(int),
                    "month_drive": defaultdict(int),
                    "duties": [duty.id],
                }
                assigned_roster["week_drive"][duty_start // (7 * 1440)] = daily_drive
                assigned_roster["fortnight_drive"][duty_start // (14 * 1440)] = daily_drive
                assigned_roster["month_drive"][duty_start // (30 * 1440)] = daily_drive
                roster_state.append(assigned_roster)
            duty.meta["roster_id"] = assigned_roster["id"]
            for group_id in duty_groups:
                group_to_roster.setdefault(group_id, assigned_roster["id"])

        for roster in roster_state:
            if len(roster["duties"]) >= 6:
                warnings.append(f"ROSTER_{roster['id']}_WEEKLY_REST_REVIEW")

        operator_assignment = self._assign_operator_profiles(roster_state, duties)
        warnings.extend(operator_assignment.get("violations", []))

        return CSPSolution(
            duties=duties,
            uncovered_blocks=uncovered_source_blocks,
            cct_violations=violations,
            algorithm=self.name,
            elapsed_ms=self._elapsed_ms(),
            warnings=warnings,
            meta={
                "roster_count": len(roster_state),
                "rosters": [{"id": item["id"], "duties": item["duties"]} for item in roster_state],
                "operator_assignment": operator_assignment,
                "set_covering_objective": "min sum(c_j * x_j)",
                "task_coverage": sum(len(duty.meta.get("task_ids", [])) for duty in duties),
            },
        )

    def solve(
        self,
        blocks: List[Block],
        trips: Optional[List[Trip]] = None,
    ) -> CSPSolution:
        self._start_timer()
        if not blocks:
            return CSPSolution(algorithm=self.name, meta={"roster_count": 0})

        tasks, run_cut_meta = self.prepare_tasks(blocks)
        duties: List[Duty] = []
        for task in sorted(tasks, key=lambda item: (item.start_time, item.id)):
            source_block_id = int(task.meta.get("source_block_id", task.id))
            task_group_ids = {
                int(trip.trip_group_id)
                for trip in task.trips
                if getattr(trip, "trip_group_id", None) is not None
            }
            assigned = False
            feasible_candidates: List[Tuple[float, Duty, Dict[str, Any]]] = []
            ordered_duties = sorted(
                duties,
                key=lambda duty: (
                    0
                    if task_group_ids
                    and any(int(item) in task_group_ids for item in duty.meta.get("covered_trip_group_ids", []))
                    else 1,
                    0 if source_block_id in [int(item) for item in duty.meta.get("source_block_ids", [])] else 1,
                    -duty.work_time,
                    duty.id,
                ),
            )
            for duty in ordered_duties:
                ok, _, data = self._can_extend(duty, task)
                if not ok:
                    continue
                projected_work = int(data.get("new_work", duty.work_time + self._block_drive(task)))
                fairness_penalty = self._fairness_penalty(projected_work)
                gap = float(data.get("gap", 0))
                long_gap_minutes = max(0.0, gap - float(self.long_unpaid_break_limit))
                long_gap_penalty = long_gap_minutes * self.long_unpaid_break_penalty_weight
                meal_penalty = 0.0
                if self.meal_break_minutes > 0:
                    new_spread = float(data.get("new_spread", 0))
                    if new_spread >= 360 and not self._would_have_meal_break(duty, task):
                        meal_penalty = 200.0
                candidate_score = gap + float(data.get("passive_transfer", 0)) + fairness_penalty + long_gap_penalty + meal_penalty
                feasible_candidates.append((candidate_score, duty, data))
            if feasible_candidates:
                _, duty, data = min(feasible_candidates, key=lambda item: (item[0], item[1].id))
                self._apply_block(duty, task, data)
                assigned = True
            if assigned:
                continue

            duty = Duty(id=self._next_duty_id())
            self._apply_block(
                duty,
                task,
                {
                    "new_work": self._block_drive(task),
                    "new_spread": task.total_duration + self.pullout + self.pullback,
                    "new_cont": self._block_drive(task),
                    "daily_drive": self._block_drive(task),
                    "extended_days_used": 1 if self._block_drive(task) > self.daily_driving_limit else 0,
                },
            )
            duties.append(duty)

        duties = self._merge_small_duties(duties)

        sol = self.finalize_selected_duties(duties, original_blocks=blocks)
        sol.meta.update(run_cut_meta)
        _log.info(
            "[CSP-GREEDY] %d duties (roster_count=%s), avg_work=%d, short(<120)=%d",
            len(duties),
            sol.meta.get("roster_count", "?"),
            sum(d.work_time for d in duties) // max(1, len(duties)),
            sum(1 for d in duties if d.work_time < 120),
        )
        return sol

    # ------------------------------------------------------------------
    # Post-processing: merge small consecutive duties from the same vehicle
    # ------------------------------------------------------------------
    def _merge_small_duties(self, duties: List[Duty]) -> List[Duty]:
        """Tenta mesclar jornadas consecutivas do mesmo veículo se o
        resultado combinado ainda respeitar max_shift e max_work."""
        vehicle_duties: Dict[int, List[Duty]] = {}
        for duty in duties:
            sources = {int(s) for s in duty.meta.get("source_block_ids", [])}
            if len(sources) == 1:
                vid = next(iter(sources))
                vehicle_duties.setdefault(vid, []).append(duty)

        merged_ids: set[int] = set()

        for _vid, vduties in vehicle_duties.items():
            vduties.sort(key=lambda d: d.tasks[0].start_time if d.tasks else 0)

            i = 0
            while i < len(vduties) - 1:
                a = vduties[i]
                b = vduties[i + 1]
                if a.id in merged_ids or b.id in merged_ids:
                    i += 1
                    continue

                # Quick feasibility check before deep-copying
                if not b.tasks or not a.tasks:
                    i += 1
                    continue
                combined_spread = (
                    b.tasks[-1].end_time - a.tasks[0].start_time
                ) + self.pullout + self.pullback
                combined_work = a.work_time + sum(
                    self._block_drive(t) for t in b.tasks
                )
                if combined_spread > self.max_shift:
                    i += 1
                    continue
                if combined_work > self.max_work + self.overtime_limit:
                    i += 1
                    continue

                # Deep simulation: clone a and try appending all tasks from b
                sim = copy.deepcopy(a)
                can_merge = True
                for task in b.tasks:
                    ok, _, data = self._can_extend(sim, task)
                    if not ok:
                        can_merge = False
                        break
                    self._apply_block(sim, task, data)

                if can_merge:
                    # Apply for real
                    for task in b.tasks:
                        ok, _, data = self._can_extend(a, task)
                        if ok:
                            self._apply_block(a, task, data)
                    merged_ids.add(b.id)
                    _log.info(
                        "[CSP-MERGE] Merged duty %d into %d (vehicle %d)",
                        b.id, a.id, _vid,
                    )
                    # Don't increment — try merging next duty into updated a
                else:
                    i += 1

        before = len(duties)
        duties = [d for d in duties if d.id not in merged_ids]
        after = len(duties)
        if before != after:
            _log.info("[CSP-MERGE] Merged %d duties: %d → %d", before - after, before, after)
        return duties
