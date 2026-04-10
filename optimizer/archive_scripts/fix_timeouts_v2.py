#!/usr/bin/env python3
import sys

def fix_timeouts(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip()

        # Check if this line starts a _run_optimizer call
        if '_run_optimizer(' in line:
            # Start collecting lines for this call
            call_lines = [line]
            open_parens = line.count('(') - line.count(')')
            j = i + 1

            while j < len(lines) and open_parens > 0:
                call_lines.append(lines[j])
                open_parens += lines[j].count('(') - lines[j].count(')')
                j += 1

            call_text = ''.join(call_lines)

            # Check if already has time_budget_s
            if 'time_budget_s' not in call_text:
                # Find the last closing parenthesis in the last line
                last_line = call_lines[-1]
                last_paren_pos = last_line.rfind(')')
                if last_paren_pos != -1:
                    # Insert before the closing parenthesis
                    call_lines[-1] = (
                        last_line[:last_paren_pos] +
                        ', time_budget_s=30.0' +
                        last_line[last_paren_pos:]
                    )
                    print(f"Fixed call at line {i+1}")

            new_lines.extend(call_lines)
            i = j - 1  # Skip the lines we've already processed
        else:
            new_lines.append(line)

        i += 1

    # Write back
    with open(file_path, 'w') as f:
        f.writelines(new_lines)

    print(f"Processed {len(lines)} lines, wrote {len(new_lines)} lines")

if __name__ == '__main__':
    fix_timeouts('tests/qa_professional_validation_2026.py')