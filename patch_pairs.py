import os
file_path = 'optimizer/src/algorithms/vsp/greedy.py'
with open(file_path, 'r') as f:
    text = f.read()

replacement = '''                pairing_delta = 0.0
                pairing_state = "neutral"
                expected_pair = preferred_pairs.get(last.id)
                if expected_pair == trip.id:
                    pairing_delta -= paired_trip_bonus
                    pairing_state = "preferred_pair"
                elif expected_pair is not None and expected_pair != trip.id:
                    pairing_delta += pair_break_penalty
                    pairing_state = "pair_break"
                else:
                    # Inferred preferred pair for natural ida/volta
                    if last.line_id == trip.line_id:
                        if last.destination_id == trip.origin_id and last.origin_id == trip.destination_id:
                            pairing_delta -= paired_trip_bonus * 2.0
                            pairing_state = "inferred_ida_volta"
                        else:
                            pairing_delta -= paired_trip_bonus * 0.5
                            pairing_state = "same_line"'''

text = text.replace('''                pairing_delta = 0.0
                pairing_state = "neutral"
                expected_pair = preferred_pairs.get(last.id)
                if expected_pair == trip.id:
                    pairing_delta -= paired_trip_bonus
                    pairing_state = "preferred_pair"
                elif expected_pair is not None and expected_pair != trip.id:
                    pairing_delta += pair_break_penalty
                    pairing_state = "pair_break"''', replacement)

with open(file_path, 'w') as f:
    f.write(text)
