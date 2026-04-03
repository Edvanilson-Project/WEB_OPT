"""
Utilitários compartilhados pelos algoritmos de busca (SA, TS, GA).

Funções:
  - sort_block_trips(blocks)    — re-ordena viagens por start_time em cada bloco
  - block_is_feasible(block)    — verifica sobreposição básica (gap >= 0) 
  - blocks_are_feasible(blocks) — verifica todos os blocos
  - quick_cost_sorted(blocks)   — custo rápido com trips já ordenadas
"""
from __future__ import annotations

from copy import deepcopy
from typing import List, Tuple

from ..domain.models import Block


def sort_block_trips(blocks: List[Block]) -> List[Block]:
    """
    Ordena as viagens dentro de cada bloco por start_time.
    Retorna os mesmos objetos (modifica in-place).
    """
    for b in blocks:
        b.trips.sort(key=lambda t: (t.start_time, t.end_time))
    return blocks


def block_is_feasible(block: Block, min_gap: int = 10) -> bool:
    """
    Retorna True se as viagens no bloco não se sobrepõem e o gap é suficiente.
    - gap >= max(min_gap, deadhead_times) entre o fim de uma viagem e o início da próxima
    - deadhead_times codifica layover mínimo por terminal
    - Contiguous trip_group pairs (ida/volta with gap=0) are exempt
    Presume que trips estão ordenadas por start_time.
    """
    trips = block.trips
    for i in range(len(trips) - 1):
        cur = trips[i]
        nxt = trips[i + 1]
        gap = nxt.start_time - cur.end_time
        # Contiguous trip_group pair (ida/volta): no layover needed
        if (
            gap == 0
            and getattr(cur, "trip_group_id", None) is not None
            and cur.trip_group_id == getattr(nxt, "trip_group_id", None)
        ):
            continue
        dest = cur.destination_id
        orig = nxt.origin_id
        if gap < min_gap:
            return False
        needed_deadhead = int(cur.deadhead_times.get(orig, 0))
        if gap < max(min_gap, needed_deadhead):
            return False
        # Cross-line é permitido quando allow_multi_line_block=true (default)
    return True


def blocks_are_feasible(blocks: List[Block]) -> bool:
    """Retorna True se TODOS os blocos são fisicamente viáveis."""
    return all(block_is_feasible(b) for b in blocks)


def quick_cost_sorted(blocks: List[Block]) -> float:
    """
    Estimativa de custo: igual a _quick_cost em sa.py mas ORDENA trips primeiro.
    Corrige o bug B4 (SPREAD_NEGATIVO) onde trips fora de ordem geravam gaps negativos.
    Cross-line é permitido para minimizar veículos.
    """
    total = 0.0
    for b in blocks:
        # Ordena antes de calcular — CORREÇÃO BUG B4
        sorted_trips = sorted(b.trips, key=lambda t: t.start_time)
        total += 10000.0  # custo fixo por veículo (alto para priorizar minimização de frota)
        for i in range(len(sorted_trips) - 1):
            gap = sorted_trips[i + 1].start_time - sorted_trips[i].end_time
            total += max(0, gap) * 0.5  # penalidade por tempo ocioso
        # Penaliza sobreposições pesadamente
        for i in range(len(sorted_trips) - 1):
            gap = sorted_trips[i + 1].start_time - sorted_trips[i].end_time
            if gap < 0:
                total += abs(gap) * 50.0  # penalidade forte por overlap
        # Cross-line é permitido — não penalizar
    return total


def sort_and_filter(blocks: List[Block]) -> Tuple[List[Block], bool]:
    """
    Ordena trips em todos os blocos e verifica factibilidade.
    Retorna (blocks_ordenados, is_feasible).
    """
    sort_block_trips(blocks)
    feasible = blocks_are_feasible(blocks)
    return blocks, feasible
