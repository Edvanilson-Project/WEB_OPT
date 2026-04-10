#!/usr/bin/env python3
"""Debug validation suite - run each check with timeout"""

import sys
import os
import time
import traceback
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

# Import all check functions
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

checks = [
    ("check_daily_shift_limit", check_daily_shift_limit),
    ("check_intershift_11h", check_intershift_11h),
    ("check_break_30_each_4h", check_break_30_each_4h),
    ("check_meal_break_1h", check_meal_break_1h),
    ("check_no_overlap_vehicle_and_driver", check_no_overlap_vehicle_and_driver),
    ("check_relief_points_terminal_only", check_relief_points_terminal_only),
    ("check_deadhead_realistic", check_deadhead_realistic),
    ("check_single_vehicle_per_operator", check_single_vehicle_per_operator),
    ("check_ev_soc_safety", check_ev_soc_safety),
    ("check_ev_charger_capacity_validation", check_ev_charger_capacity_validation),
    ("check_ev_topography_effect", check_ev_topography_effect),
    ("check_marginal_cost_monotonicity", check_marginal_cost_monotonicity),
    ("check_fairness_target_and_tolerance", check_fairness_target_and_tolerance),
    ("check_minimize_stretches", check_minimize_stretches),
    ("check_macro_whatif_feedback_modules", check_macro_whatif_feedback_modules),
    ("check_rostering_layer", check_rostering_layer),
    ("check_feedback_persistence_cycle", check_feedback_persistence_cycle),
    ("check_integrated_joint_behavior", check_integrated_joint_behavior),
]

print(f"Testing {len(checks)} validation checks...\n")

for i, (name, check_func) in enumerate(checks, 1):
    print(f"\n{i}. Testing {name}...")
    start = time.time()
    try:
        # Use timeout via signal would be better, but we'll just run it
        ok, detail = check_func()
        elapsed = time.time() - start
        status = "PASS" if ok else "FAIL"
        print(f"   {status} in {elapsed:.2f}s: {detail}")
    except Exception as e:
        elapsed = time.time() - start
        print(f"   ERROR after {elapsed:.2f}s: {type(e).__name__}: {e}")
        if elapsed > 30:
            print(f"   WARNING: Check took too long ({elapsed:.2f}s)")

        # Print traceback for debugging
        if "ImportError" in str(type(e).__name__):
            traceback.print_exc()

print("\nDone.")