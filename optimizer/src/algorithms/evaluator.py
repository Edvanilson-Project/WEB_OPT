"""
Avaliador de custo de soluções VSP e CSP.
Função objetivo: custo_frota + custo_tripulação + penalidade_violações
"""
from __future__ import annotations

from typing import Dict, List

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


class CostEvaluator(ICostEvaluator):
    """Calcula o custo total de uma solução, separando frota e tripulação."""

    def __init__(
        self,
        crew_cost_per_hour: float = _DEFAULT_CREW_COST_PER_HOUR,
        violation_penalty: float = _CCT_VIOLATION_PENALTY,
        long_unpaid_break_limit_minutes: int = _LONG_UNPAID_BREAK_LIMIT_MINUTES,
        long_unpaid_break_penalty_weight: float = _LONG_UNPAID_BREAK_PENALTY_WEIGHT,
    ):
        self.crew_cost_per_hour = crew_cost_per_hour
        self.violation_penalty = violation_penalty
        self.long_unpaid_break_limit_minutes = max(0, int(long_unpaid_break_limit_minutes))
        self.long_unpaid_break_penalty_weight = max(0.0, float(long_unpaid_break_penalty_weight))

    # ── Frota ─────────────────────────────────────────────────────────────────

    def vsp_cost(self, solution: VSPSolution, vehicle_types: List[VehicleType]) -> float:
        """
        Custo total da frota:
          Σ_blocos f_k + Σ_conexões c_ij + Σ_viagens(custo_km + custo_hora)
        """
        vt_map: Dict[int, VehicleType] = {vt.id: vt for vt in vehicle_types}
        total = 0.0

        for block in solution.blocks:
            vt = vt_map.get(block.vehicle_type_id or 0)  # type: ignore[arg-type]
            total += float(block.meta.get("activation_cost", vt.fixed_cost if vt else settings.default_vehicle_fixed_cost))
            total += float(block.meta.get("connection_cost", 0.0))
            for trip in block.trips:
                if vt:
                    total += (
                        vt.cost_per_km * trip.distance_km
                        + vt.cost_per_hour * (trip.duration / 60)
                    )
                else:
                    total += (
                        trip.distance_km * settings.default_cost_per_km
                        + (trip.duration / 60.0) * settings.default_cost_per_hour
                    )
        return total

    # ── Tripulação ────────────────────────────────────────────────────────────

    def csp_cost(self, solution: CSPSolution) -> float:
        """
        Custo total de tripulação:
          Σ_deveres (horas_efetivas × custo_hora) + Σ_violações × penalidade
        """
        total = 0.0
        for duty in solution.duties:
            total += (duty.work_time / 60.0) * self.crew_cost_per_hour
            waiting_minutes = max(0, duty.paid_minutes - max(duty.work_time, duty.meta.get("guaranteed_minutes", duty.work_time)))
            total += (waiting_minutes / 60.0) * self.crew_cost_per_hour
            unpaid_break_minutes = max(0, duty.spread_time - duty.work_time)
            long_unpaid_break = max(0, unpaid_break_minutes - self.long_unpaid_break_limit_minutes)
            total += (long_unpaid_break ** 2) * self.long_unpaid_break_penalty_weight
            if duty.nocturnal_minutes > 0:
                total += (duty.nocturnal_minutes / 60.0) * self.crew_cost_per_hour * float(duty.meta.get("nocturnal_extra_pct", 0.20))
            if duty.meta.get("holiday_extra_pct"):
                total += (duty.work_time / 60.0) * self.crew_cost_per_hour * float(duty.meta.get("holiday_extra_pct", 0.0))
            total += (duty.rest_violations + duty.shift_violations) * self.violation_penalty
        # Violações de CCT reportadas na solução (duplicadas podem ser ignoradas)
        total += solution.cct_violations * self.violation_penalty
        return total

    # ── Total ─────────────────────────────────────────────────────────────────

    def total_cost(
        self,
        result: OptimizationResult,
        vehicle_types: List[VehicleType],
    ) -> float:
        return self.vsp_cost(result.vsp, vehicle_types) + self.csp_cost(result.csp)

    # ── Penalidade de inviabilidade ───────────────────────────────────────────

    def infeasibility_penalty(self, solution: VSPSolution) -> float:
        """Penalidade para viagens não atribuídas (usada nos метаheurísticos)."""
        return len(solution.unassigned_trips) * self.violation_penalty * 10

    def block_cost(self, block: Block, vehicle_types: List[VehicleType]) -> float:
        """Custo de um único bloco (utilizado no CSP Set Partitioning)."""
        vt_map = {vt.id: vt for vt in vehicle_types}
        vt = vt_map.get(block.vehicle_type_id or 0)  # type: ignore[arg-type]
        cost = 0.0
        if vt:
            for trip in block.trips:
                cost += vt.trip_cost(trip)
        else:
            # Custo fixo de ativação é por bloco, não por viagem
            cost += settings.default_vehicle_fixed_cost
            for trip in block.trips:
                cost += (
                    trip.distance_km * settings.default_cost_per_km
                    + (trip.duration / 60.0) * settings.default_cost_per_hour
                )
        return cost
