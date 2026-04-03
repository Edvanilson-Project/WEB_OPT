import os
file_path = 'optimizer/src/algorithms/vsp/greedy.py'
with open(file_path, 'r') as f: text = f.read()
# Revert patch_pairs.py
text = text.replace('''                else:
                    # Inferred preferred pair for natural ida/volta
                    if last.line_id == trip.line_id:
                        if last.destination_id == trip.origin_id and last.origin_id == trip.destination_id:
                            pairing_delta -= paired_trip_bonus * 2.0
                            pairing_state = "inferred_ida_volta"
                        else:
                            pairing_delta -= paired_trip_bonus * 0.5
                            pairing_state = "same_line"''', '')
with open(file_path, 'w') as f: f.write(text)
