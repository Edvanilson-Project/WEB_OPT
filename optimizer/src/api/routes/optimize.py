"""
POST /optimize — executa o pipeline de otimização VSP+CSP.
"""
import asyncio
import logging

from fastapi import APIRouter, HTTPException

from ...core.exceptions import OptimizerError
from ...domain.models import Trip, VehicleType
from ...services.optimizer_service import OptimizerService
from ..converters import to_trip as _to_trip
from ..schemas import BlockOutput, DutyOutput, ErrorResponse, OptimizeRequest, OptimizeResponse

router = APIRouter()
logger = logging.getLogger(__name__)
_service = OptimizerService()


def _to_vt(v) -> VehicleType:
    return VehicleType(
        id=v.id,
        name=v.name,
        passenger_capacity=v.passenger_capacity,
        cost_per_km=v.cost_per_km,
        cost_per_hour=v.cost_per_hour,
        fixed_cost=v.fixed_cost,
        is_electric=v.is_electric,
        battery_capacity_kwh=v.battery_capacity_kwh,
        minimum_soc=v.minimum_soc,
        charge_rate_kw=v.charge_rate_kw,
        energy_cost_per_kwh=v.energy_cost_per_kwh,
        depot_id=v.depot_id,
    )


@router.post(
    "/",
    response_model=OptimizeResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    tags=["optimization"],
)
async def optimize(body: OptimizeRequest) -> OptimizeResponse:
    if not body.trips:
        raise HTTPException(status_code=400, detail="trips list cannot be empty")

    trips = [_to_trip(t) for t in body.trips]
    vehicle_types = [_to_vt(v) for v in body.vehicle_types]

    try:
        result = await asyncio.to_thread(
            _service.run,
            trips=trips,
            vehicle_types=vehicle_types,
            algorithm=body.algorithm,
            depot_id=body.depot_id,
            time_budget_s=body.time_budget_s,
            cct_params=body.cct_params,
            vsp_params=body.vsp_params,
        )
    except OptimizerError as exc:
        diagnostics = exc.details or _service.build_failure_payload(
            exc,
            trips,
            body.algorithm,
            body.cct_params.model_dump(exclude_none=True) if body.cct_params else {},
            body.vsp_params.model_dump(exclude_none=True) if body.vsp_params else {},
            stage="api",
        )
        raise HTTPException(
            status_code=400,
            detail={
                "code": exc.code,
                "message": str(exc),
                "diagnostics": diagnostics,
            },
        ) from exc
    except Exception as exc:
        logger.exception("optimization_failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    raw = result.as_dict()

    return OptimizeResponse(
        status="ok",
        vehicles=raw["vehicles"],
        crew=raw["crew"],
        total_trips=raw.get("total_trips", len(trips)),
        total_cost=raw["total_cost"],
        cct_violations=raw["cct_violations"],
        unassigned_trips=raw["unassigned_trips"],
        uncovered_blocks=raw["uncovered_blocks"],
        vsp_algorithm=raw["vsp_algorithm"],
        csp_algorithm=raw["csp_algorithm"],
        elapsed_ms=raw["elapsed_ms"],
        blocks=[
            BlockOutput(**{
                **b,
                "trips": [t["id"] if isinstance(t, dict) else t for t in b.get("trips", [])],
            })
            for b in raw["blocks"]
        ],
        duties=[DutyOutput(**d) for d in raw["duties"]],
        warnings=raw.get("warnings", []),
        cost_breakdown=raw.get("cost_breakdown") or {},
        solver_explanation=raw.get("solver_explanation") or {},
        phase_summary=raw.get("phase_summary") or {},
        trip_group_audit=raw.get("trip_group_audit") or {},
        reproducibility=raw.get("reproducibility") or {},
        performance=(raw.get("meta") or {}).get("performance") or {},
        meta={
            **(raw.get("meta") or {}),
            "run_id": body.run_id,
            "line_id": body.line_id,
            "company_id": body.company_id,
        },
    )
