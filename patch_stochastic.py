import re
import os

file_path = "/home/edvanilson/WEB_OPT/optimizer/src/algorithms/hybrid/pipeline.py"

with open(file_path, "r") as f:
    content = f.read()

# 1. Injeta sementes dinâmicas baseadas no tempo da execução
fix_code = """def solve(
        self,
        trips: List[Trip],
        vehicle_types: List[VehicleType],
        depot_id: Optional[int] = None,
    ) -> OptimizationResult:
        import random
        import time
        # Injeta estocasticidade para explorar novos caminhos a cada run
        random.seed(int(time.time() * 1000))
        
        # Embaralha levemente a ordem das viagens se o tempo de inicio for igual, quebrando o determinismo
        if trips:
            trips.sort(key=lambda t: (t.start_time, random.random()))
"""

# Procura o inicio do método solve no HybridPipeline
content = re.sub(
    r'def solve\(\s*self,\s*trips: List\[Trip\],\s*vehicle_types: List\[VehicleType\],\s*depot_id: Optional\[int\] = None,\s*\)\s*->\s*OptimizationResult:',
    fix_code,
    content,
    flags=re.DOTALL
)

with open(file_path, "w") as f:
    f.write(content)

print("✅ Pipeline Híbrido atualizado para ser estocástico (explorar novos resultados).")
