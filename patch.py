with open("/home/edvanilson/WEB_OPT/optimizer/src/algorithms/csp/greedy.py", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "for task in sorted(tasks, key=lambda item:" in line:
        new_lines.append(line)
        new_lines.append("""            assigned = False
            def _duty_sort_key(d: Duty) -> Tuple[bool, int]:
                s_id = d.tasks[-1].meta.get("source_block_id") if d.tasks else None
                return (s_id != task.meta.get("source_block_id"), d.work_time)
            
            for duty in sorted(duties, key=_duty_sort_key):
                ok, _, data = self._can_extend(duty, task)
                if ok:
                    self._apply_block(duty, task, data)
                    assigned = True
                    break
""")
        skip = True
    elif skip and "if assigned:" in line:
        skip = False
        new_lines.append(line)
    elif not skip:
        new_lines.append(line)

with open("/home/edvanilson/WEB_OPT/optimizer/src/algorithms/csp/greedy.py", "w") as f:
    f.writelines(new_lines)

