#!/bin/bash

# ==============================================================================
# OTIMIZ - Teste de Integração (Security Bridge & Elite Auth)
# ==============================================================================

BACKEND_URL="http://localhost:3006/api/v1"
OPTIMIZER_URL="http://localhost:8016"

echo "Step 1: Testando Bloqueio Direto no Optimizer (Sem Chave)..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$OPTIMIZER_URL/optimize/")
if [ "$HTTP_STATUS" == "403" ]; then
    echo "✅ SUCESSO: Optimizer bloqueou acesso direto sem chave (403)."
else
    echo "❌ FALHA: Optimizer permitiu acesso ou retornou status inesperado ($HTTP_STATUS)."
fi

echo -e "\nStep 2: Testando Login no NestJS (Esperando HTTP-Only Cookie)..."
# Nota: Como não temos um usuário real no banco limpo, este teste pode dar 401, 
# mas o objetivo é validar se a rota está exposta corretamente e se o guard permite.
LOGIN_RESPONSE=$(curl -v -s -X POST "$BACKEND_URL/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@otimiz.com", "password":"admin_password"}' 2>&1)

if echo "$LOGIN_RESPONSE" | grep -q "set-cookie: auth_token="; then
    echo "✅ SUCESSO: Backend retornou cabeçalho Set-Cookie."
else
    echo "⚠️ AVISO: Cookie não detectado. Verifique se as credenciais existem ou se o backend está rodando."
fi

echo -e "\nStep 3: Testando Rastreabilidade (Correlation ID)..."
# Simulando a chamada de um endpoint que dispara o OptimizerClientService
# Para este teste ser 100%, os serviços devem estar online.
echo "Verificando se o OptimizerClientService injeta headers..."
# Este passo é melhor validado via logs do sistema.

echo -e "\nTeste concluído. Verifique os logs do Docker/Terminal para confirmar o Correlation ID."
