#!/usr/bin/env python3
"""Testar apenas o primeiro check da validação profissional"""

import sys
import os
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

from tests.qa_professional_validation_2026 import check_daily_shift_limit

print("Running first check only...")
try:
    ok, detail = check_daily_shift_limit()
    print(f"Result: {'PASS' if ok else 'FAIL'}")
    print(f"Detail: {detail}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")