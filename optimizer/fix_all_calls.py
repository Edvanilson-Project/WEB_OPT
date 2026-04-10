#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    lines = f.readlines()

# Step 1: Fix the function signature (line 108)
for i, line in enumerate(lines):
    if line.strip() == '):' and i > 0 and 'electric: bool = False' in lines[i-1]:
        # Add time_budget_s parameter
        lines[i-1] = '    electric: bool = False,\n'
        lines.insert(i, '    time_budget_s: float = 30.0,\n')
        print(f"Fixed function signature at line {i+1}")
        break

# Step 2: Add time_budget_s to service.run call (line 116)
for i, line in enumerate(lines):
    if line.strip() == ')' and i > 0 and 'vsp_params=vsp or {},' in lines[i-1]:
        # Add time_budget_s parameter to the call
        lines[i-1] = '        vsp_params=vsp or {},\n'
        lines.insert(i, '        time_budget_s=time_budget_s,\n')
        print(f"Fixed service.run call at line {i+1}")
        break

# Step 3: Fix all _run_optimizer calls
fixed_calls = 0
i = 0
while i < len(lines):
    line = lines[i]
    # Find _run_optimizer calls (but not the function definition)
    if '_run_optimizer(' in line and 'def _run_optimizer(' not in line:
        # This is a call - need to find the complete call
        call_start = i
        # Collect lines until parentheses are balanced
        collected = [line]
        paren_count = line.count('(') - line.count(')')
        j = i + 1

        while j < len(lines) and paren_count > 0:
            collected.append(lines[j])
            paren_count += lines[j].count('(') - lines[j].count(')')
            j += 1

        # Check if call already has time_budget_s
        call_text = ''.join(collected)
        if 'time_budget_s' not in call_text:
            # Need to add time_budget_s
            # Find the last line with closing parenthesis
            last_line = collected[-1]
            # Find the position of the last ')' in this line
            last_paren_pos = last_line.rfind(')')

            if last_paren_pos != -1:
                # Look at the line before the closing paren
                # We need to insert before the closing paren
                # Check if there's a comma before the )
                insert_pos = last_paren_pos

                # Look backwards in the line for whitespace
                k = last_paren_pos - 1
                while k >= 0 and last_line[k] in ' \t':
                    k -= 1

                # Check if we need a comma
                needs_comma = True
                if k >= 0 and last_line[k] == ',':
                    needs_comma = False

                # Insert the parameter
                if needs_comma:
                    new_line = last_line[:insert_pos] + ', time_budget_s=30.0' + last_line[insert_pos:]
                else:
                    new_line = last_line[:insert_pos] + ' time_budget_s=30.0' + last_line[insert_pos:]

                collected[-1] = new_line
                fixed_calls += 1

                # Replace the lines
                for offset, new_line_content in enumerate(collected):
                    lines[call_start + offset] = new_line_content

                print(f"Fixed call starting at line {call_start+1}")

        # Skip the processed lines
        i = j - 1  # -1 because i will be incremented

    i += 1

# Write back
with open('tests/qa_professional_validation_2026.py', 'w') as f:
    f.writelines(lines)

print(f"\nFixed {fixed_calls} calls total")