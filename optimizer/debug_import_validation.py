#!/usr/bin/env python3
"""Debug import of validation module"""

import sys
import time
import logging
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

# Enable debug logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

print("1. Starting import of validation module...")
start = time.time()

try:
    from tests.qa_professional_validation_2026 import check_daily_shift_limit
    elapsed = time.time() - start
    print(f"2. Import completed in {elapsed:.2f}s")

    print("3. Now calling check_daily_shift_limit()...")
    start = time.time()
    ok, detail = check_daily_shift_limit()
    elapsed = time.time() - start
    print(f"4. Check completed in {elapsed:.2f}s")
    print(f"   Result: {ok}, Detail: {detail}")

except Exception as e:
    elapsed = time.time() - start
    print(f"ERROR after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")