import re

fname = "/home/edvanilson/WEB_OPT/optimizer/src/algorithms/hybrid/pipeline.py"
with open(fname, "r") as f:
    text = f.read()

swap_code = """
        from ..joint_opt import joint_duty_vehicle_swap
        csp_final, vsp_sol = joint_duty_vehicle_swap(csp_final, vsp_sol, trips, self.cct_params, kwargs)

        result = OptimizationResult(
            vsp=vsp_sol,
            csp=csp_final,
            algorithm=self.name,  # type: ignore[arg-type]
            total_elapsed_ms=self._elapsed_ms(),
        )
"""

text = re.sub(r'(\s+)result = OptimizationResult\(\s+vsp=vsp_sol,\s+csp=csp_final,\s+algorithm=self.name,.*?\)',
    lambda m: m.group(1).replace("\n", "") + swap_code.replace('\n', '\n' + m.group(1).replace("\n", "")),
    text, flags=re.DOTALL)

with open(fname, "w") as f:
    f.write(text)

