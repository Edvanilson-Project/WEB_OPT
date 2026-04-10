#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    content = f.read()

# Find all _run_optimizer calls
pattern = r'(_run_optimizer\s*\()(.*?)\)'
# Use a better approach with balanced parentheses
lines = content.split('\n')
output_lines = []
i = 0
fixed_count = 0

while i < len(lines):
    line = lines[i]
    # Check if line contains _run_optimizer( but not the function definition
    if '_run_optimizer(' in line and not line.strip().startswith('def _run_optimizer'):
        # Found a call, we need to find the complete call
        call_start_line = i
        call_lines = [line]
        paren_count = line.count('(') - line.count(')')
        j = i + 1

        while j < len(lines) and paren_count > 0:
            call_lines.append(lines[j])
            paren_count += lines[j].count('(') - lines[j].count(')')
            j += 1

        # j is now after the closing parenthesis
        call_text = '\n'.join(call_lines)

        # Check if call already has time_budget_s
        if 'time_budget_s' not in call_text:
            # Need to add time_budget_s
            # Find the last line with closing parenthesis
            last_line = call_lines[-1]
            # Find the position of the last ')' in this line
            last_paren_pos = last_line.rfind(')')

            if last_paren_pos != -1:
                # Check if we need a comma
                # Look backwards for whitespace or comma
                k = last_paren_pos - 1
                while k >= 0 and last_line[k] in ' \t':
                    k -= 1

                # Check if there's already a comma
                needs_comma = True
                if k >= 0 and last_line[k] == ',':
                    needs_comma = False
                elif k >= 0 and last_line[k] in '({[':
                    needs_comma = False  # First parameter

                # Insert the parameter
                if needs_comma:
                    new_line = last_line[:last_paren_pos] + ', time_budget_s=30.0' + last_line[last_paren_pos:]
                else:
                    # Check if there's a space before the parameter
                    if k >= 0 and last_line[k] != ' ':
                        new_line = last_line[:last_paren_pos] + ' time_budget_s=30.0' + last_line[last_paren_pos:]
                    else:
                        new_line = last_line[:last_paren_pos] + 'time_budget_s=30.0' + last_line[last_paren_pos:]

                call_lines[-1] = new_line
                fixed_count += 1

                # Replace the lines in output
                for offset, new_line_content in enumerate(call_lines):
                    output_lines.append(new_line_content)

                # Skip the processed lines
                i = j - 1  # -1 because i will be incremented
                print(f"Fixed call starting at line {call_start_line+1}")
            else:
                # Couldn't find closing paren, keep original
                output_lines.extend(call_lines)
                i = j - 1
        else:
            # Already has timeout, keep as is
            output_lines.extend(call_lines)
            i = j - 1
    else:
        output_lines.append(line)

    i += 1

# Write back
with open('tests/qa_professional_validation_2026.py', 'w') as f:
    f.write('\n'.join(output_lines))

print(f"\nFixed {fixed_count} calls total")