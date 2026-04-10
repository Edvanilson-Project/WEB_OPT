#!/usr/bin/env python3
"""Test validation checks sequentially"""

import sys
import os
import time
import signal
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException("Function timed out")

# Import check functions
from tests.qa_professional_validation_2026 import (
    check_daily_shift_limit, check_intershift_11h, check_break_30_each_4h,
    check_meal_break_1h
)

checks = [
    ("check_daily_shift_limit", check_daily_shift_limit),
    ("check_intershift_11h", check_intershift_11h),
    ("check_break_30_each_4h", check_break_30_each_4h),
    ("check_meal_break_1h", check_meal_break_1h),
]

print(f"Testing first {len(checks)} validation checks (30s timeout each)...\n")

for i, (name, check_func) in enumerate(checks, 1):
    print(f"\n{i}. Testing {name}...")
    start = time.time()

    # Set alarm for 30 seconds
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(30)

    try:
        ok, detail = check_func()
        signal.alarm(0)  # Cancel alarm
        elapsed = time.time() - start
        status = "PASS" if ok else "FAIL"
        print(f"   {status} in {elapsed:.2f}s: {detail}")
    except TimeoutException:
        elapsed = time.time() - start
        print(f"   TIMEOUT after {elapsed:.2f}s")
    except Exception as e:
        signal.alarm(0)  # Cancel alarm
        elapsed = time.time() - start
        print(f"   ERROR after {elapsed:.2f}s: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

print("\nDone.")