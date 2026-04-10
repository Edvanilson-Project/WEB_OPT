#!/usr/bin/env python3
"""Test each validation check individually"""

import sys
import time
import signal
import traceback
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

from tests.qa_professional_validation_2026 import (
    check_daily_shift_limit, check_intershift_11h, check_break_30_each_4h,
    check_meal_break_1h, check_no_overlap_vehicle_and_driver,
    check_relief_points_terminal_only, check_deadhead_realistic,
    check_single_vehicle_per_operator, check_ev_soc_safety,
    check_ev_charger_capacity_validation, check_ev_topography_effect,
    check_marginal_cost_monotonicity, check_fairness_target_and_tolerance,
    check_minimize_stretches, check_macro_whatif_feedback_modules,
    check_rostering_layer, check_feedback_persistence_cycle,
    check_integrated_joint_behavior
)

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException("Check timed out")

signal.signal(signal.SIGALRM, timeout_handler)

checks = [
    ("Jornada diária (8/10/12h)", check_daily_shift_limit),
    ("Descanso interjornada ≥ 11h", check_intershift_11h),
    ("Pausa 30 min a cada 4h", check_break_30_each_4h),
    ("Intervalo refeição ≥ 1h", check_meal_break_1h),
    ("Sem overlap veículo/motorista", check_no_overlap_vehicle_and_driver),
    ("Troca somente em terminal/depot", check_relief_points_terminal_only),
    ("Deadhead realista", check_deadhead_realistic),
    ("Pareamento operador-veículo", check_single_vehicle_per_operator),
    ("SoC nunca abaixo do mínimo", check_ev_soc_safety),
    ("Capacidade de carregador", check_ev_charger_capacity_validation),
    ("Topografia afeta descarga", check_ev_topography_effect),
    ("Custo marginal coerente", check_marginal_cost_monotonicity),
    ("Fairness (6-8h, ±30 min)", check_fairness_target_and_tolerance),
    ("Minimização de stretches", check_minimize_stretches),
    ("Macro + What-if + Plan-vs-real", check_macro_whatif_feedback_modules),
    ("Camada de rostering", check_rostering_layer),
    ("Ciclo feedback persistente", check_feedback_persistence_cycle),
    ("Otimização integrada (Joint)", check_integrated_joint_behavior),
]

print(f"Testing {len(checks)} validation checks with 10s timeout each...\n")

for i, (name, check_func) in enumerate(checks, 1):
    signal.alarm(10)  # 10 second timeout per check
    start = time.time()

    try:
        ok, detail = check_func()
        signal.alarm(0)  # Cancel timeout
        elapsed = time.time() - start
        status = "✓" if ok else "✗"
        print(f"{i:2d}. {status} {name:40} {elapsed:5.2f}s  {detail}")

    except TimeoutException:
        elapsed = time.time() - start
        signal.alarm(0)
        print(f"{i:2d}. ⏱️ {name:40} {elapsed:5.2f}s  TIMED OUT")

    except Exception as e:
        elapsed = time.time() - start
        signal.alarm(0)
        print(f"{i:2d}. ✗ {name:40} {elapsed:5.2f}s  ERROR: {type(e).__name__}: {e}")

signal.alarm(0)  # Ensure timeout is cleared
print("\nDone.")