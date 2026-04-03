"""
Testes unitários para as novas regras regulatórias, EV e formulações avançadas.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from src.algorithms.csp.greedy import GreedyCSP
from src.algorithms.csp.set_partitioning import SetPartitioningCSP
from src.algorithms.vsp.greedy import GreedyVSP
from src.core.exceptions import HardConstraintViolationError
from src.domain.models import AlgorithmType, Block, Trip, VehicleType
from src.services.optimizer_service import OptimizerService


def _trip(
    tid: int,
    start: int,
    dur: int,
    *,
    line: int = 1,
    origin: int = 1,
    dest: int = 2,
    depot: int | None = None,
    energy: float = 0.0,
    night: bool = False,
):
    start_time = start if not night else 22 * 60 + start
    return Trip(
        id=tid,
        line_id=line,
        start_time=start_time,
        end_time=start_time + dur,
        origin_id=origin,
        destination_id=dest,
        duration=dur,
        distance_km=max(1.0, dur / 3),
        depot_id=depot,
        energy_kwh=energy,
        deadhead_times={origin: 8, dest: 8},
    )


def _vehicle(electric: bool = False) -> list[VehicleType]:
    return [
        VehicleType(
            id=1,
            name="EV" if electric else "Diesel",
            passenger_capacity=40,
            cost_per_km=2.0,
            cost_per_hour=50.0,
            fixed_cost=800.0,
            is_electric=electric,
            battery_capacity_kwh=40.0 if electric else 0.0,
            minimum_soc=0.2 if electric else 0.0,
            charge_rate_kw=60.0 if electric else 0.0,
            energy_cost_per_kwh=0.8 if electric else 0.0,
        )
    ]


def test_natural_language_same_depot_rule_generates_warning():
    trips = [
        _trip(1, 360, 60, depot=1, origin=1, dest=2),
        _trip(2, 450, 60, depot=2, origin=2, dest=3),
    ]
    svc = OptimizerService()
    with pytest.raises(HardConstraintViolationError) as exc:
        svc.run(
            trips,
            _vehicle(),
            algorithm=AlgorithmType.GREEDY,
            vsp_params={"natural_language_rules": ["Início e fim no mesmo depósito"]},
        )
    assert "DUTY_SAME_DEPOT_VIOLATION" in str(exc.value)


def test_ev_soc_rule_marks_unassignable_trip():
    trips = [_trip(1, 360, 60, energy=35.0)]
    sol = GreedyVSP(vsp_params={"max_simultaneous_chargers": 1}).solve(trips, _vehicle(electric=True))
    assert len(sol.unassigned_trips) == 1
    assert any("EV_SOC_INSUFFICIENT" in w for w in sol.warnings)


def test_greedy_csp_applies_guaranteed_pay_and_night_minutes():
    block = Block(id=1, trips=[_trip(1, 0, 60, night=True)])
    sol = GreedyCSP(min_guaranteed_work_minutes=240, nocturnal_start_hour=22, nocturnal_end_hour=5).solve([block], block.trips)
    duty = sol.duties[0]
    assert duty.nocturnal_minutes > 0
    assert duty.paid_minutes >= 240


def test_weekly_limit_creates_second_roster():
    blocks = []
    for day in range(7):
        start = day * 1440 + 6 * 60
        blocks.append(Block(id=day + 1, trips=[_trip(day + 1, start, 540)]))
    sol = GreedyCSP(weekly_driving_limit_minutes=3360, inter_shift_rest_minutes=660).solve(blocks, [])
    assert sol.meta["roster_count"] == 2


def test_set_covering_reports_workpieces_and_pricing_meta():
    blocks = [
        Block(id=1, trips=[_trip(1, 360, 60)]),
        Block(id=2, trips=[_trip(2, 450, 60, origin=2, dest=1)]),
        Block(id=3, trips=[_trip(3, 600, 60)]),
        Block(id=4, trips=[_trip(4, 690, 60, origin=2, dest=1)]),
    ]
    sol = SetPartitioningCSP(vsp_params={"pricing_enabled": True, "max_trips_per_piece": 2}).solve(blocks, [])
    assert sol.meta["workpieces_generated"] > 0
    assert sol.meta["roster_count"] >= 1


def test_vsp_enforces_min_layover_even_same_terminal():
    trips = [
        _trip(1, 360, 60, line=91, origin=1, dest=2, depot=1),
        _trip(2, 420, 60, line=91, origin=2, dest=3, depot=1),
    ]
    sol = GreedyVSP(vsp_params={"min_layover_minutes": 10}).solve(trips, _vehicle())
    assert len(sol.blocks) == 2


def test_vsp_allows_vehicle_split_shift_reuse():
    trips = [
        _trip(1, 360, 60, line=93, origin=1, dest=2, depot=1),
        _trip(2, 660, 60, line=93, origin=2, dest=1, depot=1),
    ]

    baseline = GreedyVSP(
        vsp_params={
            "min_layover_minutes": 15,
            "idle_cost_per_minute": 10.0,
            "max_connection_cost_for_reuse_ratio": 1.0,
            "allow_vehicle_split_shifts": False,
            "enable_single_trip_compaction": False,
        }
    ).solve(trips, _vehicle())
    split = GreedyVSP(
        vsp_params={
            "min_layover_minutes": 15,
            "idle_cost_per_minute": 10.0,
            "max_connection_cost_for_reuse_ratio": 1.0,
            "allow_vehicle_split_shifts": True,
            "split_shift_min_gap_minutes": 120,
            "split_shift_max_gap_minutes": 420,
            "enable_single_trip_compaction": False,
        }
    ).solve(trips, _vehicle())

    assert len(baseline.blocks) == 2
    assert len(split.blocks) == 1


def test_vsp_compacts_single_trip_blocks_when_viable():
    trips = [
        _trip(1, 360, 60, line=94, origin=1, dest=2, depot=1),
        _trip(2, 450, 60, line=94, origin=2, dest=1, depot=1),
        _trip(3, 1200, 60, line=94, origin=1, dest=2, depot=1),
    ]
    sol = GreedyVSP(
        vsp_params={
            "min_layover_minutes": 15,
            "idle_cost_per_minute": 10.0,
            "max_connection_cost_for_reuse_ratio": 1.0,
            "allow_vehicle_split_shifts": False,
            "enable_single_trip_compaction": True,
            "single_trip_compaction_max_gap_minutes": 420,
        }
    ).solve(trips, _vehicle())
    assert len(sol.blocks) == 2


def test_optimizer_avoids_short_layover_in_output_solution():
    trips = [
        _trip(1, 360, 60, line=92, origin=1, dest=2, depot=1),
        _trip(2, 420, 60, line=92, origin=2, dest=1, depot=1),
    ]
    result = OptimizerService().run(
        trips,
        _vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={"strict_hard_validation": True},
        vsp_params={"min_layover_minutes": 10},
        time_budget_s=5.0,
    )
    assert len(result.vsp.blocks) == 2


def test_run_cutting_splits_long_block_and_avoids_meal_break_violation():
    block = Block(
        id=1,
        trips=[
            _trip(1, 360, 120, depot=1, origin=1, dest=2),
            _trip(2, 480, 120, depot=1, origin=2, dest=1),
            _trip(3, 600, 120, depot=1, origin=1, dest=2),
        ],
    )
    solver = GreedyCSP(
        meal_break_minutes=30,
        mandatory_break_after_minutes=240,
        max_shift_minutes=480,
        max_work_minutes=420,
        min_break_minutes=30,
        allow_relief_points=True,
    )
    tasks, meta = solver.prepare_tasks([block])
    sol = solver.solve([block], block.trips)
    assert meta["task_count"] >= 2
    assert sol.cct_violations == 0
    assert all(duty.rest_violations == 0 for duty in sol.duties)


def test_natural_language_max_shift_rule_is_applied():
    trips = [
        _trip(1, 360, 180, depot=1, origin=1, dest=2),
        _trip(2, 550, 180, depot=1, origin=2, dest=1),
    ]
    svc = OptimizerService()
    result = svc.run(
        trips,
        _vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={"natural_language_rules": ["Nenhum motorista deve trabalhar mais de 9 horas"]},
        vsp_params={"pricing_enabled": True, "use_set_covering": True},
        time_budget_s=5.0,
    )
    assert result.meta["input"]["cct_params"]["max_shift_minutes"] == 540


def test_vsp_preserves_preferred_ida_volta_pairing_under_competition():
    trips = [
        _trip(1, 360, 60, line=10, origin=100, dest=200, depot=1),
        _trip(2, 430, 60, line=10, origin=100, dest=200, depot=1),
        _trip(3, 500, 60, line=10, origin=200, dest=100, depot=1),
        _trip(4, 570, 60, line=10, origin=200, dest=100, depot=1),
    ]
    sol = GreedyVSP().solve(trips, _vehicle())
    blocks = sorted(([t.id for t in block.trips] for block in sol.blocks), key=lambda item: item[0])
    assert blocks == [[1, 3], [2, 4]]
    assert sol.meta["preferred_pair_count"] == 2
    assert sol.meta["preferred_pair_breaks"] == 0


def test_pairing_guard_reduces_pair_breaks_vs_disabled_mode():
    trips = [
        _trip(1, 360, 55, line=22, origin=11, dest=22, depot=1),
        _trip(2, 390, 55, line=22, origin=11, dest=22, depot=1),
        _trip(3, 430, 55, line=22, origin=22, dest=11, depot=1),
        _trip(4, 460, 55, line=22, origin=22, dest=11, depot=1),
        _trip(5, 500, 55, line=22, origin=11, dest=22, depot=1),
        _trip(6, 530, 55, line=22, origin=22, dest=11, depot=1),
    ]
    guarded = GreedyVSP().solve(trips, _vehicle())
    unguarded = GreedyVSP(vsp_params={"preserve_preferred_pairs": False}).solve(trips, _vehicle())
    assert guarded.meta["preferred_pair_breaks"] <= unguarded.meta.get("preferred_pair_breaks", guarded.meta["preferred_pair_breaks"] + 1)
    assert guarded.meta["paired_connections_followed"] >= unguarded.meta.get("paired_connections_followed", 0)


def test_optimizer_trip_group_pairing_is_soft_by_default():
    trips = [
        Trip(
            id=1,
            line_id=60,
            start_time=360,
            end_time=420,
            origin_id=10,
            destination_id=20,
            trip_group_id=900,
            duration=60,
            deadhead_times={10: 8, 20: 8},
        ),
        Trip(
            id=2,
            line_id=60,
            start_time=430,
            end_time=490,
            origin_id=20,
            destination_id=10,
            trip_group_id=900,
            duration=60,
            deadhead_times={10: 8, 20: 8},
        ),
    ]
    result = OptimizerService().run(
        trips,
        _vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        vsp_params={"preserve_preferred_pairs": True},
        cct_params={"allow_relief_points": True},
        time_budget_s=5.0,
    )
    assert "mandatory_trip_groups_same_duty" not in result.meta["input"]["cct_params"]


def test_greedy_csp_can_enforce_single_line_duty():
    blocks = [
        Block(id=1, trips=[_trip(1, 360, 60, line=70, origin=10, dest=20, depot=1)]),
        Block(id=2, trips=[_trip(2, 430, 60, line=71, origin=20, dest=10, depot=1)]),
    ]

    unrestricted = GreedyCSP(allow_relief_points=True).solve(blocks, [])
    restricted = GreedyCSP(allow_relief_points=True, enforce_single_line_duty=True).solve(blocks, [])

    assert len(unrestricted.duties) == 1
    assert len(restricted.duties) == 2
    assert all(len(set(duty.meta.get("line_ids", []))) == 1 for duty in restricted.duties)


def test_hard_validation_rejects_ghost_bus_input():
    trips = [
        Trip(
            id=1,
            line_id=1,
            start_time=360,
            end_time=420,
            origin_id=1,
            destination_id=2,
            duration=60,
            sent_to_driver_terminal=False,
            deadhead_times={1: 8, 2: 8},
        )
    ]
    with pytest.raises(HardConstraintViolationError) as exc:
        OptimizerService().run(trips, _vehicle(), algorithm=AlgorithmType.GREEDY)
    assert "GHOST_BUS_TERMINAL_SYNC" in str(exc.value)


def test_hard_validation_rejects_invalid_gps_input():
    trips = [
        Trip(
            id=1,
            line_id=1,
            start_time=360,
            end_time=420,
            origin_id=1,
            destination_id=2,
            duration=60,
            origin_latitude=-12.9,
            origin_longitude=-38.5,
            destination_latitude=140.0,
            destination_longitude=-38.4,
            deadhead_times={1: 8, 2: 8},
        )
    ]
    with pytest.raises(HardConstraintViolationError) as exc:
        OptimizerService().run(trips, _vehicle(), algorithm=AlgorithmType.GREEDY)
    assert "GPS_LATITUDE_INVALID_DESTINATION" in str(exc.value)


def test_hard_validation_rejects_mandatory_group_split():
    trips = [
        _trip(1, 360, 60, line=30, origin=10, dest=20, depot=1),
        _trip(2, 390, 60, line=30, origin=10, dest=20, depot=1),
        _trip(3, 500, 60, line=30, origin=20, dest=10, depot=1),
        _trip(4, 570, 60, line=30, origin=20, dest=10, depot=1),
    ]
    with pytest.raises(HardConstraintViolationError) as exc:
        OptimizerService().run(
            trips,
            _vehicle(),
            algorithm=AlgorithmType.HYBRID_PIPELINE,
            cct_params={"mandatory_trip_groups_same_duty": [[1, 2]], "allow_relief_points": True},
            vsp_params={"preserve_preferred_pairs": True},
            time_budget_s=5.0,
        )
    assert "MANDATORY_GROUP_SPLIT" in str(exc.value)


def test_set_covering_respects_column_limit_meta():
    blocks = [
        Block(id=index + 1, trips=[_trip(index + 1, 360 + index * 70, 55, line=40, origin=1 if index % 2 == 0 else 2, dest=2 if index % 2 == 0 else 1, depot=1)])
        for index in range(8)
    ]
    sol = SetPartitioningCSP(
        vsp_params={
            "pricing_enabled": True,
            "max_trips_per_piece": 4,
            "max_generated_columns": 20,
            "max_candidate_successors_per_task": 3,
            "max_pricing_iterations": 1,
            "max_pricing_additions": 10,
        }
    ).solve(blocks, [])
    assert sol.meta["workpieces_generated"] <= 20
    assert sol.meta["column_generation"]["max_generated_columns"] == 20


def test_operator_profiles_assign_senior_to_mandatory_early_shift():
    trips = [
        _trip(1, 300, 60, line=40, origin=10, dest=20, depot=1),
        _trip(2, 380, 60, line=40, origin=20, dest=10, depot=1),
        _trip(3, 980, 60, line=41, origin=30, dest=40, depot=1),
        _trip(4, 1060, 60, line=41, origin=40, dest=30, depot=1),
    ]
    result = OptimizerService().run(
        trips,
        _vehicle(),
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        cct_params={
            "operator_profiles": [
                {"id": 1, "name": "Senior", "seniority_rank": 1, "mandatory_shift_types": ["early"]},
                {"id": 2, "name": "Junior", "seniority_rank": 2, "mandatory_shift_types": ["late"]},
            ]
        },
        vsp_params={"preserve_preferred_pairs": True},
        time_budget_s=5.0,
    )
    assignment = result.csp.meta["operator_assignment"]["rosters"]
    early = next(item for item in assignment if item["shift_type"] == "early")
    late = next(item for item in assignment if item["shift_type"] == "late")
    assert early["operator_name"] == "Senior"
    assert late["operator_name"] == "Junior"


def test_hard_validation_rejects_missing_union_compatible_operator():
    trips = [
        _trip(1, 300, 60, line=50, origin=10, dest=20, depot=1),
        _trip(2, 380, 60, line=50, origin=20, dest=10, depot=1),
    ]
    with pytest.raises(HardConstraintViolationError) as exc:
        OptimizerService().run(
            trips,
            _vehicle(),
            algorithm=AlgorithmType.HYBRID_PIPELINE,
            cct_params={
                "operator_profiles": [
                    {"id": 1, "name": "LateOnly", "seniority_rank": 1, "mandatory_shift_types": ["late"]},
                ],
                "strict_union_rules": True,
            },
            vsp_params={"preserve_preferred_pairs": True},
            time_budget_s=5.0,
        )
    assert "UNASSIGNED_OPERATOR_PROFILE" in str(exc.value)
