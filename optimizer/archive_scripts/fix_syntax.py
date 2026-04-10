#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    lines = f.readlines()

# Find all lines with the incorrect pattern: ", time_budget_s=30.0)"
fixed_count = 0
for i in range(len(lines)):
    line = lines[i].rstrip()
    if line.endswith(', time_budget_s=30.0)'):
        print(f"Found incorrect pattern at line {i+1}: {line}")

        # This line should be just ")"
        # Need to add time_budget_s=30.0 to previous line
        if i > 0:
            prev_line = lines[i-1].rstrip()
            print(f"  Previous line: {prev_line}")

            # Check if previous line ends with a comma
            if prev_line.endswith(','):
                # Remove trailing comma and add time_budget_s
                new_prev_line = prev_line[:-1] + ', time_budget_s=30.0,'
                lines[i-1] = new_prev_line + '\n'
                lines[i] = ')\n'
                fixed_count += 1
                print(f"  Fixed: {new_prev_line}")
            else:
                # Previous line doesn't end with comma
                new_prev_line = prev_line + ', time_budget_s=30.0,'
                lines[i-1] = new_prev_line + '\n'
                lines[i] = ')\n'
                fixed_count += 1
                print(f"  Fixed (added comma): {new_prev_line}")

# Write back
with open('tests/qa_professional_validation_2026.py', 'w') as f:
    f.writelines(lines)

print(f"\nFixed {fixed_count} syntax errors")