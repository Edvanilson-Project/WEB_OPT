#!/usr/bin/env python3
import re
import sys

with open('tests/qa_professional_validation_2026.py', 'r') as f:
    lines = f.readlines()

in_multiline = False
multiline_start = -1
current_call = ""
for i, line in enumerate(lines, 1):
    stripped = line.strip()

    # Handle multiline calls
    if '_run_optimizer(' in line and not in_multiline:
        in_multiline = True
        multiline_start = i
        current_call = line
    elif in_multiline:
        current_call += line
        if line.strip().endswith(')'):
            in_multiline = False
            # Check if time_budget_s is in call
            if 'time_budget_s' not in current_call:
                print(f"Line {multiline_start}: Missing time_budget_s parameter")
                print(f"  Call: {current_call[:100]}...")
            multiline_start = -1
            current_call = ""