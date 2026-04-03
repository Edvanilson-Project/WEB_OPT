"""
POST /optimize — executa o pipeline de otimização VSP+CSP.
"""
import logging

from fastapi import APIRouter, HTTPException

from ...core.exceptions import OptimizerError
from ...domain.models import Trip, VehicleType
from ...services.optimizer_service import OptimizerService
from ..schemas import BlockOutput, DutyOutput, ErrorResponse, OptimizeRequest, OptimizeResponse

router = APIRouter()
logger = logging.getLogger(__name__)
_service = OptimizerService()


def _to_trip(t) -> Trip:
    return Trip(
        id=t.id,
        line_id=t.line_id,
        trip_group_id=t.trip_group_id,
        start_time=t.start_time,
        end_time=t.end_time,
        origin_id=t.origin_id,
        destination_id=t.destination_id,
        duration=t.duration,
        distance_km=t.distance_km,
        depot_id=t.depot_id,
        relief_point_id=t.relief_point_id,
        is_relief_point=t.is_relief_point,
        energy_kwh=t.energy_kwh,
        elevation_gain_m=t.elevation_gain_m,
        service_day=t.service_day,
        is_holiday=t.is_holiday,
        origin_latitude=t.origin_latitude,
        origin_longitude=t.origin_longitude,
        destination_latitude=t.destination_latitude,
        destination_longitude=t.destination_longitude,
        sent_to_driver_terminal=t.sent_to_driver_terminal,
        gps_valid=t.gps_valid,
        deadhead_times={int(k): v for k, v in (t.deadhead_times or {}).items()},
    )


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
        result = _service.run(
            trips=trips,
            vehicle_types=vehicle_types,
            algorithm=body.algorithm,
            depot_id=body.depot_id,
            time_budget_s=body.time_budget_s,
            cct_params=body.cct_params,
            vsp_params=body.vsp_params,
        )
    except OptimizerError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": str(exc)}) from exc
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
        blocks=[BlockOutput(**b) for b in raw["blocks"]],
        duties=[DutyOutput(**d) for d in raw["duties"]],
        warnings=raw.get("warnings", []),
        meta={
            **(raw.get("meta") or {}),
            "run_id": body.run_id,
            "line_id": body.line_id,
            "company_id": body.company_id,
        },
    )
