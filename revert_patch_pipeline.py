import re

fname = "/home/edvanilson/WEB_OPT/optimizer/src/algorithms/hybrid/pipeline.py"
with open(fname, "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "from ..joint_opt import joint_duty_vehicle_swap" in line:
        skip = True
        
    if skip and "result.total_cost = evaluator" in line:
        skip = False
        new_lines.append("        from ..joint_opt import joint_duty_vehicle_swap\n")
        new_lines.append("        csp_final, vsp_sol = joint_duty_vehicle_swap(csp_final, vsp_sol, trips, self.cct_params, kwargs)\n")
        new_lines.append("        result = OptimizationResult(\n")
        new_lines.append("            vsp=vsp_sol,\n")
        new_lines.append("            csp=csp_final,\n")
        new_lines.append("            algorithm=self.name,  # type: ignore[arg-type]\n")
        new_lines.append("            total_elapsed_ms=self._elapsed_ms(),\n")
        new_lines.append("        )\n")
        new_lines.append(line)
        continue
    if not skip:
        new_lines.append(line)

with open(fname, "w") as f:
    f.writelines(new_lines)
