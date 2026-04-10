#!/usr/bin/env python3
import re
import sys

def fix_timeouts():
    with open('tests/qa_professional_validation_2026.py', 'r') as f:
        content = f.read()

    # Find all _run_optimizer calls using a more robust approach
    # We'll find the starting point of each call and then match balanced parentheses
    pattern = r'_run_optimizer\('

    # We'll process the content character by character
    result = []
    i = 0
    while i < len(content):
        # Check for _run_optimizer(
        if content[i:i+16] == '_run_optimizer(':
            # Found a call, capture from here
            call_start = i
            paren_count = 1
            j = i + 16  # Skip past '_run_optimizer('

            while j < len(content) and paren_count > 0:
                if content[j] == '(':
                    paren_count += 1
                elif content[j] == ')':
                    paren_count -= 1
                j += 1

            # j is now after the closing parenthesis
            call_text = content[call_start:j]

            # Check if time_budget_s is already in the call
            if 'time_budget_s' not in call_text:
                # Insert before the last closing parenthesis
                # Find the last ')' in call_text
                last_paren_pos = call_text.rfind(')')
                if last_paren_pos != -1:
                    # Check if there's trailing whitespace/comma before the )
                    insert_pos = last_paren_pos

                    # Look backwards for whitespace or comma
                    k = last_paren_pos - 1
                    while k >= 0 and call_text[k] in ' \t\n':
                        k -= 1

                    # Check if we need a comma
                    needs_comma = True
                    if k >= 0 and call_text[k] == ',':
                        needs_comma = False

                    # Build new call text
                    if needs_comma:
                        new_call_text = call_text[:insert_pos] + ', time_budget_s=30.0' + call_text[insert_pos:]
                    else:
                        new_call_text = call_text[:insert_pos] + ' time_budget_s=30.0' + call_text[insert_pos:]

                    print(f"Fixed call at position {call_start}: {call_text[:80]}...")
                    result.append(new_call_text)
                else:
                    result.append(call_text)
                    print(f"Warning: Couldn't find closing paren in call at {call_start}")
            else:
                result.append(call_text)

            i = j
        else:
            result.append(content[i])
            i += 1

    new_content = ''.join(result)

    # Write back
    with open('tests/qa_professional_validation_2026.py', 'w') as f:
        f.write(new_content)

    print("Done fixing timeouts.")

if __name__ == '__main__':
    fix_timeouts()