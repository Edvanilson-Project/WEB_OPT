import json

with open('result_813.json', 'r') as f:
    data = json.load(f)

duties = data.get('duties', [])
blocks = data.get('blocks', [])

duty17 = next((d for d in duties if d.get('duty_id') == 17 or d.get('id') == 17), None)
duty26 = next((d for d in duties if d.get('duty_id') == 26 or d.get('id') == 26), None)
block10 = next((b for b in blocks if b.get('block_id') == 10 or b.get('id') == 10), None)

print("--- BLOCK 10 ---")
if block10:
    # Print trips in block 10
    btrips = block10.get('trips', [])
    print(f"Block 10 has {len(btrips)} trips.")
    for t in btrips:
        print(f"  Trip {t.get('id')}: {t.get('start_time')} -> {t.get('end_time')} ({t.get('origin_id')}->{t.get('destination_id')})")
else:
    print("Block 10 not found. Available block IDs:", [b.get('block_id') or b.get('id') for b in blocks])

print("\n--- DUTY 17 ---")
if duty17:
    dtrips = duty17.get('trips', [])
    print(f"Duty {duty17.get('duty_id') or duty17.get('id')} has {len(dtrips)} trips.")
    for t in dtrips:
        print(f"  Trip {t.get('id')}: {t.get('start_time')} -> {t.get('end_time')} from Block {t.get('block_id')}")
    print(f"Work Minutes: {duty17.get('work_minutes')}, Shift Minutes: {duty17.get('shift_minutes')}")
else:
    print("Duty 17 not found")

print("\n--- DUTY 26 ---")
if duty26:
    dtrips = duty26.get('trips', [])
    print(f"Duty {duty26.get('duty_id') or duty26.get('id')} has {len(dtrips)} trips.")
    for t in dtrips:
        print(f"  Trip {t.get('id')}: {t.get('start_time')} -> {t.get('end_time')} from Block {t.get('block_id')}")
    print(f"Work Minutes: {duty26.get('work_minutes')}, Shift Minutes: {duty26.get('shift_minutes')}")
else:
    print("Duty 26 not found")

# Find which duties cover block 10
print("\n--- Duties covering Block 10 ---")
block10_trip_ids = set()
if block10:
    block10_trip_ids = {t.get('id') for t in block10.get('trips', [])}

for d in duties:
    d_trip_ids = {t.get('id') for t in d.get('trips', [])}
    ov = block10_trip_ids.intersection(d_trip_ids)
    if ov:
        print(f"Duty {d.get('duty_id') or d.get('id')} covers {len(ov)} trips of Block 10: {sorted(list(ov))}")
