#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    content = f.read()

# Find all _run_optimizer calls using a balanced parentheses approach
pattern = r'_run_optimizer\('

i = 0
call_count = 0
missing_timeout = 0
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

        if not has_timeout:
            missing_timeout += 1
            print(f"\nMissing timeout in call {call_count}:")
            # Show the call
            lines_before = content[:call_start].split('\n')
            line_num = len(lines_before)
            print(f"  Line: {line_num}")
            print(f"  Call: {call_text[:200]}...")

        i = j
    else:
        i += 1

print(f"\nSummary:")
print(f"Total calls: {call_count}")
print(f"Calls with timeout: {call_count - missing_timeout}")
print(f"Calls missing timeout: {missing_timeout}")

if missing_timeout == 0:
    print("All calls have time_budget_s parameter!")
else:
    print(f"Still missing {missing_timeout} time_budget_s parameters")