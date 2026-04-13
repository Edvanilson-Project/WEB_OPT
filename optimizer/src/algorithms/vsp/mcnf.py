"""
VSP Ótimo via Minimum Cost Network Flow (MCNF) / Bipartite Matching.

Resolve o Vehicle Scheduling Problem de forma GLOBAL, batendo heurísticas gulosas
através da Teoria dos Grafos. A modelagem garante o emparelhamento exato com
o mínimo de ativação de veículos.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple, Set

import numpy as np
from scipy.optimize import linear_sum_assignment

from ...core.config import get_settings
from ...domain.interfaces import IVSPAlgorithm
from ...domain.models import Block, Trip, VehicleType, VSPSolution
from ..base import BaseAlgorithm

_log = logging.getLogger(__name__)
settings = get_settings()

class MCNFVSP(BaseAlgorithm, IVSPAlgorithm):
    """
    Otimiza a frota com Bipartite Graph Matching.
    
    A formulação expande N trips em uma matriz de Custo 2N x 2N:
    [ T->T (Conexão)    | T->D (Pull-in)  ]
    ---------------------------------------
    [ D->T (Pull-out)   | D->D (Dummy)    ]
    
    A resolução desta matriz por `linear_sum_assignment` garante a cadeia 
    global incancelável que minimiza os custos operacionais da frota.
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
    ) -> VSPSolution:
        self._start_timer()
        if not trips:
            return VSPSolution(algorithm=self.name)
            
        _log.info(f"MCNF Engine inicializado para {len(trips)} viagens. Montando Super-Grafo.")
        
        # Parâmetros de negócio
        vehicle = vehicle_types[0] if vehicle_types else None
        fixed_cost = float(self._p("fixed_vehicle_activation_cost", vehicle.fixed_cost if vehicle else settings.default_vehicle_fixed_cost))
        deadhead_cost = float(self._p("deadhead_cost_per_minute", 1.0))
        idle_cost = float(self._p("idle_cost_per_minute", 0.25))
        min_layover = int(self._p("min_layover_minutes", 8))
        max_shift = int(self._p("max_vehicle_shift_minutes", 960))
        allow_multi = bool(self._p("allow_multi_line_block", True))
        connection_tolerance = int(self._p("connection_tolerance_minutes", 0))
        pullout_m = int(self._p("pullout_minutes", 10))
        pullback_m = int(self._p("pullback_minutes", 10))
        garage_return_cost = (pullout_m + pullback_m) * deadhead_cost
        
        # Split Shift window (igual ao greedy)
        allow_split = bool(self._p("allow_vehicle_split_shifts", True))
        split_min = int(self._p("split_shift_min_gap_minutes", 120))
        split_max = int(self._p("split_shift_max_gap_minutes", 600))
        
        # Custo Infinito para matriz de penalização
        INF = 1e9
        N = len(trips)
        
        # Ordenação Cronológica de trips base
        trips_sorted = sorted(trips, key=lambda t: (t.start_time, t.id))
        
        # Inicializa a C-Matrix com INF
        # C terá (2N) x (2N)
        C = np.full((2 * N, 2 * N), INF, dtype=np.float64)
        
        # 1. Matriz T -> T (Conexões Inter-Trip) -- top-left (N x N)
        for i in range(N):
            for j in range(N):
                if i == j: continue
                # Se Trip [j] já começou antes do fim de [i]
                if trips_sorted[j].start_time < trips_sorted[i].end_time:
                    continue
                
                # Respeito de linhas (Se strict single line allowed)
                if not allow_multi and trips_sorted[i].line_id != trips_sorted[j].line_id:
                    continue
                    
                gap = trips_sorted[j].start_time - trips_sorted[i].end_time
                dh = max(min_layover, int(trips_sorted[i].deadhead_times.get(trips_sorted[j].origin_id, 0)))
                
                # É fisicamente impossível de alcançar (com tolerância)
                if gap + connection_tolerance < dh:
                    continue
                
                # Excede a ociosidade segura máxima definida
                if gap > max_shift:
                    continue
                
                # Calcula o Custo (Deadhead + Horas Ociosas)
                idle = gap - dh
                cost = (dh * deadhead_cost) + (idle * idle_cost)
                
                # Se for uma janela de Split Shift, aplicamos a política de recolhimento
                if allow_split and split_min <= gap <= split_max:
                    garage_policy = self._p("vsp_garage_return_policy", "smart")
                    if garage_policy == "always":
                        cost = garage_return_cost
                    elif garage_policy == "never":
                        pass # idle_cost (calculado acima)
                    else: # smart
                        cost = min(cost, garage_return_cost)
                
                # Bonus para emparelhamento perfeito (Trips idênticos / voltas de linha)
                if trips_sorted[i].destination_id == trips_sorted[j].origin_id:
                    cost -= (fixed_cost * 0.05) # "paired_trip_bonus"
                
                C[i, j] = max(0.0, cost)

        # 2. Matriz T -> D (Pull-in) -- top-right (N x N)
        # O custo reflete o recolhimento do veículo no fim do turno. 
        for i in range(N):
            C[i, N + i] = 0.0
        
        # 3. Matriz D -> T (Pull-out) -- bottom-left (N x N)
        # Sair do depot custa fixamente activation_cost
        for i in range(N):
            C[N + i, i] = fixed_cost
            
        # 4. Matriz D -> D (Dummy) -- bottom-right (N x N)
        # Zero custo em todo o quadrante D->D para permitir transbordos cruzados de preservação de balanceamento
        C[N:2*N, N:2*N] = 0.0

        # Resolução Extrema (LAP via SciPy em C++)
        _log.info("Resolvendo Bipartite Matching (C++ backend SciPy)...")
        lap_start = time.time()
        row_ind, col_ind = linear_sum_assignment(C)
        lap_end = time.time()
        
        _log.info(f"Matching Ótimo achado em {lap_end - lap_start:.3f}s")
        
        # Traçar caminhos (De volta para Chains Block Form)
        # Se i conecta a j (onde i < N e j < N), significa que a viagem i é seguida pela viag j.
        next_trip = {}
        targets = set()  # trips que são destino de conexão inter-trip
        for r, c in zip(row_ind, col_ind):
            if r < N and c < N:
                next_trip[r] = c
                targets.add(c)
                
        visited = set()
        blocks = []
        block_id_counter = 1
        
        for i in range(N):
            if i not in visited:
                # Raiz = não é destino de nenhuma conexão inter-trip
                if i not in targets:
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
                    
                    # Refina status
                    for idx in range(len(chain)-1):
                        tdh = max(min_layover, int(chain[idx].deadhead_times.get(chain[idx+1].origin_id, 0)))
                        tgap = chain[idx+1].start_time - chain[idx].end_time
                        tidle = max(0, tgap - tdh)
                        
                        block.meta["deadhead_minutes"] += tdh
                        block.meta["idle_minutes"] += tidle
                        block.meta["connection_cost"] += (tdh * deadhead_cost) + (tidle * idle_cost)

                    blocks.append(block)
                    block_id_counter += 1

        total_trips_packed = sum(len(b.trips) for b in blocks)
        _log.info(f"MCNF consolidou {total_trips_packed}/{N} trips em {len(blocks)} blocos de veículos.")
        
        # Pós-processamento Relaxado para Veículos Elétricos (SoC limits)
        if vehicle and vehicle.is_electric and vehicle.battery_capacity_kwh > 0:
            fragmented_blocks = []
            for block in blocks:
                current_chain = []
                current_soc_kwh = vehicle.battery_capacity_kwh
                min_soc_kwh = vehicle.battery_capacity_kwh * vehicle.minimum_soc
                
                for idx, t in enumerate(block.trips):
                    base_e = t.energy_kwh if t.energy_kwh > 0 else (t.distance_km * 1.25)
                    topo = 1.0 + max(0.0, t.elevation_gain_m) * 0.0008
                    energy_need = base_e * topo
                    
                    # Simula recarga em depot
                    if idx > 0 and t.depot_id is not None:
                        gap = t.start_time - block.trips[idx-1].end_time
                        if gap > 0:
                            charged = min(vehicle.charge_rate_kw * (gap / 60.0), vehicle.battery_capacity_kwh)
                            current_soc_kwh = min(vehicle.battery_capacity_kwh, current_soc_kwh + charged)
                            
                    if current_soc_kwh - energy_need < min_soc_kwh and len(current_chain) > 0:
                        # Bloqueio esgotou, fecha a cadeia e abre outra van
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
                _log.info(f"EV Relaxer fragmentou {len(blocks)} blocos originais para {len(fragmented_blocks)} veículos devido a limites de Bateria.")
            blocks = fragmented_blocks
        
        # Caso restem trips que o Network simplex considerou inf (ex: impossíveis), marca como unassigned
        unassigned_trips = [t for t in trips_sorted if t.id not in {tr.id for b in blocks for tr in b.trips}]

        return VSPSolution(
            blocks=blocks,
            unassigned_trips=unassigned_trips,
            algorithm=self.name,
            elapsed_ms=self._elapsed_ms(),
            meta={
                "bipartite_matrix_size": f"{2*N}x{2*N}",
                "lap_solver_time_s": lap_end - lap_start,
                "objective": "Min Cost Network Matrix"
            }
        )
