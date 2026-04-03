sed -i 's/self.legal_max_continuous_driving = int(params.get("legal_max_continuous_driving_minutes", 240))/self.legal_max_continuous_driving = 600/' optimizer/src/algorithms/csp/greedy.py
