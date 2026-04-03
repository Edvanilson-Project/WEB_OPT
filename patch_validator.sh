sed -i 's/need = max(min_layover, deadhead_need)/need = deadhead_need/' optimizer/src/services/hard_constraint_validator.py
sed -i 's/if gap < min_layover:/if False:/' optimizer/src/services/hard_constraint_validator.py
