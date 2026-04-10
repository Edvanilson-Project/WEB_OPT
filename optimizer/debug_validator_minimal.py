#!/usr/bin/env python3
"""Minimal validator debug"""

import sys
import time
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

print("Testing imports...")
try:
    from src.domain.models import Trip, VehicleType, AlgorithmType, Block, Duty, VSPSolution, CSPSolution, OptimizationResult
    print("✓ Imported models")

    from src.services.hard_constraint_validator import HardConstraintValidator
    print("✓ Imported validator")

    # Test Block constructor
    print("\nTesting Block constructor...")
    block = Block(
        id=1,
        trips=[],
        vehicle_type_id=1
    )
    print(f"Block created: id={block.id}, vehicle_type_id={block.vehicle_type_id}")

    # Test Duty constructor
    print("\nTesting Duty constructor...")
    duty = Duty(
        id=1,
        tasks=[],
        segments=[]
    )
    print(f"Duty created: id={duty.id}")

    # Test VSPSolution constructor
    print("\nTesting VSPSolution constructor...")
    vsp_solution = VSPSolution(
        blocks=[block],
        unassigned_trips=[],
        cost=1000.0,
        warnings=[]
    )
    print(f"VSPSolution created: blocks={len(vsp_solution.blocks)}")

    # Test CSPSolution constructor
    print("\nTesting CSPSolution constructor...")
    csp_solution = CSPSolution(
        duties=[duty],
        uncovered_blocks=[],
        cost=800.0,
        warnings=[]
    )
    print(f"CSPSolution created: duties={len(csp_solution.duties)}")

    # Test OptimizationResult constructor
    print("\nTesting OptimizationResult constructor...")
    result = OptimizationResult(
        vsp=vsp_solution,
        csp=csp_solution,
        algorithm=AlgorithmType.HYBRID_PIPELINE,
        total_cost=1800.0,
        meta={}
    )
    print(f"OptimizationResult created: algorithm={result.algorithm}")

except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nDone.")