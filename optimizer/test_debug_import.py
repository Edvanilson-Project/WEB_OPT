#!/usr/bin/env python3
"""Debug import issues"""

import sys
import os
import traceback

# Add project root
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

print(f"Project root: {project_root}")
print(f"Python path: {sys.executable}")

# Try importing modules step by step
modules_to_test = [
    "src.domain.models",
    "src.services.optimizer_service",
    "src.algorithms.csp.greedy",
    "src.core.config",
]

for module in modules_to_test:
    print(f"\n--- Testing import of {module} ---")
    try:
        imported = __import__(module, fromlist=[''])
        print(f"✓ Successfully imported {module}")
        print(f"  Location: {imported.__file__}")
    except Exception as e:
        print(f"✗ Failed to import {module}: {type(e).__name__}: {e}")
        traceback.print_exc()