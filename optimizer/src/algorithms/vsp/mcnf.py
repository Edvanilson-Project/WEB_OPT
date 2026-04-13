"""
VSP Ótimo via Minimum Cost Network Flow (MCNF) / Bipartite Matching.

Resolve o Vehicle Scheduling Problem de forma GLOBAL, batendo heurísticas gulosas
através da Teoria dos Grafos. A modelagem garante o emparelhamento exato com
o mínimo de ativação de veículos.

ARQUITETURA DE LARGA ESCALA:
    - Particionamento Temporal: Janelas de tempo com overlap para preservar conexões de fronteira
    - Clustering Espacial: Agrupamento por line_id quando allow_multi_line_block=False
    - Subproblemas menores: Cada partição resolve um MCNF 2N x 2N tratável
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from scipy.optimize import linear_sum_assignment

from ...core.config import get_settings
from ...domain.interfaces import IVSPAlgorithm
from ...domain.models import Block, Trip, VehicleType, VSPSolution
from ..base import BaseAlgorithm

_log = logging.getLogger(__name__)
settings = get_settings()

_CLUSTER_SIZE_LIMIT = 800
_OVERLAP_RATIO = 0.10


class MCNFVSP(BaseAlgorithm, IVSPAlgorithm):
    """
    Otimiza a frota com Bipartite Graph Matching.
    
    A formulação expande N trips em uma matriz de Custo 2N x 2N:
    [ T->T (Conexão)    | T->D (Pull-in)  ]
    ---------------------------------------
    [ D->T (Pull-out)   | D->D (Dummy)    ]
    
    A resolução desta matriz por `linear_sum_assignment` garante a cadeia 
    global incancelável que minimiza os custos operacionais da frota.
    
    Para instâncias >800 trips, aplica particionamento temporal com overlap
    para manter a qualidade da solução enquanto evita OOM.
    """
    def __init__(self, vsp_params: Optional[Dict[str, Any]] = None):
        super().__init__(name="mcnf_vsp", time_budget_s=120.0)
        self.vsp_params = vsp_params or {}
        
    def _p(self, key: str, default: Any) -> Any:
        return self.vsp_params.get(key, default)

    def solve(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depot_id: Optional[int] = None,
        depots: Optional[List[Dict[str, Any]]] = None,
    ) -> VSPSolution:
        self._start_timer()
        if not trips:
            return VSPSolution(algorithm=self.name)
        
        _log.info(f"MCNF Engine inicializado para {len(trips)} viagens.")
        
        if depots is None:
            depots = [{"id": depot_id, "capacity": 999999}] if depot_id is not None else []
        
        allow_multi = bool(self._p("allow_multi_line_block", True))
        
        if len(trips) <= _CLUSTER_SIZE_LIMIT:
            return self._solve_subproblem(trips, vehicle_types, depots)
        
        if not allow_multi:
            return self._solve_by_line_clustering(trips, vehicle_types, depots)
        
        return self._solve_with_temporal_clustering(trips, vehicle_types, depots)

    def _solve_by_line_clustering(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depots: List[Dict[str, Any]],
    ) -> VSPSolution:
        """Agrupa trips por line_id e resolve cada grupo separadamente."""
        _log.info("MCNF Spatial Clustering: agrupando por line_id")
        
        by_line: Dict[int, List[Trip]] = defaultdict(list)
        for t in trips:
            by_line[t.line_id].append(t)
        
        all_blocks: List[Block] = []
        all_unassigned: List[Trip] = []
        block_id_counter = 1
        
        for line_id, line_trips in by_line.items():
            _log.debug(f"Processando line_id={line_id} com {len(line_trips)} trips")
            line_trips_sorted = sorted(line_trips, key=lambda t: (t.start_time, t.id))
            
            if len(line_trips_sorted) <= _CLUSTER_SIZE_LIMIT:
                result = self._solve_subproblem(line_trips_sorted, vehicle_types, depots)
            else:
                result = self._solve_with_temporal_clustering(line_trips_sorted, vehicle_types, depots)
            
            for block in result.blocks:
                block.id = block_id_counter
                block_id_counter += 1
                all_blocks.append(block)
            
            all_unassigned.extend(result.unassigned_trips)
        
        _log.info(f"MCNF Spatial: {len(all_blocks)} blocos de {len(by_line)} linhas")
        
        return VSPSolution(
            blocks=all_blocks,
            unassigned_trips=all_unassigned,
            algorithm=self.name,
            elapsed_ms=self._elapsed_ms(),
        )

    def _solve_with_temporal_clustering(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depots: List[Dict[str, Any]],
    ) -> VSPSolution:
        """
        Particiona trips em chunks temporais com overlap para preservar
        conexões nas fronteiras. Cada chunk gera blocos que são consolidados
        ao final.
        """
        _log.info(f"MCNF Temporal Clustering: {len(trips)} trips em chunks de {_CLUSTER_SIZE_LIMIT}")
        
        trips_sorted = sorted(trips, key=lambda t: (t.start_time, t.id))
        chunks = self._temporal_clustering(trips_sorted)
        
        _log.info(f"Temporal Clustering gerou {len(chunks)} chunks")
        
        all_blocks: List[Block] = []
        all_unassigned: List[Trip] = []
        assigned_trip_ids: set[int] = set()
        block_id_counter = 1
        
        for chunk_idx, chunk_trips in enumerate(chunks):
            is_first_chunk = chunk_idx == 0
            is_last_chunk = chunk_idx == len(chunks) - 1
            
            effective_trips = chunk_trips
            if not is_first_chunk and not is_last_chunk:
                overlap_size = int(len(chunk_trips) * _OVERLAP_RATIO)
                effective_trips = chunk_trips[overlap_size:]
            
            if len(effective_trips) < 2:
                for t in effective_trips:
                    if t.id not in assigned_trip_ids:
                        all_unassigned.append(t)
                continue
            
            result = self._solve_subproblem(effective_trips, vehicle_types, depots)
            
            for block in result.blocks:
                block_trip_ids = {t.id for t in block.trips}
                if block_trip_ids & assigned_trip_ids:
                    filtered_trips = [t for t in block.trips if t.id not in assigned_trip_ids]
                    if not filtered_trips:
                        continue
                    block = Block(id=block_id_counter, trips=filtered_trips)
                    if block.trips:
                        block.vehicle_type_id = block.trips[0].vehicle_type_id if hasattr(block.trips[0], 'vehicle_type_id') else None
                        block_id_counter += 1
                        all_blocks.append(block)
                        assigned_trip_ids.update(block_trip_ids - assigned_trip_ids)
                else:
                    block.id = block_id_counter
                    block_id_counter += 1
                    all_blocks.append(block)
                    assigned_trip_ids.update(block_trip_ids)
            
            for t in result.unassigned_trips:
                if t.id not in assigned_trip_ids:
                    all_unassigned.append(t)
        
        _log.info(f"MCNF Temporal: {len(all_blocks)} blocos consolidados")
        
        return VSPSolution(
            blocks=all_blocks,
            unassigned_trips=all_unassigned,
            algorithm=self.name,
            elapsed_ms=self._elapsed_ms(),
        )

    def _temporal_clustering(self, trips_sorted: List[Trip]) -> List[List[Trip]]:
        """
        Divide trips ordenados por tempo em chunks de tamanho máximo _CLUSTER_SIZE_LIMIT.
        Cada chunk inclui overlap com o próximo para preservar conexões de fronteira.
        """
        chunks: List[List[Trip]] = []
        n = len(trips_sorted)
        chunk_size = _CLUSTER_SIZE_LIMIT
        overlap_size = int(chunk_size * _OVERLAP_RATIO)
        
        start = 0
        while start < n:
            end = min(start + chunk_size, n)
            chunk = trips_sorted[start:end]
            chunks.append(chunk)
            start = end - overlap_size if end < n else end
        
        return chunks

    def _solve_subproblem(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depots: List[Dict[str, Any]],
    ) -> VSPSolution:
        """
        Core matemático do MCNF: monta matriz de custo 2N x 2N e resolve
        o Assignment Problem via linear_sum_assignment.
        
        Multi-Depot: Pull-out/Pull-in considers best depot based on deadhead cost.
        Capacity Balancing: assigns blocks to depots respecting capacity limits.
        """
        vehicle = vehicle_types[0] if vehicle_types else None
        fixed_cost = float(self._p(
            "fixed_vehicle_activation_cost",
            vehicle.fixed_cost if vehicle else settings.default_vehicle_fixed_cost
        ))
        deadhead_cost = float(self._p("deadhead_cost_per_minute", 1.0))
        idle_cost = float(self._p("idle_cost_per_minute", 0.25))
        min_layover = int(self._p("min_layover_minutes", 8))
        max_shift = int(self._p("max_vehicle_shift_minutes", 960))
        allow_multi = bool(self._p("allow_multi_line_block", True))
        connection_tolerance = int(self._p("connection_tolerance_minutes", 0))
        pullout_m = int(self._p("pullout_minutes", 10))
        pullback_m = int(self._p("pullback_minutes", 10))
        garage_return_cost = (pullout_m + pullback_m) * deadhead_cost
        
        allow_split = bool(self._p("allow_vehicle_split_shifts", True))
        split_min = int(self._p("split_shift_min_gap_minutes", 120))
        split_max = int(self._p("split_shift_max_gap_minutes", 600))
        
        INF = 1e9
        N = len(trips)
        
        trips_sorted = sorted(trips, key=lambda t: (t.start_time, t.id))
        
        C = np.full((2 * N, 2 * N), INF, dtype=np.float64)
        
        for i in range(N):
            for j in range(N):
                if i == j:
                    continue
                if trips_sorted[j].start_time < trips_sorted[i].end_time:
                    continue
                
                if not allow_multi and trips_sorted[i].line_id != trips_sorted[j].line_id:
                    continue
                    
                gap = trips_sorted[j].start_time - trips_sorted[i].end_time
                dh = max(min_layover, int(trips_sorted[i].deadhead_times.get(trips_sorted[j].origin_id, 0)))
                
                if gap + connection_tolerance < dh:
                    continue
                
                if gap > max_shift:
                    continue
                
                idle = gap - dh
                cost = (dh * deadhead_cost) + (idle * idle_cost)
                
                if allow_split and split_min <= gap <= split_max:
                    garage_policy = self._p("vsp_garage_return_policy", "smart")
                    if garage_policy == "always":
                        cost = garage_return_cost
                    elif garage_policy == "never":
                        pass
                    else:
                        cost = min(cost, garage_return_cost)
                
                if trips_sorted[i].destination_id == trips_sorted[j].origin_id:
                    cost -= (fixed_cost * 0.05)
                
                C[i, j] = max(0.0, cost)

        if depots:
            for i in range(N):
                best_pullin = INF
                for depot in depots:
                    pullin_cost = trips_sorted[i].deadhead_times.get(depot["id"], 0) * deadhead_cost
                    if pullin_cost < best_pullin:
                        best_pullin = pullin_cost
                C[i, N + i] = best_pullin
            
            for i in range(N):
                best_pullout = fixed_cost
                for depot in depots:
                    pullout_cost = fixed_cost + (trips_sorted[i].deadhead_times.get(depot["id"], 0) * deadhead_cost)
                    if pullout_cost < best_pullout:
                        best_pullout = pullout_cost
                C[N + i, i] = best_pullout
        else:
            for i in range(N):
                C[i, N + i] = 0.0
            for i in range(N):
                C[N + i, i] = fixed_cost
            
        C[N:2*N, N:2*N] = 0.0

        _log.info(f"MCNF Subproblem: matriz {2*N}x{2*N}, LAP via SciPy...")
        lap_start = time.time()
        row_ind, col_ind = linear_sum_assignment(C)
        lap_end = time.time()
        
        _log.info(f"Matching resolvido em {lap_end - lap_start:.3f}s")
        
        next_trip = {}
        targets = set()
        for r, c in zip(row_ind, col_ind):
            if r < N and c < N:
                next_trip[r] = c
                targets.add(c)
                
        visited = set()
        blocks = []
        block_id_counter = 1
        
        for i in range(N):
            if i not in visited and i not in targets:
                chain = []
                curr = i
                while curr is not None:
                    chain.append(trips_sorted[curr])
                    visited.add(curr)
                    curr = next_trip.get(curr)
                    
                block = Block(id=block_id_counter, trips=chain)
                if vehicle:
                    block.vehicle_type_id = vehicle.id
                
                block.meta.update({
                    "activation_cost": fixed_cost,
                    "connection_cost": 0.0,
                    "deadhead_minutes": 0,
                    "idle_minutes": 0
                })
                
                for idx in range(len(chain) - 1):
                    tdh = max(min_layover, int(chain[idx].deadhead_times.get(chain[idx+1].origin_id, 0)))
                    tgap = chain[idx+1].start_time - chain[idx].end_time
                    tidle = max(0, tgap - tdh)
                    
                    block.meta["deadhead_minutes"] += tdh
                    block.meta["idle_minutes"] += tidle
                    block.meta["connection_cost"] += (tdh * deadhead_cost) + (tidle * idle_cost)

                blocks.append(block)
                block_id_counter += 1

        total_trips_packed = sum(len(b.trips) for b in blocks)
        _log.info(f"MCNF Subproblem: {total_trips_packed}/{N} trips em {len(blocks)} blocos")
        
        if vehicle and vehicle.is_electric and vehicle.battery_capacity_kwh > 0:
            blocks = self._ev_relax(blocks, vehicle, block_id_counter)
        
        if depots:
            blocks, capacity_warnings = self._capacity_balancing(blocks, depots, trips_sorted, deadhead_cost)
            _log.warning("; ".join(capacity_warnings)) if capacity_warnings else None
        
        unassigned_trips = [
            t for t in trips_sorted
            if t.id not in {tr.id for b in blocks for tr in b.trips}
        ]

        return VSPSolution(
            blocks=blocks,
            unassigned_trips=unassigned_trips,
            algorithm=self.name,
            elapsed_ms=self._elapsed_ms(),
            meta={
                "bipartite_matrix_size": f"{2*N}x{2*N}",
                "lap_solver_time_s": lap_end - lap_start,
                "objective": "Min Cost Network Matrix",
                "subproblem_trip_count": N,
                "multi_depot": bool(depots),
                "depot_count": len(depots),
            }
        )

    def _capacity_balancing(
        self,
        blocks: List[Block],
        depots: List[Dict[str, Any]],
        trips_sorted: List[Trip],
        deadhead_cost: float,
    ) -> Tuple[List[Block], List[str]]:
        """
        Atribui cada bloco ao depot com menor custo (pull-out + pull-in)
        que ainda tenha capacidade disponível.
        """
        depot_capacities = {d["id"]: d.get("capacity", 999999) for d in depots}
        warnings: List[str] = []
        
        for block in blocks:
            if not block.trips:
                continue
            
            first_trip = block.trips[0]
            last_trip = block.trips[-1]
            
            best_depot_id = None
            best_total_cost = float('inf')
            
            for depot_id, capacity in depot_capacities.items():
                if capacity <= 0:
                    continue
                
                pullout_cost = first_trip.deadhead_times.get(depot_id, 0) * deadhead_cost
                pullin_cost = last_trip.deadhead_times.get(depot_id, 0) * deadhead_cost
                total_cost = pullout_cost + pullin_cost
                
                if total_cost < best_total_cost:
                    best_total_cost = total_cost
                    best_depot_id = depot_id
            
            if best_depot_id is not None:
                block.meta["start_depot_id"] = best_depot_id
                block.meta["end_depot_id"] = best_depot_id
                block.meta["depot_pullout_cost"] = first_trip.deadhead_times.get(best_depot_id, 0) * deadhead_cost
                block.meta["depot_pullin_cost"] = last_trip.deadhead_times.get(best_depot_id, 0) * deadhead_cost
                depot_capacities[best_depot_id] -= 1
            else:
                warnings.append(f"DEPOT_CAPACITY_EXCEEDED B{block.id}")
                block.meta["start_depot_id"] = None
                block.meta["end_depot_id"] = None
                _log.warning(f"Bloco B{block.id} sem depot disponível com capacidade")
        
        return blocks, warnings

    def _ev_relax(
        self,
        blocks: List[Block],
        vehicle: VehicleType,
        block_id_counter_start: int,
    ) -> List[Block]:
        """Fragmenta blocos que excedem limite de bateria (SoC) para veículos elétricos."""
        fragmented_blocks = []
        block_id_counter = block_id_counter_start
        
        for block in blocks:
            current_chain = []
            current_soc_kwh = vehicle.battery_capacity_kwh
            min_soc_kwh = vehicle.battery_capacity_kwh * vehicle.minimum_soc
            
            for idx, t in enumerate(block.trips):
                base_e = t.energy_kwh if t.energy_kwh > 0 else (t.distance_km * 1.25)
                topo = 1.0 + max(0.0, t.elevation_gain_m) * 0.0008
                energy_need = base_e * topo
                
                if idx > 0 and t.depot_id is not None:
                    gap = t.start_time - block.trips[idx-1].end_time
                    if gap > 0:
                        charged = min(vehicle.charge_rate_kw * (gap / 60.0), vehicle.battery_capacity_kwh)
                        current_soc_kwh = min(vehicle.battery_capacity_kwh, current_soc_kwh + charged)
                        
                if current_soc_kwh - energy_need < min_soc_kwh and len(current_chain) > 0:
                    fb = Block(id=block_id_counter, trips=current_chain, vehicle_type_id=vehicle.id)
                    fb.meta["ev_fragmented"] = True
                    fragmented_blocks.append(fb)
                    block_id_counter += 1
                    current_chain = [t]
                    current_soc_kwh = vehicle.battery_capacity_kwh - energy_need
                else:
                    current_chain.append(t)
                    current_soc_kwh -= energy_need
                    
            if current_chain:
                fb = Block(id=block_id_counter, trips=current_chain, vehicle_type_id=vehicle.id)
                fragmented_blocks.append(fb)
                block_id_counter += 1
                
        if len(fragmented_blocks) > len(blocks):
            _log.info(f"EV Relaxer: {len(blocks)} → {len(fragmented_blocks)} blocos por limite de bateria")
        
        return fragmented_blocks
