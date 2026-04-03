with open("/home/edvanilson/WEB_OPT/optimizer/src/algorithms/vsp/greedy.py", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "if trip.start_time - active.trips[-1].end_time > 240:" in line:
        new_lines.append(line.replace("trip.start_time - active.trips[-1].end_time > 240", "trip.start_time - active.trips[0].start_time > max_vehicle_shift"))
    else:
        new_lines.append(line)

with open("/home/edvanilson/WEB_OPT/optimizer/src/algorithms/vsp/greedy.py", "w") as f:
    f.writelines(new_lines)

