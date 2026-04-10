#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

print("Testing imports...")
try:
    from src.domain.models import Trip, VehicleType, AlgorithmType
    print("✓ Imported domain models")

    from src.services.optimizer_service import OptimizerService
    print("✓ Imported OptimizerService")

    service = OptimizerService()
    print("✓ Created OptimizerService instance")

except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")