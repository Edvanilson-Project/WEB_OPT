# Auditoria de Saúde Técnica e Qualidade - WEB_OPT

Este documento completa a "Trilogia de Auditoria" do sistema WEB_OPT, focando em identificar onde os erros se escondem, quais as dívidas técnicas e como realizar um debug agressivo utilizando IA.

---

## 1. Inventário de Stack e Dependências Críticas

Para uma IA analisar o código, ela deve conhecer as ferramentas em uso:

### 1.1. Backend (NestJS v11)
- **TypeORM v0.3**: Gestão de banco de dados SQL. Cuidado com queries complexas sem `@Index`.
- **Bull v4 (Redis)**: Processamento de filas. Se as jornadas demorarem, o timeout da fila deve ser verificado.
- **Class-Validator**: Todas as entradas da API são validadas aqui. Erros 400 geralmente nascem de DTOs mal configurados.

### 1.2. Otimizador (FastAPI & Python 3.12)
- **PyDantic v2**: Revalidação de dados na entrada do motor.
- **PuLP v2.9**: Solver para o CSP (ILP). Se não encontrar solução, verifique se o solver `CBC` ou `HiGHS` está instalado no ambiente.
- **NumPy & SciPy**: Operações de matriz para vizinhanças.

---

## 2. Mapa de Telemetria e Debug

Onde o sistema "chora" quando falha:

- **Logs do Otimizador**: Utiliza `structlog`. Procure por chaves como `strategy_auto_reconcile_failed` ou `vsp_mcnf_ms`.
- **Logs do Backend**: Utiliza o `Logger` padrão do NestJS embutido no `bootstrap`.
- **Frontend Errors**: Verificado erro crítico de tipagem no arquivo `src/app/(DashboardLayout)/otimiz/optimization/page.tsx` (Erro TS2345). A IA deve focar em resolver inconsistências entre `TripDetail` e o retorno do backend.

---

## 3. Dívidas Técnicas e Gargalos (Hotspots)

### 3.1. Performance
- **ILP Set Partitioning**: O problema de Set Cover é NP-Hard. Para cenários com >1000 viagens, o ILP pode travar se o `time_budget_s` não for respeitado rigorosamente.
- **Neighbor Search**: No Simulated Annealing (`sa.py`), a busca por vizinhos pode ser O(n²). Verificar se o `tabu_search.py` está limpando a lista tabu corretamente para evitar consumo de memória.

### 3.2. Sincronia de Dados
- **Drift de Regras**: As constantes de CCT (ex: `cct_max_work_minutes`) existem no Frontend, Backend e Optimizer. Um erro comum é alterar no Frontend e o valor não ser propagado corretamente até o `GreedyCSP.py`.

---

## 4. Prompt de "Caçador de Bugs" (Bug-Hunter Master)

**Copie e cole este prompt para uma análise profunda de erros e melhorias:**

```markdown
# PROMPT DE DEBUGER E QUALIDADE - SISTEMA WEB_OPT

Você é um Engenheiro de QA Full-Stack e Especialista em SRE. 
Sua missão é encontrar bugs lógicos, vazamentos de memória e inconsistências de design no WEB_OPT.

## MATERIAL DE ANÁLISE
- Backend: NestJS (TypeScript)
- Optimizer: FastAPI (Python)
- Core: Algoritmos de Pesquisa Operacional (VSP/CSP)

## TAREFAS DE "BUSCA E DESTRUIÇÃO"
1. **Inconsistência de Tipagem**: O arquivo `frontend/.../optimization/page.tsx` apresenta o erro `TS2345: Argument of type TripDetail is not assignable to type number`. Analise como os dados retornados pelo `OptimizationService` (NestJS) estão sendo mapeados e corrija o contrato de interface.
2. **Vazamento de Lógica no CSP**: No `GreedyCSP.py`, verifique a função `_break_resets`. Existe a possibilidade de uma jornada ser considerada válida mesmo sem o descanso mínimo se o `connection_tolerance` for usado de forma abusiva?
3. **Segurança de Entrada**: Avalie o `optimization.controller.ts`. As entradas de `lineIds` estão sendo sanitizadas para evitar ataques de DoS (Denial of Service) por envio de milhares de IDs inexistentes?
4. **Otimização de Memória no Python**: No motor de otimização, o uso de `copy.deepcopy(trip)` durante o `run-cutting` é frequente. Proponha uma alternativa usando imutabilidade ou slots para reduzir o footprint de memória em execuções de larga escala.

## REQUISITO DE SAÍDA
Liste os 5 erros mais críticos encontrados (ordenados por severidade) e forneça o patch de código (diff) para resolver cada um, garantindo que o sistema seja mais robusto que Goal e OptBus.
```

---
*Este documento encerra o pacote de auditoria para análise automatizada via IA.*
