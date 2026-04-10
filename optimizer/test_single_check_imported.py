#!/usr/bin/env python3
"""Test running single check from imported validation module"""

import sys
import time
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

print("Testing check_daily_shift_limit from imported module...")
start = time.time()

try:
    from tests.qa_professional_validation_2026 import check_daily_shift_limit
    elapsed_import = time.time() - start
    print(f"✓ Import completed in {elapsed_import:.2f}s")

    print("Now calling check_daily_shift_limit()...")
    check_start = time.time()
    ok, detail = check_daily_shift_limit()
    elapsed_check = time.time() - check_start
    print(f"✓ Check completed in {elapsed_check:.2f}s")
    print(f"  Result: {ok}, Detail: {detail}")

except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")