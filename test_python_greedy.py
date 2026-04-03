import json
import sys
import os

sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')
from src.algorithms.vsp.greedy import GreedyVSP
from src.domain.models import Trip, VehicleType

with open('/tmp/optimizer_payload.json', 'r') as f:
    data = json.load(f)

trips = [Trip(**t) for t in data['trips']]

# Simulate what the endpoint does to create vehicles
vehicles = [VehicleType(id=1, name="Standard Bus", is_electric=False, passenger_capacity=80)]
vsp_params = data['vsp_params']
vsp_params['preserve_preferred_pairs'] = True

vsp = GreedyVSP(vsp_params)
solution = vsp.solve(trips, vehicles)
print("Total blocks:", len(solution.blocks))
print("Params:", vsp_params)
