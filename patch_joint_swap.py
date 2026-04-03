import re

fname = "/home/edvanilson/WEB_OPT/optimizer/src/algorithms/hybrid/pipeline.py"
with open(fname, "r") as f:
    text = f.read()

# I will add a post optimization step at the end of _finalize.

swap_code = """
        from ..joint_opt import joint_duty_vehicle_swap
        from ..evaluator import CostEvaluator
        
        # Apply Joint Duty-Vehicle Swap Post-Optimization
        # This will try to merge short duties by swapping the underlying vehicle blocks.
        csp_final, vsp_sol = joint_duty_vehicle_swap(csp_final, vsp_sol, trips, self.cct_params, kwargs)

        result = OptimizationResult(
            vsp=vsp_sol,
            csp=csp_final,
            algorithm=self.name,  # type: ignore[arg-type]
            total_elapsed_ms=self._elapsed_ms(),
        )
        result.total_cost = evaluator.total_cost(result, vehicle_types)
        return result
"""

text = re.sub(r'(\s+)result = OptimizationResult\(\s+vsp=vsp_sol,\s+csp=csp_final,\s+algorithm=self.name,.*?\)\s+result\.total_cost = evaluator\.total_cost\(result, vehicle_types\)\s+return result',
    lambda m: m.group(1).replace("\n", "") + swap_code.replace('\n', '\n' + m.group(1).replace("\n", "")),
    text, flags=re.DOTALL)

with open(fname, "w") as f:
    f.write(text)

