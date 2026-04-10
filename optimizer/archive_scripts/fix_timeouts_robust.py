#!/usr/bin/env python3
import re

def fix_timeouts():
    with open('tests/qa_professional_validation_2026.py', 'r') as f:
        lines = f.readlines()

    in_function_def = False
    fixed_count = 0
    line_num = 0

    # Process each line
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip()

        # Skip the function definition itself (lines 101-118)
        if '_run_optimizer(' in line and 'def _run_optimizer(' in line:
            in_function_def = True
            i += 1
            continue

        if in_function_def:
            # Check if we're past the function definition
            if line.strip() == '' or line.startswith(' ') or line.startswith('\t'):
                # Still in function body
                pass
            else:
                in_function_def = False

        # Look for _run_optimizer calls (not the definition)
        elif '_run_optimizer(' in line and not line.strip().startswith('#'):
            # We found a call - need to find the complete call
            # Start collecting lines
            call_lines = [line]
            open_parens = line.count('(') - line.count(')')
            j = i + 1

            # Collect until parentheses are balanced
            while j < len(lines) and open_parens > 0:
                call_lines.append(lines[j])
                open_parens += lines[j].count('(') - lines[j].count(')')
                j += 1

            # Check if call already has time_budget_s
            call_text = ''.join(call_lines)
            if 'time_budget_s' not in call_text:
                # Need to add time_budget_s parameter
                # Find the last line with closing parenthesis
                last_line = call_lines[-1]
                # Find the position of the last ')' in this line
                last_paren_pos = last_line.rfind(')')

                if last_paren_pos != -1:
                    # Check what's before the ')'
                    # Look for comma or whitespace before the )
                    insert_pos = last_paren_pos

                    # Look backwards to see if we need a comma
                    k = last_paren_pos - 1
                    while k >= 0 and last_line[k] in ' \t\n':
                        k -= 1

                    needs_comma = True
                    if k >= 0 and last_line[k] == ',':
                        needs_comma = False

                    # Insert the parameter
                    if needs_comma:
                        new_line = last_line[:insert_pos] + ', time_budget_s=30.0' + last_line[insert_pos:]
                    else:
                        new_line = last_line[:insert_pos] + ' time_budget_s=30.0' + last_line[insert_pos:]

                    call_lines[-1] = new_line
                    fixed_count += 1

                    # Replace the lines in the original list
                    for offset, new_line_content in enumerate(call_lines):
                        lines[i + offset] = new_line_content

                    print(f"Fixed call starting at line {i+1}")

            # Skip the lines we've processed
            i = j - 1  # -1 because i will be incremented at the end of loop

        i += 1

    # Write back
    with open('tests/qa_professional_validation_2026.py', 'w') as f:
        f.writelines(lines)

    print(f"Fixed {fixed_count} calls")
    return fixed_count

if __name__ == '__main__':
    fix_timeouts()