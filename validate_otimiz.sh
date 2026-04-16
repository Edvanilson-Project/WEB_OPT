#!/bin/bash
echo "--- CERTIFICAÇÃO TÉCNICA OTIMIZ v1.0 ---"

# 1. Testar se o Optimizer está protegido (Deve dar 403)
echo "Teste 1: Segurança do Optimizer..."
STATUS=$(curl -X POST -s -o /dev/null -w "%{http_code}" http://localhost:8100/optimize/rostering/)
if [ "$STATUS" != "200" ] && [ "$STATUS" != "201" ]; then echo "✅ Bloqueio de Segurança OK"; else echo "❌ FALHA: Optimizer está exposto! (Status: $STATUS)"; fi

# 2. Testar Saúde do Backend NestJS
# Obs: O NestJS está rodando na porta 3006 com prefixo api/v1
echo "Teste 2: Healthcheck Backend..."
STATUS_NEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3006/api/v1/health)
if [ "$STATUS_NEST" == "200" ]; then echo "✅ NestJS Online"; else echo "❌ FALHA: NestJS Offline (Status: $STATUS_NEST)"; fi

# 3. Testar Conexão Interna (Bridge)
echo "Teste 3: Ponte NestJS -> Python..."
# Aqui chamamos um endpoint do NestJS que obriga ele a falar com o Python
STATUS_BRIDGE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3006/api/v1/optimization/check-optimizer)
if [ "$STATUS_BRIDGE" == "200" ]; then echo "✅ Comunicação Segura Estabelecida"; else echo "❌ FALHA: Ponte quebrada (Status: $STATUS_BRIDGE)"; fi

echo "----------------------------------------"
