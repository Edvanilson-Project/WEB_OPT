# Plano 30/60/90 dias — Evolução Profissional (Padrão HASTUS/Optibus)

## Objetivo
Transformar o OTIMIZ de um otimizador operacional avançado em uma plataforma corporativa de governança de transporte, com:
- camada estratégica Macro + operacional Micro,
- ciclo fechado planejado vs realizado (GTFS-RT/AVL),
- IA para regras de negócio em linguagem natural,
- otimização EV avançada (SoC + topografia + degradação),
- KPIs executivos e operacionais auditáveis.

---

## Situação atual (baseline confirmado)

### Já implementado
- VSP + CSP com heurísticas, set covering e pricing.
- Hard constraints com auditoria de entrada/saída.
- Fairness operacional (meta 6h–8h, tolerância ±30min).
- Pareamento ida/volta e regra de troca em terminal/depot.
- Limite de frota (`maxVehicles`) ponta a ponta.
- Endpoints estratégicos iniciais:
  - `POST /strategy/macro-estimate`
  - `POST /strategy/what-if`
  - `POST /strategy/feedback/plan-vs-real`
- KPIs operacionais em `meta.operational_kpis`.

### Gaps para padrão corporativo
- Macro ainda é estimador LP simplificado (não acoplado à negociação sindical formal).
- Sem pipeline persistente de ingestão GTFS-RT/AVL (batch/event-driven).
- Sem rostering de longo período robusto (semanal/mensal com senioridade completa).
- NLP ainda híbrido regex/regras (sem motor semântico com validação formal).
- EV sem modelo explícito de degradação por histórico de carga e temperatura.

---

## Fase 1 — 30 dias (Fundação de Governança e Dados)

## 1) Macro/Micro operacionalizável
**Entregável**
- Consolidar módulo Macro com cenários comparáveis (A/B/C), incluindo baseline financeiro e legal.
- Persistir cenários e resultados em banco (`scenario_runs`, `scenario_metrics`).

**Critérios de aceite**
- Geração de 3+ cenários por solicitação em < 10s para até 5.000 viagens.
- Diferença de custo e impacto legal comparáveis em relatório único.

## 2) Pipeline GTFS-RT/AVL (MVP)
**Entregável**
- Ingestão periódica (scheduler) de feed posição/viagem.
- Normalização para eventos de operação (`vehicle_position`, `trip_update`, `alert`).
- Persistência de série temporal mínima para 14 dias.

**Critérios de aceite**
- Atualização contínua sem queda por 24h.
- KPI de completude de feed > 98%.

## 3) Feedback planejado vs realizado com ação
**Entregável**
- Rotina diária de reconciliação automática.
- Regras de detecção: ghost bus, atraso p95 alto, quebra de terminal sync.
- Geração de recomendações acionáveis por linha/faixa horária.

**Critérios de aceite**
- Painel com top 10 desvios por severidade.
- Sugestão automática de ajuste de `deadhead` e tempo de viagem por corredor.

## 4) Segurança de execução e auditoria
**Entregável**
- Versão dos parâmetros por run (`cct_params`, `vsp_params`, `goal_weights`) com hash.
- Registro de explainability (motivo de falhas e restrições ativas).

**Critérios de aceite**
- Reprodutibilidade de run por ID com parâmetros congelados.

---

## Fase 2 — 60 dias (Qualidade Algorítmica e Regras Avançadas)

## 1) Rostering semanal/mensal
**Entregável**
- Engine de rostering com restrições de folga semanal, interjornada e senioridade.
- Penalização explícita de distribuição desigual de jornadas longas.

**Critérios de aceite**
- Redução de variação de carga semanal (desvio padrão) em >= 20% vs baseline.

## 2) Goal Programming formal (d+/d-)
**Entregável**
- Função objetivo multi-critério com desvios positivos e negativos explícitos:
  - horas extras,
  - subcarga,
  - spread,
  - trocas excessivas (stretches),
  - equidade.

**Critérios de aceite**
- KPIs reportando `d_plus_total` e `d_minus_total` por cenário.
- Curva de trade-off custo vs equidade disponível no painel.

## 3) IA de Preferências v1 (híbrida segura)
**Entregável**
- Tradutor semântico de regras em linguagem natural para DSL interna validada.
- Validador de consistência legal antes da execução.

**Critérios de aceite**
- 80%+ de regras textuais convertidas sem intervenção manual.
- Zero execução com regra inválida sem bloqueio prévio.

## 4) EV avançado v1
**Entregável**
- Consumo sensível a topografia (já existente) calibrado por histórico real.
- Janela tarifária energia (pico/fora pico) integrada ao custo marginal.

**Critérios de aceite**
- Redução de custo energético simulado em >= 8% em cenários EV.

---

## Fase 3 — 90 dias (Escala Corporativa e Excelência Operacional)

## 1) Degradação de bateria e política de carga
**Entregável**
- Modelo de degradação por ciclo/DoD (depth of discharge), carga rápida/lenta e temperatura.
- Otimização de política de recarga para preservar SOH.

**Critérios de aceite**
- Simulação de vida útil com projeção trimestral por ativo.

## 2) Replanejamento quase em tempo real
**Entregável**
- Trigger de re-otimização parcial por evento crítico (quebra mecânica, atraso extremo, indisponibilidade).
- Limite de impacto local para evitar replanejamento global desnecessário.

**Critérios de aceite**
- Replanejamento parcial em < 120s para incidentes locais.

## 3) Centro de comando com KPIs executivos
**Entregável**
- Painel executivo (Custo, SLA operacional, legal compliance, equidade, EV health).
- Relatório automático semanal (PDF/JSON) por empresa/linha.

**Critérios de aceite**
- Decisão de cenário em 1 clique com comparação de impacto financeiro e legal.

## 4) Hardening de produção
**Entregável**
- Testes de carga, observabilidade (logs, métricas, traces), política de rollback.
- SLOs formais para API de otimização e ingestão.

**Critérios de aceite**
- Disponibilidade >= 99,5% em janela mensal.

---

## KPIs-alvo por fase

### Operacionais
- Cobertura de viagens: 100%
- CCT violations: queda progressiva fase a fase
- p95 atraso planejado vs realizado: redução contínua

### Mão de obra
- Desvio de equidade semanal: redução >= 25% em 90 dias
- Horas pagas improdutivas: redução >= 15%

### Frota
- Uso de frota ativa: melhora >= 10%
- Deadhead/km improdutivo: redução >= 12%

### EV
- Custo energético por km: redução >= 8%
- Eventos de SoC crítico: tendência decrescente

---

## Backlog técnico priorizado (ordem de implementação)
1. Persistência de cenários Macro/What-if no backend.
2. Ingestão GTFS-RT/AVL com scheduler + normalização de eventos.
3. Reconciliador planejado vs realizado com recomendações automáticas.
4. Rostering semanal com senioridade e folgas longas.
5. Goal Programming formal (d+/d-) e visualização de trade-off.
6. Tradutor NLP para DSL validada.
7. EV degradação + política de recarga otimizada.
8. Replanejamento parcial por incidente.

---

## Riscos e mitigação
- **Dados incompletos (GTFS/AVL):** fallback por janela histórica e score de qualidade de dados.
- **Conflito entre custo e legal:** prioridade hard constraints + simulação de cenários.
- **Regras textuais ambíguas:** validação semântica + confirmação antes de execução.
- **Escalabilidade:** separação de workers de otimização e ingestão assíncrona.

---

## Resultado esperado em 90 dias
Plataforma OTIMIZ evoluída para nível corporativo, com capacidade de decisão estratégica, execução operacional robusta, conformidade legal rastreável e melhoria contínua baseada em dados reais da operação.
