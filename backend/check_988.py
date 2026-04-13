import json

with open('result_813.json', 'r') as f:
    data = json.load(f)

blocks = data.get('blocks', [])
duties = data.get('duties', [])

print("Searching for 988 (16:28) in all trips and duties...")

for b in blocks:
    for t in b.get('trips', []):
        if t.get('start_time') == 988 or t.get('end_time') == 988:
            print(f"Block {b.get('id')} / Trip {t.get('id')}: {t.get('start_time')} -> {t.get('end_time')}")

for d in duties:
    for t in d.get('trips', []):
        if t.get('start_time') == 988 or t.get('end_time') == 988:
            print(f"Duty {d.get('id')} / Trip {t.get('id')}: {t.get('start_time')} -> {t.get('end_time')}")

# Also check relief points
print("\nChecking Duty 17 and 26 again for any 988 markers...")
d17 = next((d for d in duties if d.get('duty_id') == 17 or d.get('id') == 17), None)
d26 = next((d for d in duties if d.get('duty_id') == 26 or d.get('id') == 26), None)

if d17:
    print(f"Duty 17: {json.dumps(d17, indent=2)}")
if d26:
    print(f"Duty 26: {json.dumps(d26, indent=2)}")
