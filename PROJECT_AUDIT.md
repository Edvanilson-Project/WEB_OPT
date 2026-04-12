# Auditoria de Projeto e Arquitetura - WEB_OPT

Este documento fornece um mapa técnico completo do ecossistema WEB_OPT, detalhando a infraestrutura, o motor de otimização e os fluxos de dados para análise profunda via IA.

---

## 1. Mapa de Arquitetura

O WEB_OPT segue uma arquitetura de microserviços desacoplados:

### 1.1. Frontend (Next.js & TypeScript)
- **Papel**: Interface Administrativa e "Cockpit" de Otimização.
- **Destaque**: Visualização de Gantt em tempo real, editores de regras CCT e dashboards de comparação ("Plano vs Real").

### 1.2. Backend (NestJS & PostgreSQL)
- **Papel**: Orquestrador de Negócio e Persistência.
- **Responsabilidades**:
  - Gestão de Multi-tenancy (Empresas/Consórcios).
  - Persistência de Cenários, Trips e Resultados de Otimização.
  - Proxy seguro para o Microserviço Otimizador.

### 1.3. Otimizador (FastAPI & Python)
- **Papel**: Motor de Pesquisa Operacional.
- **Tecnologias**: NumPy, Pandas, Google OR-Tools (para ILP), Pydantic.
- **Comunicação**: REST API stateless, permitindo escalabilidade horizontal.

---

## 2. Diretório de Algoritmos

O sistema utiliza uma abordagem de **Pipeline Híbrido** para garantir resultados rápidos e de alta qualidade.

### 2.1. VSP (Vehicle Scheduling)
- **MCNF (Minimum Cost Network Flow)**: Gera a baseline matemática mínima de veículos necessária.
- **Greedy VSP**: Abordagem rápida para construção inicial de blocos.
- **Simulated Annealing & Tabu Search**: Metaheurísticas para exploração de vizinhança e redução de custos operacionais (ociosidade/deadheads).
- **Genetic Algorithm (GA)**: Utilizado para cenários complexos (>50 viagens) para evitar ótimos locais.

### 2.2. CSP (Crew Scheduling)
- **Greedy CSP**: Conversão de blocos de veículos em jornadas (duties) respeitando limites legais. Inclui lógica de **Run-cutting**.
- **Set Partitioning (ILP)**: Refinamento via Programação Linear Inteira para minimizar o número total de tripulantes e violações.
- **Joint Swap**: Troca dinâmica entre veículos e jornadas para otimizar conexões globais.

---

## 3. Ciclo de Vida dos Dados

1.  **Ingestão**: Viagens (Timetables) são importadas via CSV/API no Backend.
2.  **Configuração**: O usuário define um "Perfil de Otimização" (regras de descanso, custos, pesos de objetivos).
3.  **Execução**:
    - O Backend envia um payload JSON para o `/optimize` do FastAPI.
    - O Pipeline Híbrido executa: `MCNF -> SA/TS/GA -> Greedy CSP -> ILP CSP -> Joint Swap`.
4.  **Resultados**: O payload de retorno contém `vsp_solution` (blocos) e `csp_solution` (jornadas), além de métricas de performance.

---

## 4. Padrões Técnicos Críticos

### 4.1. Relief Points (Rendições Intra-viagem)
O sistema permite que um motorista entregue o veículo para outro no meio de uma viagem, desde que haja um ponto de rendição (`relief_point_id`) e um tempo de rendição válido. Isso é processado no `run-cutting` do CSP.

### 4.2. Strategy & Reconciliation
O serviço `StrategyService` permite comparar o planejado com o executado em tempo real, gerando relatórios de desvio baseados em telemetria (GPS).

### 4.3. Hard Constraint Validator
Um validador centralizado (`HardConstraintValidator`) que garante que nenhuma escala seja enviada para o banco de dados com violações críticas (ex: sobreposição de viagens no mesmo veículo).

---

## 5. Índice de Arquivos "Coração" do Projeto

Se você for auditar o código, foque nestes arquivos:
- `backend/src/modules/optimization/optimization.service.ts`: Orquestração da chamada e salvamento.
- `optimizer/main.py`: Entrypoint da API FastAPI.
- `optimizer/src/algorithms/hybrid/pipeline.py`: Fluxo principal da otimização.
- `optimizer/src/algorithms/evaluator.py`: Onde o custo é realmente calculado.
- `optimizer/src/services/hard_constraint_validator.py`: A "lei" do sistema.

---

## 6. Prompt de Arquiteto Master (System Audit)

**Copie este prompt para realizar uma análise de arquitetura sistêmica:**

```markdown
# PROMPT DE AUDITORIA DE ARQUITETURA - WEB_OPT

Você é um Arquiteto de Sistemas de Alta Performance e Especialista em Engenharia de Software.
Sua tarefa é analisar o ecossistema WEB_OPT para identificar gargalos de escalabilidade e falhas de design.

## CONTEXTO DO SISTEMA
- Stack: NestJS (Node) <-> FastAPI (Python) <-> Next.js (React).
- Problema: Otimização Combinatória de Larga Escala (VSP/CSP).
- Comunicação: Payload JSON pesado entre microserviços.

## TAREFAS DE AUDITORIA
1. **Escalabilidade de Microserviços**: Analise o custo computacional de converter grandes payloads JSON (>20.000 trips) entre os tipos de dados do TypeScript e Pydantic (Python). Existe risco de gargalo de CPU ou Latência?
2. **Consistência de Estado**: Como o sistema garante que as regras de CCT definidas no Frontend sejam replicadas sem drift semântico no motor de otimização em Python?
3. **Resiliência do Pipeline**: O Pipeline Híbrido realloca tempo entre fases (SA -> TS -> GA). Avalie se essa abordagem de time-budgeting é robusta para evitar timeouts em requisições HTTP REST.
4. **Acoplamento**: Avalie o nível de acoplamento entre o `HardConstraintValidator` e os algoritmos. O design permite adicionar uma nova regra de negócio (ex: fadiga do motorista) sem refatorar o motor inteiro?

## REQUISITO DE SAÍDA
Gere um relatório de auditoria arquitetural propondo 3 melhorias de infraestrutura ou design patterns para tornar o WEB_OPT a solução mais rápida e estável do mercado, superando Goal e OptBus em resiliência sistêmica.
```

---
*Gerado para prover visão holística e estratégica do sistema WEB_OPT.*
