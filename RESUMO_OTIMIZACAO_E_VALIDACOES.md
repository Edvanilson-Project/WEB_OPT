# Resumo Técnico — O que a otimização faz hoje (com foco em validações e regras)

## 1) Fluxo geral da otimização

O endpoint principal `POST /optimize` executa o pipeline abaixo:

1. Recebe viagens (`trips`), tipos de veículo (`vehicle_types`) e parâmetros (`cct_params`, `vsp_params`).
2. Normaliza regras e parâmetros (incluindo interpretação de regras em linguagem natural).
3. Faz auditoria de entrada de hard constraints.
4. Executa o algoritmo selecionado (VSP/CSP ou integrado).
5. Faz auditoria de saída da solução (hard constraints na solução final).
6. Calcula custo total e KPIs operacionais.
7. Retorna blocos de veículo, duties de tripulação, alertas e metadados completos.

## 2) Algoritmos disponíveis

- `greedy`
- `genetic`
- `simulated_annealing`
- `tabu_search`
- `set_partitioning`
- `joint_solver`
- `hybrid_pipeline`

## 3) Validação de entrada (antes de otimizar)

Aplicada pelo `HardConstraintValidator.audit_input`.

### 3.1 Integridade básica dos dados

- ID de viagem duplicado → `DUPLICATE_TRIP_ID`
- Janela inválida (`end_time <= start_time`) → `INVALID_TIME_WINDOW`
- Duração inválida (`duration <= 0`) → `INVALID_DURATION`
- Origem igual destino (loop terminal inválido) → `INVALID_TERMINAL_LOOP`

### 3.2 Regras de telemetria/execução operacional

- Se `strict_terminal_sync_validation=true`: viagem não enviada ao terminal do motorista (`sent_to_driver_terminal=false`) gera `GHOST_BUS_TERMINAL_SYNC`.
- Se `strict_gps_validation=true`:
  - Coordenada incompleta (lat sem lon, ou vice-versa) → `GPS_COORDINATE_INCOMPLETE_*`
  - Latitude fora de faixa → `GPS_LATITUDE_INVALID_*`
  - Longitude fora de faixa → `GPS_LONGITUDE_INVALID_*`
  - Flag explícita inválida (`gps_valid=false`) → `GPS_FLAG_INVALID`

### 3.3 Guardrails legais de configuração

- `max_shift_minutes > 720` → `LEGAL_MAX_SHIFT_EXCEEDED`
- `max_driving_minutes > 240` → `LEGAL_CONTINUOUS_DRIVING_EXCEEDED`
- `inter_shift_rest_minutes < 660` → `LEGAL_INTERSHIFT_REST_TOO_LOW`

## 4) Validação de saída (após otimizar)

Aplicada pelo `HardConstraintValidator.audit_result`.

### 4.1 Cobertura operacional

- Viagens não cobertas → `UNCOVERED_TRIP`
- Blocos não cobertos → `UNCOVERED_BLOCK`

### 4.2 Regras VSP (veículos/blocos)

- Bloco com múltiplas linhas → `BLOCK_MULTI_LINE`
- Sobreposição temporal entre viagens no bloco → `VEHICLE_OVERLAP`
- Deadhead inviável entre viagens → `DEADHEAD_INFEASIBLE`
- Violação de mesmo depósito (quando exigido) → `BLOCK_SAME_DEPOT_VIOLATION`

### 4.3 Regras CSP (duty/jornada)

- Spread da jornada acima do limite → `SPREAD_EXCEEDED`
- Direção contínua acima do limite → `CONTINUOUS_DRIVING_EXCEEDED`
- Falta/insuficiência de pausa de refeição → `MEAL_BREAK_MISSING`
- Duty iniciando e terminando em depósitos diferentes (quando exigido) → `DUTY_SAME_DEPOT_VIOLATION`
- Duty misturando linhas (quando `enforce_single_line_duty=true`) → `DUTY_MULTI_LINE`
- Sobreposição de tasks na mesma duty → `DUTY_OVERLAP`
- Troca de operador fora de terminal/depot/ponto de alívio permitido → `OPERATOR_CHANGE_NON_TERMINAL`

### 4.4 Regras de descanso entre jornadas (roster)

- Descanso interjornada abaixo do mínimo → `INTERSHIFT_REST_VIOLATION`

### 4.5 Grupos obrigatórios de viagens

- Se `mandatory_trip_groups_same_duty` foi definido, todos os trips do grupo devem cair na mesma duty.
- Violação → `MANDATORY_GROUP_SPLIT`

### 4.6 Regras de perfil de operador (sindical/negócio)

Com `operator_profiles`:

- Roster sem operador compatível (quando `strict_union_rules=true`) → `UNASSIGNED_OPERATOR_PROFILE`
- Operador sem perfil conhecido → `UNKNOWN_OPERATOR_PROFILE`
- Violação de turno obrigatório do perfil → `MANDATORY_SHIFT_PREFERENCE_VIOLATION`
- Violação de linha obrigatória do perfil → `MANDATORY_LINE_PREFERENCE_VIOLATION`
- Violação de prioridade por senioridade → `SENIORITY_PRIORITY_VIOLATION`

### 4.7 Regras EV (elétrico)

Se warnings do solver indicarem:

- Limite de carregadores estourado → `EV_CHARGER_CAPACITY_EXCEEDED`
- SOC insuficiente → `EV_SOC_INSUFFICIENT`

## 5) Hard vs Soft (comportamento do bloqueio)

- `strict_hard_validation=true` (padrão): qualquer violação hard em entrada ou saída aborta com erro (`HardConstraintViolationError`).
- `strict_hard_validation=false`: não bloqueia execução, mas o relatório de hard constraints continua sendo retornado em `meta.hard_constraint_report`.

## 6) Regras e parâmetros suportados (principais)

### 6.1 Regras CCT/operacionais relevantes

- `max_shift_minutes`
- `max_work_minutes`
- `max_driving_minutes`
- `min_break_minutes`
- `mandatory_break_after_minutes`
- `inter_shift_rest_minutes`
- `weekly_driving_limit_minutes`
- `min_layover_minutes`
- `allow_relief_points`
- `enforce_same_depot_start_end`
- `operator_change_terminals_only`
- `enforce_single_line_duty`
- `operator_single_vehicle_only`
- `strict_union_rules`

### 6.2 Regras de fairness e metas

- `fairness_target_work_minutes`
- `fairness_tolerance_minutes`
- `fairness_weight` (normalizado para `goal_weights.fairness`)
- `goal_weights` (ex.: overtime, spread, passive_transfer, fairness)

### 6.3 Regras de pairing/trip groups

- `preserve_preferred_pairs`
- `preferred_pair_window_minutes`
- `allow_multi_line_block`
- `enforce_trip_groups_hard`
- `operator_pairing_hard`
- `mandatory_trip_groups_same_duty`

Observação: por padrão, pairing é tratado como preferência; vira hard quando os flags hard estão ligados.

Observação operacional:

- `allow_multi_line_block=true` (padrão) ajuda a reduzir blocos com 1 viagem e, portanto, reduzir a frota necessária.
- `operator_single_vehicle_only=true` força um tripulante a permanecer em tarefas do mesmo bloco/ônibus fonte.

## 7) Linguagem natural (NLP rules) já interpretada

A otimização converte textos em parâmetros, por exemplo:

- "pausa de X min" → `min_break_minutes`
- "após cada X horas" → `mandatory_break_after_minutes`
- "máximo de X horas por semana" → `weekly_driving_limit_minutes`
- "motorista deve trabalhar mais de X horas" (negado) → `max_shift_minutes`
- "spread máximo de X horas" → `max_shift_minutes`
- "reduzir horas extras" → `goal_weights.overtime`
- "reduzir spread" → `goal_weights.spread`
- "reduzir deslocamentos passivos" → `goal_weights.passive_transfer`
- "equidade / fairness" → `goal_weights.fairness`
- "descanso interjornada de Xh" → `inter_shift_rest_minutes`
- "descanso semanal de Xh" → `weekly_rest_minutes`
- "mesmo depósito" → `same_depot_required` + `enforce_same_depot_start_end`

## 8) KPI e transparência no retorno

Além de blocos/duties e custo total, o retorno inclui:

- `meta.hard_constraint_report` (entrada + saída + modo strict)
- `meta.operational_kpis` com:
  - veículos, crew, minutos trabalhados e pagos
  - delta pago-trabalhado
  - fairness (`d_plus`, `d_minus`, dentro/fora da banda)
  - `stretch_kpi` (trocas médias de veículo por operador)

## 9) Camada estratégica (monitoramento planejado vs realizado)

No módulo estratégico (`/strategy`), o sistema também faz:

- estimativa macro de frota/equipe/custo
- persistência de cenários
- ingestão de feed real (AVL/GTFS-RT)
- reconciliação planejado vs realizado com alertas:
  - ghost bus
  - GPS inválido
  - atraso P95 elevado

Com o worker em background:

- polling automático de inbox de feeds
- reconciliação automática por novo snapshot
- retenção/cleanup automático
- endpoint de status do worker e cleanup manual (`/strategy/admin/*`)

## 10) Conclusão prática

Hoje a otimização já opera com:

- validação hard de entrada e saída
- bloqueio automático de cenários inseguros (modo strict)
- enforcement legal/operacional/sindical configurável
- KPIs de auditoria para operação e governança
- ciclo estratégico de feedback para reduzir diferença entre planejado e realizado
