#!/usr/bin/env python3
"""Debug import of validation module step by step"""

import sys
import time
import traceback
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

print("Testing imports step by step...")

# 1. Basic imports
print("\n1. Importing dataclasses and typing...")
start = time.time()
from dataclasses import dataclass
from typing import Callable, List, Sequence
print(f"   OK - {time.time()-start:.2f}s")

# 2. Try importing domain models first
print("\n2. Importing domain models...")
start = time.time()
try:
    from src.domain.models import AlgorithmType, Trip, VehicleType
    print(f"   OK - {time.time()-start:.2f}s")
except Exception as e:
    print(f"   FAILED - {type(e).__name__}: {e}")

# 3. Try importing services
print("\n3. Importing OptimizerService...")
start = time.time()
try:
    from src.services.optimizer_service import OptimizerService
    print(f"   OK - {time.time()-start:.2f}s")
except Exception as e:
    print(f"   FAILED - {type(e).__name__}: {e}")

# 4. Try importing algorithms
print("\n4. Importing GreedyVSP...")
start = time.time()
try:
    from src.algorithms.vsp.greedy import GreedyVSP
    print(f"   OK - {time.time()-start:.2f}s")
except Exception as e:
    print(f"   FAILED - {type(e).__name__}: {e}")

print("\n5. Importing GreedyCSP...")
start = time.time()
try:
    from src.algorithms.csp.greedy import GreedyCSP
    print(f"   OK - {time.time()-start:.2f}s")
except Exception as e:
    print(f"   FAILED - {type(e).__name__}: {e}")

print("\n6. Importing exceptions...")
start = time.time()
try:
    from src.core.exceptions import HardConstraintViolationError
    print(f"   OK - {time.time()-start:.2f}s")
except Exception as e:
    print(f"   FAILED - {type(e).__name__}: {e}")

# 7. Try importing strategy services
print("\n7. Importing StrategyService...")
start = time.time()
try:
    from src.services.strategy_service import StrategyService
    print(f"   OK - {time.time()-start:.2f}s")
except Exception as e:
    print(f"   FAILED - {type(e).__name__}: {e}")

print("\n8. Importing StrategyPersistenceService...")
start = time.time()
try:
    from src.services.strategy_persistence_service import StrategyPersistenceService
    print(f"   OK - {time.time()-start:.2f}s")
except Exception as e:
    print(f"   FAILED - {type(e).__name__}: {e}")

print("\nDone.")