#!/usr/bin/env python3
"""Test validation suite with timeout"""

import sys
import time
import signal
import traceback
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

from tests.qa_professional_validation_2026 import run_all, print_report

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException("Test suite timed out")

signal.signal(signal.SIGALRM, timeout_handler)

print("Testing validation suite with 30s timeout...")

signal.alarm(30)  # 30 second timeout
start = time.time()

try:
    results = run_all()
    signal.alarm(0)  # Cancel timeout
    elapsed = time.time() - start
    print(f"\n✓ Validation suite completed in {elapsed:.2f}s")
    print_report(results)

except TimeoutException:
    elapsed = time.time() - start
    print(f"\n✗ Validation suite TIMED OUT after {elapsed:.2f}s")
    print("  (Killed by 30s timeout)")

except Exception as e:
    elapsed = time.time() - start
    signal.alarm(0)  # Cancel timeout
    print(f"\n✗ Validation suite failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    traceback.print_exc()

signal.alarm(0)  # Ensure timeout is cleared
print("\nDone.")