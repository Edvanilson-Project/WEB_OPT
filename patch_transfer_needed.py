import re
file_path = 'optimizer/src/algorithms/csp/greedy.py'
with open(file_path, 'r') as f:
    text = f.read()

text = text.replace(
    '''        deadhead_needed = int(
            last.deadhead_times.get(
                first.origin_id,
                0 if last.destination_id == first.origin_id else 999999,
            )
        )
        return max(self.min_layover, deadhead_needed)''',
    '''        deadhead_needed = int(
            last.deadhead_times.get(
                first.origin_id,
                0 if last.destination_id == first.origin_id else 999999,
            )
        )
        return deadhead_needed'''
)

with open(file_path, 'w') as f:
    f.write(text)
