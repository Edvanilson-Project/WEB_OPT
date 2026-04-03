with open("/home/edvanilson/WEB_OPT/optimizer/src/services/optimizer_service.py", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
i = 0
while i < len(lines):
    line = lines[i]
    if "def _inject_trip_group_constraints(" in line:
        pass
    if "grouped: Dict[tuple[int, int], List[int]] = {}" in line:
        new_lines.append("""        min_layover = int(vsp_params.get("min_layover_minutes", 8))
        grouped: Dict[tuple[int, int], List[Trip]] = {}
        for trip in trips:
            if trip.trip_group_id is None:
                continue
            grouped.setdefault((trip.line_id, trip.trip_group_id), []).append(trip)
            
        mandatory = []
        for trips_in_group in grouped.values():
            if len(trips_in_group) == 2:
                ordered = sorted(trips_in_group, key=lambda t: t.start_time)
                if ordered[1].start_time - ordered[0].end_time >= min_layover:
                    mandatory.append([t.id for t in ordered])
                    
        if mandatory:
            cct_params["mandatory_trip_groups_same_duty"] = mandatory
""")
        # skip lines until def _parse_rule
        i += 1
        while "def _parse_rule(" not in lines[i]:
            i += 1
        continue
    new_lines.append(line)
    i += 1

with open("/home/edvanilson/WEB_OPT/optimizer/src/services/optimizer_service.py", "w") as f:
    f.writelines(new_lines)
