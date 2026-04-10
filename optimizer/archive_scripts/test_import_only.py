#!/usr/bin/env python3
"""Test ONLY importing the validation module without running checks"""

import sys
import time
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

print("Testing import of validation module...")
start = time.time()

try:
    import tests.qa_professional_validation_2026 as validation_module
    elapsed = time.time() - start
    print(f"✓ Import completed in {elapsed:.2f}s")
    print(f"  Module: {validation_module.__name__}")
    print(f"  Functions: {[f for f in dir(validation_module) if not f.startswith('_')]}")

except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Import failed after {elapsed:.2f}s: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")