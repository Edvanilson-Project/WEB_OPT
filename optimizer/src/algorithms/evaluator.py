"""
Avaliador de custo de soluções VSP e CSP.
Função objetivo: custo_frota + custo_tripulação + penalidade_violações

NOTA DE PRECISÃO: Todos os acumuladores internos operam em float cru (full
precision).  ``round(x, 2)`` é aplicado **apenas** nas chaves que serão
exibidas na UI / retornadas pela API (variável ``_R``).  Isso evita drift de
arredondamento acumulado em operações com 1 000+ deveres/blocos.
"""
from __future__ import annotations

from typing import Any, Dict, List

from ..core.config import get_settings
from ..domain.interfaces import ICostEvaluator
from ..domain.models import (
    Block,
    CSPSolution,
    OptimizationResult,
    VehicleType,
    VSPSolution,
)

settings = get_settings()

# Custo horário padrão caso o tipo de veículo não informe custo de tripulante
_DEFAULT_CREW_COST_PER_HOUR = 25.0
_CCT_VIOLATION_PENALTY = 500.0   # multa por violação de CCT (por ocorrência)
_LONG_UNPAID_BREAK_LIMIT_MINUTES = 90
_LONG_UNPAID_BREAK_PENALTY_WEIGHT = 0.05
_DEFAULT_OVERTIME_EXTRA_PCT = 0.5


def _R(v: float) -> float:
    """Arredonda para exibição (2 casas).  Usado apenas na saída, nunca em acumuladores."""
    return round(v, 2)


class CostEvaluator(ICostEvaluator):
    """Calcula o custo total de uma solução, separando frota e tripulação."""

    def __init__(
        self,
        crew_cost_per_hour: float = _DEFAULT_CREW_COST_PER_HOUR,
        violation_penalty: float = _CCT_VIOLATION_PENALTY,
        long_unpaid_break_limit_minutes: int = _LONG_UNPAID_BREAK_LIMIT_MINUTES,
        long_unpaid_break_penalty_weight: float = _LONG_UNPAID_BREAK_PENALTY_WEIGHT,
        idle_cost_per_minute: float = 0.25,
        overtime_extra_pct: float = _DEFAULT_OVERTIME_EXTRA_PCT,
    ):
        self.crew_cost_per_hour = crew_cost_per_hour
        self.violation_penalty = violation_penalty
        self.long_unpaid_break_limit_minutes = max(0, int(long_unpaid_break_limit_minutes))
        self.long_unpaid_break_penalty_weight = max(0.0, float(long_unpaid_break_penalty_weight))
        self.idle_cost_per_minute = idle_cost_per_minute
        self.overtime_extra_pct = max(0.0, float(overtime_extra_pct))

    def _long_unpaid_break_penalty(self, unpaid_break_minutes: int) -> float:
        """Piecewise-linear penalty.

        Faixas após o limite base:
        - primeiros 30 min de excesso: 1x peso
        - próximos 60 min: 3x peso
        - acima disso: 10x peso
        """
        excess = max(0, int(unpaid_break_minutes) - self.long_unpaid_break_limit_minutes)
        if excess <= 0:
            return 0.0

        tier1 = min(excess, 30)
        tier2 = min(max(0, excess - 30), 60)
        tier3 = max(0, excess - 90)
        return self.long_unpaid_break_penalty_weight * (
            tier1 * 1.0
            + tier2 * 3.0
            + tier3 * 10.0
        )

    # ── Frota ─────────────────────────────────────────────────────────────────

    def _vehicle_trip_components(self, vt: VehicleType | None, trip) -> Dict[str, float]:
        if vt:
            return {
                "distance": vt.cost_per_km * trip.distance_km,
                "time": vt.cost_per_hour * (trip.duration / 60.0),
            }
        return {
            "distance": trip.distance_km * settings.default_cost_per_km,
            "time": (trip.duration / 60.0) * settings.default_cost_per_hour,
        }

    def vsp_cost_breakdown(self, solution: VSPSolution, vehicle_types: List[VehicleType]) -> Dict[str, Any]:
        vt_map: Dict[int, VehicleType] = {vt.id: vt for vt in vehicle_types}
        blocks: List[Dict[str, Any]] = []
        activation = 0.0
        connection = 0.0
        distance = 0.0
        time = 0.0
        idle_cost = 0.0

        for block in solution.blocks:
            vt = vt_map.get(block.vehicle_type_id or 0)  # type: ignore[arg-type]
            block_activation = float(
                block.meta.get(
                    "activation_cost",
                    vt.fixed_cost if vt else settings.default_vehicle_fixed_cost,
                )
            )
            block_connection = float(block.meta.get("connection_cost", 0.0))
            block_distance = 0.0
            block_time = 0.0
            start_buffer = max(0, int(block.meta.get("start_buffer_minutes", 0) or 0))
            end_buffer = max(0, int(block.meta.get("end_buffer_minutes", 0) or 0))
            has_boundary_buffers = "start_buffer_minutes" in block.meta or "end_buffer_minutes" in block.meta
            block_idle_cost = (start_buffer + end_buffer) * self.idle_cost_per_minute if has_boundary_buffers else 0.0

            for trip in block.trips:
                components = self._vehicle_trip_components(vt, trip)
                block_distance += components["distance"]
                block_time += components["time"]
                if not has_boundary_buffers:
                    block_idle_cost += (
                        trip.idle_before_minutes + trip.idle_after_minutes
                    ) * self.idle_cost_per_minute

            activation += block_activation
            connection += block_connection
            distance += block_distance
            time += block_time
            idle_cost += block_idle_cost
            blocks.append(
                {
                    "block_id": block.id,
                    "vehicle_type_id": block.vehicle_type_id,
                    "num_trips": len(block.trips),
                    "activation": _R(block_activation),
                    "connection": _R(block_connection),
                    "distance": _R(block_distance),
                    "time": _R(block_time),
                    "idle_cost": _R(block_idle_cost),
                    "total": _R(block_activation + block_connection + block_distance + block_time + block_idle_cost),
                    "start_buffer_minutes": start_buffer,
                    "end_buffer_minutes": end_buffer,
                    "advisory_idle_proxy_cost": _R(block_idle_cost),
                }
            )

        total = activation + connection + distance + time + idle_cost
        return {
            "total": _R(total),
            "activation": _R(activation),
            "connection": _R(connection),
            "distance": _R(distance),
            "time": _R(time),
            "idle_cost": _R(idle_cost),
            "num_blocks": len(solution.blocks),
            "num_unassigned_trips": len(solution.unassigned_trips),
            "advisory_idle_proxy_cost": _R(idle_cost),
            "advisory_infeasibility_penalty": _R(self.infeasibility_penalty(solution)),
            "blocks": blocks,
        }

    def vsp_cost(self, solution: VSPSolution, vehicle_types: List[VehicleType]) -> float:
        """
        Custo total da frota:
          Σ_blocos f_k + Σ_conexões c_ij + Σ_viagens(custo_km + custo_hora)
        """
        return float(self.vsp_cost_breakdown(solution, vehicle_types)["total"])

    # ── Tripulação ────────────────────────────────────────────────────────────

    def csp_cost_breakdown(self, solution: CSPSolution) -> Dict[str, Any]:
        duties: List[Dict[str, Any]] = []
        work_cost = 0.0
        guaranteed_cost = 0.0
        waiting_cost = 0.0
        overtime_cost = 0.0
        long_unpaid_break_penalty = 0.0
        nocturnal_extra = 0.0
        holiday_extra = 0.0
        cct_penalties = 0.0

        for duty in solution.duties:
            duty_work_cost = (duty.work_time / 60.0) * self.crew_cost_per_hour
            guaranteed_minutes = max(
                int(duty.work_time),
                int(duty.meta.get("guaranteed_minutes", duty.work_time) or duty.work_time),
            )
            paid_minutes = max(int(duty.paid_minutes or 0), guaranteed_minutes)
            guaranteed_extra_minutes = max(0, guaranteed_minutes - int(duty.work_time))
            paid_waiting_minutes = max(0, paid_minutes - guaranteed_minutes)
            duty_guaranteed_cost = (guaranteed_extra_minutes / 60.0) * self.crew_cost_per_hour
            duty_waiting_cost = (paid_waiting_minutes / 60.0) * self.crew_cost_per_hour
            duty_overtime_cost = (
                (max(0, int(duty.overtime_minutes or 0)) / 60.0)
                * self.crew_cost_per_hour
                * float(duty.meta.get("overtime_extra_pct", self.overtime_extra_pct))
            )
            unpaid_break_minutes = max(
                0,
                int(duty.meta.get("unpaid_break_total_minutes", max(0, duty.spread_time - duty.work_time)) or 0),
            )
            duty_long_break_penalty = self._long_unpaid_break_penalty(unpaid_break_minutes)
            duty_nocturnal_extra = 0.0
            if duty.nocturnal_minutes > 0:
                duty_nocturnal_extra = (
                    (duty.nocturnal_minutes / 60.0)
                    * self.crew_cost_per_hour
                    * float(duty.meta.get("nocturnal_extra_pct", 0.20))
                )
            duty_holiday_extra = 0.0
            if duty.meta.get("holiday_extra_pct"):
                duty_holiday_extra = (
                    (duty.work_time / 60.0)
                    * self.crew_cost_per_hour
                    * float(duty.meta.get("holiday_extra_pct", 0.0))
                )
            duty_cct_penalties = (duty.rest_violations + duty.shift_violations) * self.violation_penalty

            work_cost += duty_work_cost
            guaranteed_cost += duty_guaranteed_cost
            waiting_cost += duty_waiting_cost
            overtime_cost += duty_overtime_cost
            long_unpaid_break_penalty += duty_long_break_penalty
            nocturnal_extra += duty_nocturnal_extra
            holiday_extra += duty_holiday_extra
            cct_penalties += duty_cct_penalties
            duties.append(
                {
                    "duty_id": duty.id,
                    "work_cost": _R(duty_work_cost),
                    "guaranteed_cost": _R(duty_guaranteed_cost),
                    "waiting_cost": _R(duty_waiting_cost),
                    "overtime_cost": _R(duty_overtime_cost),
                    "long_unpaid_break_penalty": _R(duty_long_break_penalty),
                    "nocturnal_extra": _R(duty_nocturnal_extra),
                    "holiday_extra": _R(duty_holiday_extra),
                    "cct_penalties": _R(duty_cct_penalties),
                    "total": _R(
                        duty_work_cost
                        + duty_guaranteed_cost
                        + duty_waiting_cost
                        + duty_overtime_cost
                        + duty_long_break_penalty
                        + duty_nocturnal_extra
                        + duty_holiday_extra
                        + duty_cct_penalties,
                    ),
                }
            )

        total = (
            work_cost
            + guaranteed_cost
            + waiting_cost
            + overtime_cost
            + long_unpaid_break_penalty
            + nocturnal_extra
            + holiday_extra
            + cct_penalties
        )
        return {
            "total": _R(total),
            "work_cost": _R(work_cost),
            "guaranteed_cost": _R(guaranteed_cost),
            "waiting_cost": _R(waiting_cost),
            "overtime_cost": _R(overtime_cost),
            "long_unpaid_break_penalty": _R(long_unpaid_break_penalty),
            "nocturnal_extra": _R(nocturnal_extra),
            "holiday_extra": _R(holiday_extra),
            "cct_penalties": _R(cct_penalties),
            "num_duties": len(solution.duties),
            "num_uncovered_blocks": len(solution.uncovered_blocks),
            "duties": duties,
        }

    def csp_cost(self, solution: CSPSolution) -> float:
        """
        Custo total de tripulação:
          Σ_deveres (horas_efetivas × custo_hora) + Σ_violações × penalidade
        """
        return float(self.csp_cost_breakdown(solution)["total"])

    # ── Total ─────────────────────────────────────────────────────────────────

    def total_cost(
        self,
        result: OptimizationResult,
        vehicle_types: List[VehicleType],
    ) -> float:
        return float(self.total_cost_breakdown(result, vehicle_types)["total"])

    def total_cost_breakdown(
        self,
        result: OptimizationResult,
        vehicle_types: List[VehicleType],
    ) -> Dict[str, Any]:
        vsp = self.vsp_cost_breakdown(result.vsp, vehicle_types)
        csp = self.csp_cost_breakdown(result.csp)
        total = float(vsp["total"]) + float(csp["total"])
        return {
            "total": _R(total),
            "vsp": vsp,
            "csp": csp,
            "shares": {
                "vsp": round((float(vsp["total"]) / total), 4) if total > 0 else 0.0,
                "csp": round((float(csp["total"]) / total), 4) if total > 0 else 0.0,
            },
        }

    # ── Penalidade de inviabilidade ───────────────────────────────────────────

    def infeasibility_penalty(self, solution: VSPSolution) -> float:
        """Penalidade para viagens não atribuídas (usada nos метаheurísticos)."""
        return len(solution.unassigned_trips) * self.violation_penalty * 10

    def block_cost(self, block: Block, vehicle_types: List[VehicleType]) -> float:
        """Custo de um único bloco (utilizado no CSP Set Partitioning).
        Inclui custo de tempo ocioso (pull-out/pull-back e idle entre viagens)."""
        vt_map = {vt.id: vt for vt in vehicle_types}
        vt = vt_map.get(block.vehicle_type_id or 0)  # type: ignore[arg-type]
        cost = 0.0
        idle_cost_per_min = self.idle_cost_per_minute
        if vt:
            cost += vt.fixed_cost
            for trip in block.trips:
                components = self._vehicle_trip_components(vt, trip)
                cost += components["distance"] + components["time"]
                # Custo do tempo ocioso antes/depois da viagem (pull-out/pull-back)
                cost += (trip.idle_before_minutes + trip.idle_after_minutes) * idle_cost_per_min
        else:
            # Custo fixo de ativação é por bloco, não por viagem
            cost += settings.default_vehicle_fixed_cost
            for trip in block.trips:
                components = self._vehicle_trip_components(None, trip)
                cost += components["distance"] + components["time"]
                cost += (trip.idle_before_minutes + trip.idle_after_minutes) * idle_cost_per_min
        return cost
