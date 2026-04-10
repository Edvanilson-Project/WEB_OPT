#!/usr/bin/env python3
import re

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    content = f.read()

# Pattern to find _run_optimizer calls
pattern = r'_run_optimizer\(([^)]+)\)'

# Find all matches
matches = list(re.finditer(pattern, content, re.DOTALL))
print(f"Found {len(matches)} calls to _run_optimizer")

# Replace each match
new_content = content
offset = 0
for match in matches:
    # Get the matched text and position
    match_text = match.group(0)
    match_start = match.start() + offset
    match_end = match.end() + offset

    # Check if already has time_budget_s
    if 'time_budget_s' in match_text:
        print(f"  Already has time_budget_s: {match_text[:80]}...")
        continue

    # Find where the closing parenthesis is
    # We need to handle nested parentheses
    open_parens = 0
    for i, char in enumerate(match_text):
        if char == '(':
            open_parens += 1
        elif char == ')':
            open_parens -= 1
            if open_parens == 0:
                # Insert before the closing parenthesis
                insert_pos = match_start + i
                new_match_text = match_text[:i] + ', time_budget_s=30.0' + match_text[i:]
                new_content = new_content[:match_start] + new_match_text + new_content[match_end:]
                offset += len(', time_budget_s=30.0')
                print(f"  Fixed call: {match_text[:80]}...")
                break

# Write back
with open('tests/qa_professional_validation_2026.py', 'w') as f:
    f.write(new_content)

print("Done fixing timeouts.")