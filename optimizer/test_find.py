#!/usr/bin/env python3
with open('tests/qa_professional_validation_2026.py', 'r') as f:
    content = f.read()

# Simple check
print("Looking for _run_optimizer pattern...")
if '_run_optimizer(' in content:
    print("Found pattern")
    # Count occurrences
    count = content.count('_run_optimizer(')
    print(f"Count of '_run_optimizer(': {count}")

    # Find positions
    import re
    matches = list(re.finditer(r'_run_optimizer\(', content))
    print(f"Regex matches: {len(matches)}")

    # Show first few matches
    for i, match in enumerate(matches[:3]):
        print(f"\nMatch {i+1} at position {match.start()}")
        # Get context
        start = max(0, match.start() - 50)
        end = min(len(content), match.start() + 150)
        context = content[start:end]
        print(f"Context: ...{context}...")
else:
    print("Pattern not found")