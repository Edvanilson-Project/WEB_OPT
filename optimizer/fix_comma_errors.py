#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    lines = f.readlines()

# Find lines with the pattern ", time_budget_s=30.0)" on its own line
fixed_count = 0
i = 0
while i < len(lines):
    line = lines[i].rstrip()
    # Check if this line contains ", time_budget_s=30.0)" and nothing else (or just whitespace before it)
    if ', time_budget_s=30.0)' in line and line.strip() == ', time_budget_s=30.0)':
        print(f"Found error at line {i+1}: {line}")

        # Need to merge this with previous line
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

    i += 1

# Also fix lines where time_budget_s is in the wrong place but not on its own line
# Pattern: "}, time_budget_s=30.0)" - closing brace then comma then time_budget_s
for i in range(len(lines)):
    line = lines[i].rstrip()
    # Check for "}, time_budget_s=30.0)" pattern
    if '}, time_budget_s=30.0)' in line:
        print(f"Found incorrect pattern at line {i+1}: {line}")
        # This should be "}, time_budget_s=30.0)" -> should be "}, time_budget_s=30.0)" is fine
        # Actually this pattern is OK if it's part of a single-line call
        # Let's check context
        pass

# Write back
with open('tests/qa_professional_validation_2026.py', 'w') as f:
    f.writelines(lines)

print(f"\nFixed {fixed_count} comma errors")