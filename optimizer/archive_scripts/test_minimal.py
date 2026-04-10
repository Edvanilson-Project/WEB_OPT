#!/usr/bin/env python3
"""Teste mínimo de importação"""

import sys
sys.path.insert(0, '/home/edvanilson/WEB_OPT/optimizer')

print("1. Importando módulos básicos...")
try:
    from src.domain.models import Trip, VehicleType
    print("✓ Trip e VehicleType importados")
except Exception as e:
    print(f"✗ Erro: {type(e).__name__}: {e}")

print("\n2. Importando OptimizerService...")
try:
    from src.services.optimizer_service import OptimizerService
    print("✓ OptimizerService importado")
except Exception as e:
    print(f"✗ Erro: {type(e).__name__}: {e}")

print("\n3. Criando instância...")
try:
    service = OptimizerService()
    print("✓ Instância criada")
except Exception as e:
    print(f"✗ Erro: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\nTeste concluído.")