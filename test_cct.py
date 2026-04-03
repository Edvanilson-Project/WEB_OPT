import json, sys, requests

with open('/tmp/optimizer_payload.json', 'r') as f:
    payload = json.load(f)

res = requests.post('http://127.0.0.1:8000/api/v1/optimize', json=payload)
data = res.json()

if 'blocks' in data:
    blocks = data['blocks']
    print(f"Total blocks (vehicles): {len(blocks)}")
    if 'crew_solution' in data and 'duties' in data['crew_solution']:
        print(f"Total duties: {len(data['crew_solution']['duties'])}")
else:
    print(data)
