import json, urllib.request

req = urllib.request.Request(
    'http://127.0.0.1:3001/api/v1/trips?limit=10000',
    headers={'Content-Type': 'application/json'}
)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        trips = data.get('data', [])
        
        # Sort trips by start time
        trips.sort(key=lambda x: x['startTimeMinutes'])
        
        max_overlap = 0
        current_overlap = 0
        events = []
        for t in trips:
            if t['lineId'] in [6,7,8,9,10,11,12]:
                events.append((t['startTimeMinutes'], 1))
                events.append((t['endTimeMinutes'], -1))
        
        events.sort()
        for time, diff in events:
            current_overlap += diff
            max_overlap = max(max_overlap, current_overlap)
        
        print(f"Total trips for these lines: {len(events)//2}")
        print(f"Max concurrent trips (Theoretical Min Vehicles): {max_overlap}")
except Exception as e:
    print(e)
