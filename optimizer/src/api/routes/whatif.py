"""
POST /api/v1/evaluate-delta — Recálculo what-if após rearranjo de trips no Gantt.
"""
from __future__ import annotations

import logging
from copy import deepcopy
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ...domain.models import Block, CSPSolution, OptimizationResult, Trip, VehicleType, VSPSolution
from ...algorithms.evaluator import CostEvaluator
from ...algorithms.utils import sort_block_trips

router = APIRouter()
logger = logging.getLogger(__name__)
evaluator = CostEvaluator()


class WhatIfRequest(BaseModel):
    blocks: List[Dict[str, Any]] = Field(..., description="Estado atual dos blocos")
    trip_id: int = Field(..., description="ID da viagem sendo movida")
    source_block_id: int = Field(..., description="ID do bloco de origem")
    target_block_id: int = Field(..., description="ID do bloco de destino")
    target_index: int = Field(..., description="Posição no bloco destino")
    vehicle_types: Optional[List[Dict[str, Any]]] = Field(default_factory, description="Tipos de veículos")


class BlockResponse(BaseModel):
    block_id: int
    trips: List[int]
    num_trips: int
    start_time: int
    end_time: int
    total_cost: float


class WhatIfResponse(BaseModel):
    status: str = "ok"
    blocks: List[BlockResponse]
    cost_breakdown: Dict[str, Any]


def _dict_to_trip(data: Dict[str, Any]) -> Trip:
    return Trip(
        id=data["id"],
        line_id=data["line_id"],
        start_time=data["start_time"],
        end_time=data["end_time"],
        origin_id=data["origin_id"],
        destination_id=data["destination_id"],
        trip_group_id=data.get("trip_group_id"),
        direction=data.get("direction"),
        duration=data.get("duration", 0),
        distance_km=data.get("distance_km", 0.0),
        depot_id=data.get("depot_id"),
        relief_point_id=data.get("relief_point_id"),
        is_relief_point=data.get("is_relief_point", False),
        deadhead_times=data.get("deadhead_times", {}),
        idle_before_minutes=data.get("idle_before_minutes", 0),
        idle_after_minutes=data.get("idle_after_minutes", 0),
    )


def _dict_to_vehicle_type(data: Dict[str, Any]) -> VehicleType:
    return VehicleType(
        id=data["id"],
        name=data["name"],
        passenger_capacity=data["passenger_capacity"],
        cost_per_km=data.get("cost_per_km", 0.0),
        cost_per_hour=data.get("cost_per_hour", 0.0),
        fixed_cost=data.get("fixed_cost", 800.0),
        is_electric=data.get("is_electric", False),
        battery_capacity_kwh=data.get("battery_capacity_kwh", 0.0),
        minimum_soc=data.get("minimum_soc", 0.15),
        charge_rate_kw=data.get("charge_rate_kw", 0.0),
        energy_cost_per_kwh=data.get("energy_cost_per_kwh", 0.0),
        depot_id=data.get("depot_id"),
    )


def _block_from_dict(data: Dict[str, Any]) -> Block:
    trips = [_dict_to_trip(t) for t in data.get("trips", [])]
    block = Block(id=data["id"], trips=trips)
    if data.get("vehicle_type_id"):
        block.vehicle_type_id = data["vehicle_type_id"]
    return block


def _block_to_response(block: Block, vehicle_types: List[VehicleType]) -> BlockResponse:
    trip_ids = [t.id for t in block.trips]
    start_time = block.trips[0].start_time if block.trips else 0
    end_time = block.trips[-1].end_time if block.trips else 0
    total_cost = evaluator.block_cost(block, vehicle_types)
    return BlockResponse(
        block_id=block.id,
        trips=trip_ids,
        num_trips=len(trip_ids),
        start_time=start_time,
        end_time=end_time,
        total_cost=total_cost,
    )


@router.post(
    "/evaluate-delta",
    response_model=WhatIfResponse,
    tags=["what-if"],
)
async def evaluate_delta(request: WhatIfRequest) -> WhatIfResponse:
    blocks = deepcopy(request.blocks)
    vehicle_types = (
        [_dict_to_vehicle_type(v) for v in request.vehicle_types]
        if request.vehicle_types
        else []
    )

    trip_id = request.trip_id
    source_block_id = request.source_block_id
    target_block_id = request.target_block_id
    target_index = request.target_index

    source_block_data = None
    target_block_data = None

    for b in blocks:
        if b["id"] == source_block_id:
            source_block_data = b
        if b["id"] == target_block_id:
            target_block_data = b

    if source_block_data is None:
        raise HTTPException(status_code=404, detail=f"Source block {source_block_id} not found")

    trip_data = None
    for t in source_block_data.get("trips", []):
        if t["id"] == trip_id:
            trip_data = t
            break

    if trip_data is None:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found in source block")

    source_block_data["trips"] = [t for t in source_block_data.get("trips", []) if t["id"] != trip_id]

    if target_block_data is None:
        target_block_data = {"id": target_block_id, "trips": [], "vehicle_type_id": None}
        blocks.append(target_block_data)

    target_trips = target_block_data.get("trips", [])
    if target_index < 0 or target_index > len(target_trips):
        target_index = len(target_trips)
    target_trips.insert(target_index, trip_data)
    target_block_data["trips"] = target_trips

    blocks = [b for b in blocks if b.get("trips")]

    block_objects = [_block_from_dict(b) for b in blocks]
    sort_block_trips(block_objects)

    mock_vsp = VSPSolution(
        blocks=block_objects,
        unassigned_trips=[],
        algorithm="what_if",
    )
    mock_csp = CSPSolution(duties=[], algorithm="mock")
    mock_result = OptimizationResult(
        vsp=mock_vsp,
        csp=mock_csp,
        algorithm="what_if",
    )

    cost_breakdown = evaluator.total_cost_breakdown(mock_result, vehicle_types)

    block_responses = [_block_to_response(b, vehicle_types) for b in block_objects]

    return WhatIfResponse(
        status="ok",
        blocks=block_responses,
        cost_breakdown=cost_breakdown,
    )
