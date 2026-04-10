#!/usr/bin/env python3
"""Test StrategyService import"""

import sys
import os
import time
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

print("Testing StrategyService import...")
start = time.time()
try:
    from src.services.strategy_service import StrategyService
    print(f"✓ Imported StrategyService in {time.time()-start:.2f}s")

    # Try to create instance
    start = time.time()
    svc = StrategyService()
    print(f"✓ Created StrategyService instance in {time.time()-start:.2f}s")
except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nTesting StrategyPersistenceService import...")
start = time.time()
try:
    from src.services.strategy_persistence_service import StrategyPersistenceService
    print(f"✓ Imported StrategyPersistenceService in {time.time()-start:.2f}s")
except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")