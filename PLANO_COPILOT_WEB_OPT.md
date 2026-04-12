# 🚀 Auditoria Completa e Plano de Ação - WEB_OPT

O sistema OTIMIZ (WEB_OPT) encontra-se rodando corretamente no ambiente local (Frontend na porta 3001, Backend na 3006, Optimizer na 8000). A seguir, compilei um mapa detalhado da arquitetura, potenciais bugs, melhorias, e um plano de auditoria focando na utilização estratégica dos modelos de IA do GitHub Copilot.

---

## 1. Mapeamento Arquitetural e Estado Atual do Sistema

### 🌀 Optimizer (Python/FastAPI) - Porta 8000
- **Responsabilidade:** Processamento intensivo de Machine Learning/Pesquisa Operacional (VSP, CCT/CSP, algoritmos Greedy e Híbridos).
- **Estado Atual e Riscos:** Recebeu fortes atualizações nos _Models Pydantic_. É suscetível a erros 500 (Internal Server Error) caso receba JSONs mal formatados do backend (ex: listas de inteiros para trips no lugar de objetos). 
- **Melhoria Foco:** Cobertura de testes nos schemas de entrada/saída (`src/api/schemas.py`).

### ⚙️ Backend (Node/NestJS) - Porta 3006
- **Responsabilidade:** Gateway e mediador CRUD, autenticação, salvamento em BD (TypeORM/Postgres) e formatação de payload (Enrich/Adapter) para o Optimizer.
- **Estado Atual e Riscos:** Foi adicionada injeção detalhada de viagens recentes (`_enrichBlockTrips`). 
- **Melhoria Foco:** Consistência dos DTOs. A delegação dos _overrides_ de configurações CCT para execução inline versus microserviço e como lida com "Timeouts" caso o processo demore mais de 30 segundos.

### 🖥️ Frontend (Next.js/React + MUI) - Porta 3001
- **Responsabilidade:** Interface principal focada no "Cockpit de Otimização" (Painel do despachante).
- **Estado Atual e Riscos:** Reduzido de 3200 linhas para menos de 800. Há riscos de crash via TypeErrors ocultos ao processar execuções de histórico ("Legacy Runs") onde objetos Trip vêm nulos.
- **Melhoria Foco:** Tolerância no render (Null-safety na tabela) e remoção contínua de "Dead Code" (imports não utilizados).

---

## 2. Recomendações Estratégicas de Modelos IA (GitHub Copilot)

O GitHub Copilot agora possui um seleteor de modelos. A recomendação tática pelo perfil do WEB_OPT é:

*   🤖 **Anthropic Claude 3.5 Sonnet:** 
    *   **Uso:** Modificações densas na arquitetura (Backend + Optimizer Python).
    *   **Por quê?** Possui imensa capacidade de contexto. É imbatível atualmente para leitura lógica em arquivos grandes e intrincados de algoritmos Python (os cálculos da CCT/VSP) onde o contexto não pode ser perdido no meio do código.
*   ⚡ **OpenAI GPT-4o:** 
    *   **Uso:** Ajustes e refinamento visual (React, JSX, MUI, refatoração de Telas rápidas).
    *   **Por quê?** Extremamente dinâmico e exato sintaticamente. Corrige botões, layouts responsivos ou conserta erros de build do Typescript/React com eficácia e rapidez altíssimas.
*   📊 **OpenAI o1 / o1-preview:** (Alternativo de Reasoning)
    *   **Uso:** Apenas se for refazer lógicas matemáticas de otimização ("como otimizo a fórmula de Custo Híbrido?").

---

## 3. Prompts Estruturados para Diagnósticos e Testes (Workflow Agrupado)

Você pode colar essas requisições formatadas diretamente no seu painel ou terminal de Chat usando os comandos `@workspace`:

### 🎯 Grupo 1: Otimizador Python (Schema & Algoritmos)
_Sugerido utilizar: Claude 3.5 Sonnet_

**Prompt - Auditoria e Correção Pydantic:**
> "@workspace No diretório `/optimizer`, audite as validações Pydantic em `schemas.py` contra o payload construído em `backend/.../optimization.service.ts`. Quando o backend envia execuções ou `Fallback Inline`, nós estamos recebendo erros 500 silenciosos de validação (ex: trips como array numérico ao invés de dict). Por favor, escreva um teste pytest que crie essa falha, corrija a serialização nos schemas do FastAPI e valide a correção. "

**Prompt - Teste das Regras CCT/VSP:**
> "@workspace Com base nos arquivos Python de algoritmo do `/optimizer/src`, verifique o espalhamento de lógica onde `connection_tolerance_minutes` e `allowMultiLineBlock` são calculados. Encontre possíveis quebras operacionais de grafos caso veículos mudem de pátio na mesma viagem. Crie e rode casos de teste isolados para estas rotinas de `Greedy` e `Hybrid`."

### 🎯 Grupo 2: Backend Node.js / NestJS (Segurança & Payload)
_Sugerido utilizar: Claude 3.5 Sonnet_

**Prompt - Sanitização e Garantia de Retorno (DB vs Microserviço):**
> "@workspace Analise a classe `OptimizationService` em `optimization.service.ts` e acompanhe como ela delega ao `optimizerUrl`. Se houver crash ou timeout, como o banco de dados via repositório TypeORM mapeia o status do `resultSummary`? Implemente em NestJS e TypeScript um Guard/Filtro global dentro desta classe para evitar que payloads contendo propriedades indefinidas causem corrupção do histórico das execuções Salvas."

**Prompt - Auditoria do DTOs de Execução:**
> "@workspace Analise o arquivo de DTO `run-optimization.dto.ts`. O campo `timeBudgetSeconds` e os modos `operationMode` precisam estar altamente sincronizados com os dados permitidos do Swagger. Crie testes unitários NestJS que instanciem validações falhas propositalmente (ex: enviar orçamento negativo) provando que o Class-Validator repele antes que o backend gaste memória comunicando o Optimizer Python."

### 🎯 Grupo 3: Interface do Usuário React/Next.js
_Sugerido utilizar: GPT-4o_

**Prompt - Resiliência da Visualização de Resultados (Bugs Ocultos UI):**
> "@workspace Por favor analise o arquivo de UI do cockpit `/frontend/src/app/(DashboardLayout)/otimiz/optimization/page.tsx` com ênfase na aba de Histórico de Execuções e Viagens detalhadas (`TabTrips` / `TripDetailTable`). Há execuções antigas do banco de dados (legacy runs) que não possuíam o formato robusto de dados (`start_time` / `end_time`). Garanta e crie refatorações estritas que não permitam array `.map` dar trigger de exceção `is undefined`, blindando o React contra crashes usando verificações Fallback (ex `??`)."

**Prompt - Testes da Tela:**
> "@workspace Com base na Interface atual de `OptimizationInner` no `page.tsx`, crie o esqueleto de teste vitest / React Testing Library focado apenas no agrupamento de `state` do Modo de Operação (Urbano vs Fretamento) e Algoritmos. Mande os casos e componentes de botões serem testados validando a ação de `simulate.click`."

---
*Arquivo gerado nativamente. Todos os status atuais estão validados e disponíveis online localmente!*