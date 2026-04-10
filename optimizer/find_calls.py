#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    content = f.read()

# Find all _run_optimizer calls using a balanced parentheses approach
pattern = r'_run_optimizer\('

i = 0
call_count = 0
while i < len(content):
    # Check for _run_optimizer(
    if content[i:i+16] == '_run_optimizer(':
        call_count += 1
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
        has_timeout = 'time_budget_s' in call_text

        print(f"\nCall {call_count} (line ~{content[:call_start].count(chr(10))+1}):")
        print(f"  Has timeout: {has_timeout}")
        if not has_timeout:
            # Show the call (first 150 chars)
            preview = call_text[:150] + "..." if len(call_text) > 150 else call_text
            print(f"  Preview: {preview}")

            # Find the line number more precisely
            lines_before = content[:call_start].split('\n')
            line_num = len(lines_before)
            print(f"  Line number: {line_num}")

            # Show surrounding context
            lines = content.split('\n')
            if line_num - 2 >= 0:
                print(f"  Context:")
                for offset in range(-2, 3):
                    idx = line_num - 1 + offset
                    if 0 <= idx < len(lines):
                        prefix = '>>>' if offset == 0 else '   '
                        print(f"    {prefix} {idx+1}: {lines[idx][:100]}")

        i = j
    else:
        i += 1

print(f"\nTotal calls found: {call_count}")