#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    lines = f.readlines()

# Find all _run_optimizer calls (not function definition)
call_locations = []
line_num = 0
while line_num < len(lines):
    line = lines[line_num]
    if '_run_optimizer(' in line and 'def _run_optimizer(' not in line:
        # This is a call - find the complete call
        call_start = line_num
        # Collect lines until parentheses are balanced
        collected = [line]
        paren_count = line.count('(') - line.count(')')
        j = line_num + 1

        while j < len(lines) and paren_count > 0:
            collected.append(lines[j])
            paren_count += lines[j].count('(') - lines[j].count(')')
            j += 1

        call_text = ''.join(collected)
        has_timeout = 'time_budget_s' in call_text

        # Get function name for context
        # Look for function definition before this call
        func_start = 0
        for k in range(call_start, 0, -1):
            if lines[k].strip().startswith('def '):
                func_start = k
                break

        func_line = lines[func_start].strip() if func_start > 0 else "unknown"

        call_locations.append({
            'start_line': call_start + 1,
            'end_line': j,
            'has_timeout': has_timeout,
            'call_text': call_text[:200] + '...' if len(call_text) > 200 else call_text,
            'function': func_line.split(' ')[1].split('(')[0] if 'def ' in func_line else 'unknown'
        })

        line_num = j - 1  # Skip processed lines

    line_num += 1

print(f"Found {len(call_locations)} _run_optimizer calls:")
for i, call in enumerate(call_locations, 1):
    print(f"\n{i}. Line {call['start_line']} (in {call['function']}):")
    print(f"   Has timeout: {call['has_timeout']}")
    print(f"   Preview: {call['call_text']}")