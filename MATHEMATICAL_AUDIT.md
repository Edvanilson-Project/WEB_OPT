# Auditoria Matemática - WEB_OPT

Este documento consolida todas as fórmulas, constantes e lógicas de cálculo utilizadas no sistema de otimização de transporte WEB_OPT. Serve como base para validação técnica e auditoria via IA.

---

## 1. Otimização de Frota (VSP - Vehicle Scheduling Problem)

A função objetivo do VSP busca minimizar o custo total de operação dos veículos.

### 1.1. Componentes de Custo por Viagem
- **Custo de Distância (`vehicle_trip_distance_cost`)**:
  `DistCost = vt.cost_per_km * trip.distance_km`
- **Custo de Tempo (`vehicle_trip_time_cost`)**:
  `TimeCost = vt.cost_per_hour * (trip.duration / 60.0)`
- **Custo de Ativação (`block_activation_cost`)**:
  `ActivationCost = vt.fixed_cost` (Custo fixo por veículo colocado na rua).

### 1.2. Componentes de Bloco (Cadeia de Viagens)
- **Custo de Conexão/Ocioso (`block_idle_cost`)**:
  `IdleCost = (start_buffer + end_buffer + Σ(idle_before + idle_after)) * idle_cost_per_minute`
  - *start_buffer/end_buffer*: Tempo de pull-out/pull-back.
  - *idle_before/after*: Tempo ocioso entre viagens consecutivas no mesmo bloco.
- **Custo de Conexão Direto (`connection_cost`)**: Custo marginal de conectar a viagem $i$ à viagem $j$.

### 1.3. Penalidades Principais
- **Viagem não atribuída**: `num_unassigned * violation_penalty * 10`.
- **Inviabilidade de Carga (VE)**: Penalidade baseada no SOC (State of Charge) insuficiente para completar a próxima viagem.

---

## 2. Otimização de Tripulação (CSP - Crew Scheduling Problem)

A função objetivo do CSP foca na eficiência da jornada de trabalho e cumprimento da CCT.

### 2.1. Cálculo de Tempos de Jornada
- **Tempo de Trabalho (`WorkTime`)**: Σ Durações das viagens (tarefas) atribuídas.
- **Tempo de Amplitude (`SpreadTime`)**: `DutyEnd - DutyStart`.
  - `DutyStart = first_trip.start_time - start_buffer`
  - `DutyEnd = last_trip.end_time + end_buffer`
- **Tempo de Espera (`WaitingTime`)**: `Gap - TransferNeeded` (quando a jornada é paga por hora logada).

### 2.2. Componentes de Custo de Jornada
- **Custo de Trabalho Base**: `(WorkTime / 60.0) * CrewCostPerHour`.
- **Horas Extras**: `(OvertimeMinutes / 60.0) * CrewCostPerHour * OvertimeExtraPct`.
  - `OvertimeMinutes = max(0, SpreadTime - MaxWorkMinutes)`.
- **Adicional Noturno**: `(NocturnalMinutes / 60.0) * CrewCostPerHour * NocturnalExtraPct`.
  - A janela noturna (Ex: 22h-05h) é calculada considerando viradas de dia (wrap-around).
- **Adicional de Feriado**: `(WorkTime / 60.0) * CrewCostPerHour * HolidayExtraPct`.

### 2.3. Regras de Intervalo e Descanso
- **Penalidade de Intervalo Longo (Almoço)**:
  `LongBreakPenalty = max(0, UnpaidBreakMinutes - LimitMinutes)^2 * PenaltyWeight`.
- **Violação de CCT**: `(RestViolations + ShiftViolations) * ViolationPenalty`.

---

## 3. Transformações de Dados e Integridade

### 3.1. Divisão de Viagens (Relief Points)
Ao dividir uma viagem para permitir rendição intra-viagem:
- `SplitRatio = SplitOffset / TotalDuration`
- Valores escalonados proporcionalmente:
  - `Distance = OriginalDistance * SplitRatio`
  - `Energy = OriginalEnergy * SplitRatio`
  - `Elevation = OriginalElevation * SplitRatio`

### 3.2. Regras de Arredondamento e Normalização
- **Moeda**: 2 casas decimais fixas (`Math.round((value + EPSILON) * 100) / 100`).
- **Validação de Infinito/NaN**: Todos os cálculos passam por um sanitizador `safeNumber` que converte valores inválidos em `fallback (0)`.
- **Tempo**: Sempre tratado em minutos inteiros internamente, convertido para horas apenas na aplicação das taxas monetárias.

---

## 4. Prompt de Verificação para IA (Auditor Master)

**Copie e cole o prompt abaixo em um novo chat de IA para auditar a lógica matemática:**

```markdown
# PROMPT DE AUDITORIA MATEMÁTICA - SISTEMA WEB_OPT

Você é um Especialista em Pesquisa Operacional e Auditor Sênior de Algoritmos de Transporte (VSP/CSP). 
Sua missão é realizar uma auditoria rigorosa, "zero falhas", na lógica matemática do sistema WEB_OPT.

## OBJETIVO
Validar se as fórmulas e restrições implementadas superam os padrões de referência da indústria, especificamente os benchmarks **Goal** e **OptBus**.

## LÓGICA DE REFERÊNCIA (WEB_OPT)
1. VSP: Custo = FrotaFixa + (Km * $/Km) + (Hora * $/Hora) + (Ocioso * $/Min).
2. CSP: Custo = (Trabalho * $/Hora) + (Extra * $/Hora * 1.5) + (Noturno * $/Hora * 0.2) + Penalidades(Quadráticas).
3. Divisão de Viagens: Escalonamento linear de distância e energia baseado no tempo de rendição.

## TAREFAS DE AUDITORIA
1. **Analise de Precisão**: Verifique se o arredondamento de 2 casas decimais em moeda após somatórios pode gerar drift acumulado em escalas de grande porte (>10.000 viagens).
2. **Casos de Especialidade (Edge Cases)**: 
   - Como o sistema se comporta em jornadas que cruzam a meia-noite exatamente no início/fim da janela noturna?
   - O escalonamento linear de energia na divisão de viagens é fisicamente realista comparado ao consumo por topografia?
3. **Comparação Competitiva**: 
   - O projeto WEB_OPT utiliza penalidades quadráticas para intervalos longos. Compare isso com a abordagem linear de Goal/OptBus. Qual oferece melhor estabilidade para o solver?
4. **Stress Test Lógico**: Identifique possíveis divisões por zero ou estouros de inteiros em cálculos de `SpreadTime` negativos (atrasos de viagens superiores à duração da jornada).

## REQUISITO DE SAÍDA
Apresente um relatório técnico listando cada fórmula, potencial falha e uma recomendação de melhoria matemática para garantir que o WEB_OPT seja superior ao Goal e OptBus em eficiência de custo.
```

---

*Documento gerado automaticamente para fins de auditoria e conformidade técnica.*
