import asyncio
from optimizer.src.algorithms.vsp.greedy import GreedyVSP
from optimizer.src.algorithms.vsp.simulated_annealing import SimulatedAnnealingVSP
from optimizer.src.algorithms.hybrid.pipeline import HybridPipeline
from optimizer.src.domain.models import Trip
from typing import List

# Setup dummy trips
trips = []
for i in range(120):
    t = Trip(
        id=i+1,
        line_id=6,
        trip_group_id=1,
        start_time=360 + (i*10),
        end_time=400 + (i*10),
        origin_id=1,
        destination_id=2,
        duration=40,
        distance_km=10
    )
    trips.append(t)

print("VSP Testing logic...")
