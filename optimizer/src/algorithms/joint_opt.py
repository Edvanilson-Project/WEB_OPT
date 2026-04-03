import logging
from typing import List, Dict, Any, Tuple
import copy
from ..domain.models import CSPSolution, VSPSolution, Trip, Block, Duty

logger = logging.getLogger(__name__)

def _try_merge_vsp_blocks(vsp_sol: VSPSolution, vsp_params: Dict[str, Any]) -> VSPSolution:
    """
    Tenta fundir blocos VSP adjacentes para reduzir veículos.
    Percorre pares de blocos e, se o último trip de b1 pode conectar ao primeiro de b2
    (gap >= deadhead, duração total <= max_vehicle_shift), funde b2 em b1.
    Faz múltiplos passes até não haver mais merges.
    """
    min_layover = int(vsp_params.get("min_layover_minutes", 8))
    max_vehicle_shift = int(vsp_params.get("max_vehicle_shift_minutes", 960))
    allow_multi_line = bool(vsp_params.get("allow_multi_line_block", True))

    blocks = copy.deepcopy(vsp_sol.blocks)
    changed = True
    total_merges = 0

    while changed:
        changed = False
        blocks.sort(key=lambda b: b.start_time)

        i = 0
        while i < len(blocks):
            best_j = None
            best_gap = float("inf")

            for j in range(i + 1, len(blocks)):
                b1 = blocks[i]
                b2 = blocks[j]
                if not b1.trips or not b2.trips:
                    continue

                last_t = b1.trips[-1]
                first_t = b2.trips[0]
                gap = first_t.start_time - last_t.end_time
                if gap < 0:
                    continue

                # Verificar deadhead
                deadhead = int(last_t.deadhead_times.get(first_t.origin_id, 0))
                needed = max(min_layover, deadhead)
                if gap < needed:
                    continue

                # Verificar duração total do bloco consolidado
                total_duration = b2.trips[-1].end_time - b1.trips[0].start_time
                if total_duration > max_vehicle_shift:
                    continue

                # Verificar multi-linha
                if not allow_multi_line:
                    lines_b1 = {t.line_id for t in b1.trips}
                    lines_b2 = {t.line_id for t in b2.trips}
                    if lines_b1 != lines_b2:
                        continue

                if gap < best_gap:
                    best_gap = gap
                    best_j = j

            if best_j is not None:
                blocks[i].trips.extend(blocks[best_j].trips)
                blocks.pop(best_j)
                changed = True
                total_merges += 1
                # Não incrementa i — tenta fundir mais blocos neste
            else:
                i += 1

    # Filtrar blocos vazios independente de merge
    blocks = [b for b in blocks if b.trips]

    if total_merges > 0 or len(blocks) < len(vsp_sol.blocks):
        logger.info(f"[VSP-MERGE] Fundiu {total_merges} blocos: {len(vsp_sol.blocks)} → {len(blocks)}")
        for idx, b in enumerate(blocks):
            b.id = idx + 1
        result = copy.deepcopy(vsp_sol)
        result.blocks = blocks
        return result

    return vsp_sol


def joint_duty_vehicle_swap(
    csp_sol: CSPSolution,
    vsp_sol: VSPSolution,
    trips: List[Trip],
    cct_params: Dict[str, Any],
    kwargs: Dict[str, Any]
) -> Tuple[CSPSolution, VSPSolution]:
    """
    Pós-otimização conjunta Veículo+Tripulante:
    1. Tenta fundir blocos VSP para reduzir veículos
    2. Tenta mover trips entre blocos para criar jornadas mais eficientes
    3. Recalcula CSP se houve mudanças
    """
    logger.info("Executando Post-Otimizacao (VSP merge + Joint swap)...")

    try:
        from .csp.greedy import GreedyCSP

        if len(vsp_sol.blocks) < 2:
            return csp_sol, vsp_sol

        vsp_params = dict(vsp_sol.meta) if vsp_sol.meta else {}
        original_vehicles = len(vsp_sol.blocks)
        original_crew = csp_sol.num_crew

        # ── Fase 1: Merge de blocos VSP ──────────────────────────────────────
        merged_vsp = _try_merge_vsp_blocks(vsp_sol, vsp_params)
        vsp_changed = len(merged_vsp.blocks) < original_vehicles

        # ── Fase 2: Swap de trips entre blocos (multi-pass) ──────────────────
        operator_single_vehicle_only = bool(cct_params.get("operator_single_vehicle_only", False))
        max_unpaid_break = int(cct_params.get("max_unpaid_break_minutes", cct_params.get("max_unpaid_break", 180)))

        swap_vsp = copy.deepcopy(merged_vsp)
        blocks = swap_vsp.blocks
        blocks.sort(key=lambda b: b.start_time)
        total_swaps = 0

        # Multi-pass: continua tentando até não haver mais melhorias
        for _pass in range(5):
            pass_swaps = 0
            for i in range(len(blocks)):
                for j in range(i + 1, len(blocks)):
                    b1 = blocks[i]
                    b2 = blocks[j]
                    if not b1.trips or not b2.trips:
                        continue

                    last_b1 = b1.trips[-1]
                    first_b2 = b2.trips[0]
                    gap = first_b2.start_time - last_b1.end_time

                    if gap < 0 or gap > max_unpaid_break:
                        continue

                    deadhead = int(last_b1.deadhead_times.get(first_b2.origin_id, 0))
                    min_layover = int(vsp_params.get("min_layover_minutes", 8))
                    needed = max(min_layover, deadhead)
                    if gap < needed:
                        continue

                    # Mover primeira trip de b2 para b1
                    b1.trips.append(first_b2)
                    b2.trips.pop(0)
                    pass_swaps += 1
                    total_swaps += 1

            if pass_swaps == 0:
                break
            # Remover blocos vazios e re-numerar
            blocks = [b for b in blocks if b.trips]
            for idx, b in enumerate(blocks):
                b.id = idx + 1

        swap_changed = total_swaps > 0
        if swap_changed:
            swap_vsp.blocks = blocks

        # ── Fase 3: Recalcular CSP se houve qualquer mudança ────────────────
        if vsp_changed or swap_changed:
            final_vsp = swap_vsp if swap_changed else merged_vsp
            logger.info(
                f"[POST-OPT] Veículos: {original_vehicles} → {len(final_vsp.blocks)}, "
                f"merges={original_vehicles - len(merged_vsp.blocks)}, swaps={total_swaps}"
            )

            csp = GreedyCSP(vsp_params=vsp_params, **kwargs)
            new_csp = csp.solve(final_vsp.blocks, trips)

            # Aceitar se não piorou violações E (melhorou veículos OU crew)
            improved_vehicles = len(final_vsp.blocks) < original_vehicles
            improved_crew = new_csp.num_crew <= original_crew
            fewer_violations = new_csp.cct_violations <= csp_sol.cct_violations

            if fewer_violations and (improved_vehicles or improved_crew):
                logger.info(
                    f"[POST-OPT] Aceito: Veículos {original_vehicles}→{len(final_vsp.blocks)}, "
                    f"Crew {original_crew}→{new_csp.num_crew}, "
                    f"Violações {csp_sol.cct_violations}→{new_csp.cct_violations}"
                )
                return new_csp, final_vsp
            else:
                logger.info(
                    f"[POST-OPT] Rejeitado (pioria): Veículos {len(final_vsp.blocks)}, "
                    f"Crew {new_csp.num_crew}, Violações {new_csp.cct_violations}"
                )
                return csp_sol, vsp_sol

        return csp_sol, vsp_sol

    except Exception as e:
        logger.error(f"Erro no post-optimization: {e}")
        return csp_sol, vsp_sol
