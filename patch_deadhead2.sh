sed -i 's/return max(min_layover, deadhead_needed)/return deadhead_needed/' optimizer/src/algorithms/vsp/greedy.py
