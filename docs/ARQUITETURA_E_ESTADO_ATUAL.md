# DOCUMENTO DE MAPEAMENTO DE ARQUITETURA E ESTADO ATUAL

**Versão:** 1.0  
**Data:** 2026-04-13  
**Analista:** Sistema de Varredura Automática  
**Destinado a:** Auditoria de Bugs e Planejamento de Features

---

## 1. VISÃO GERAL DA ARQUITETURA

### 1.1 Composição do Sistema (Poly-Repo Monousuário)

O sistema é composto por **3 serviços independentes** orquestrados via `docker-compose.yml`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WEB_OPT (Root)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │   Frontend  │────▶│   Backend   │────▶│   Optimizer │              │
│  │  (Next.js)  │     │  (NestJS)  │     │  (FastAPI)  │              │
│  │  Port 3000  │     │  Port 3006  │     │  Port 8000  │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│         │                   │                   │                        │
│         │    axios+JWT     │   HTTP REST       │  VSP+CSP Algorithms   │
│         ▼                  ▼                   ▼                        │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │   Browser   │     │ PostgreSQL │     │   CPU/GPU   │              │
│  │             │     │  Port 5432 │     │   Solving   │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Métodos de Comunicação

| Camada | Protocolo | Implementação |
|--------|----------|---------------|
| Frontend → Backend | REST/HTTPS | Axios com interceptors JWT |
| Backend → Optimizer | HTTP/REST | `http.post()` nativo (NestJS) |
| Frontend → Optimizer | REST | Axios direto (endpoint what-if) |
| WebSockets | N/A | Não implementado |
| gRPC | N/A | Não implementado |
| GraphQL | N/A | Não implementado |
| Message Queue | N/A | Não implementado |

### 1.3 Fluxo Principal de Otimização

```
1. Usuário seleciona linha(s) no Frontend
       ↓
2. Frontend chama POST /api/v1/optimization/run (NestJS)
       ↓
3. NestJS monta payload com trips, vehicle_types, params
       ↓
4. NestJS chama POST http://optimizer:8000/optimize
       ↓
5. FastAPI executa HybridPipeline (MCNF → SA → Tabu → GA → ILP)
       ↓
6. FastAPI retorna OptimizationResult (blocks + duties)
       ↓
7. NestJS persiste em optimization_runs, retorna run_id
       ↓
8. Frontend poll GET /api/v1/optimization/:id até completion
       ↓
9. Frontend exibe Gantt com resultado
```

---

## 2. MODELAGEM DE DADOS E BANCO DE DADOS (TypeORM / NestJS)

### 2.1 Diagrama de Entidades Principais

```
BaseCompanyEntity (abstract)
    ├── CompanyEntity
    ├── UserEntity
    ├── LineEntity
    ├── TerminalEntity
    ├── TripEntity
    ├── VehicleTypeEntity
    ├── OptimizationRunEntity
    ├── OptimizationSettingsEntity
    ├── TimetableEntity
    ├── ScheduleEntity
    ├── ScheduleGroupEntity
    ├── ScheduleGroupItemEntity
    ├── CrewShiftEntity
    ├── VehicleRouteEntity
    ├── LineTripProfileEntity
    ├── TimeBandEntity
    ├── TripTimeBandEntity
    ├── TripTimeConfigEntity
    ├── PassengerConfigEntity
    └── PassengerBandEntity
```

### 2.2 Entidades Detalhadas

#### 2.2.1 OptimizationRunEntity
**Tabela:** `optimization_runs`

| Campo | Tipo | Descrição | Observação |
|-------|------|-----------|-----------|
| id | SERIAL | PK | |
| company_id | INT | FK → companies | BaseCompanyEntity |
| line_id | INT | Linha única (nullable) | Index |
| line_ids | JSONB | Array de linhas (multi-linha) | |
| schedule_id | INT | FK → schedules | |
| profile_id | INT | Perfil de otimização | Index |
| status | ENUM | pending/running/completed/failed/cancelled | Index |
| algorithm | ENUM | hybrid_pipeline, greedy, mcnf, etc | |
| params | JSONB | Parâmetros VSP/CSP | |
| result_summary | JSONB | Resultado completo | |
| total_vehicles | INT | Veículos na solução | |
| total_crew | INT | Tripulantes na solução | |
| total_cost | DECIMAL(14,2) | Custo total | |
| cct_violations | INT | Violações CCT | |
| started_at | TIMESTAMP | Início da execução | |
| finished_at | TIMESTAMP | Fim da execução | |
| duration_ms | INT | Duração em ms | |
| error_message | VARCHAR(2000) | Erro se failed | |
| stdout_log | TEXT | Log do solver | |

#### 2.2.2 TripEntity
**Tabela:** `trips`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | PK |
| company_id | INT | FK |
| line_id | INT | FK → lines |
| schedule_id | INT | FK → schedules |
| timetable_id | INT | FK → timetables |
| start_time | INT | Minutos desde meia-noite |
| end_time | INT | Minutos desde meia-noite |
| origin_id | INT | FK → terminals |
| destination_id | INT | FK → terminals |
| distance_km | DECIMAL | Distância |
| trip_group_id | INT | Pares de viagem (ida/volta) |

#### 2.2.3 VehicleTypeEntity
**Tabela:** `vehicle_types`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | PK |
| company_id | INT | FK |
| name | VARCHAR | Nome do tipo |
| passenger_capacity | INT | Capacidade |
| cost_per_km | DECIMAL | Custo por km |
| cost_per_hour | DECIMAL | Custo por hora |
| fixed_cost | DECIMAL | Custo fixo de ativação |
| is_electric | BOOLEAN | Tipo elétrico |
| battery_capacity_kwh | DECIMAL | Capacidade bateria |
| minimum_soc | DECIMAL | SoC mínimo |
| charge_rate_kw | DECIMAL | Taxa de carga |

### 2.3 Relacionamentos Críticos

```sql
companies (1) ──┬── (N) users
                ├── (N) optimization_runs
                ├── (N) lines
                ├── (N) trips
                ├── (N) terminals
                ├── (N) vehicle_types
                └── (N) schedules

lines (1) ──┬── (N) trips
            └── (N) optimization_runs

schedules (1) ──┬── (N) trips
                └── (N) optimization_runs

trips (N) ──┬── (1) lines
            ├── (1) terminals (origin)
            ├── (1) terminals (destination)
            └── (N) optimization_runs
```

### 2.4 Gargalos de Modelagem Identificados

| Gargalo | Severidade | Descrição |
|---------|------------|-----------|
| Falta de índice em `trips.schedule_id` | Alta | Queries por schedule podem ser lentas |
| `deadhead_times` como JSONB | Média | Sem índices, consultas geoespaciais inviáveis |
| Índices compostos ausentes | Média | (company_id, line_id, start_time) |
| Circular dependency | Alta | Line → Trip → Terminal pode criar ciclos |
| company_id em todas as entidades | Baixa | Boa prática, mas multiplica joins |

---

## 3. MAPEAMENTO DO BACKEND (NestJS)

### 3.1 Estrutura de Módulos

```
backend/src/
├── app.module.ts
├── main.ts
├── config/
│   ├── app.config.ts
│   └── database.config.ts
├── common/
│   ├── entities/
│   │   ├── base.entity.ts
│   │   └── base-company.entity.ts
│   ├── exceptions/
│   ├── guards/
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   └── roles.decorator.ts
│   └── utils/
│       └── company-scope.util.ts  ← IDOR protection
├── modules/
│   ├── auth/
│   ├── companies/
│   ├── users/
│   ├── lines/
│   ├── terminals/
│   ├── trips/
│   ├── vehicle-types/
│   ├── schedules/
│   ├── timetables/
│   ├── schedule-groups/
│   ├── optimization/          ← CORE
│   │   ├── optimization.controller.ts
│   │   ├── optimization.service.ts   (2586 linhas!)
│   │   ├── optimization.module.ts
│   │   ├── entities/
│   │   └── dto/
│   ├── optimization-settings/
│   ├── crew-shifts/
│   ├── vehicle-routes/
│   └── reports/
```

### 3.2 Principais Controllers e Services

#### 3.2.1 OptimizationController
**Arquivo:** `backend/src/modules/optimization/optimization.controller.ts`

| Método | Endpoint | Descrição |
|--------|---------|-----------|
| POST | `/run` | Inicia otimização |
| GET | `/` | Lista otimizações |
| GET | `/:id` | Detalhes de uma otimização |
| GET | `/:id/audit` | Log de auditoria |
| PATCH | `/:id/cancel` | Cancela otimização |

#### 3.2.2 OptimizationService (2586 linhas)
**Arquivo:** `backend/src/modules/optimization/optimization.service.ts`

Métodos críticos:

```typescript
// Linha ~80: Cleanup de execuções zumbis
async _cleanupZombieRuns()

// Linha ~250: POST /run handler
async runOptimization(runDto: RunOptimizationDto, userId: number): Promise<OptimizationRunEntity>

// Linha ~300: Monta payload para Python
async _buildOptimizerPayload(companyId: number, lineIds: number[], settings: ActiveSettingsDto): Promise<OptimizerPayloadDto>

// Linha ~450: Chama o motor Python
async _callOptimizerService(url: string, payload: OptimizerPayloadDto): Promise<any>

// Linha ~700: Persiste resultado
async _saveResults(run: OptimizationRunEntity, result: OptimizationResultPayload): Promise<void>

// Linha ~2534: FIXME - Cancelamento de execuções presas
```

### 3.3 Integração HTTP com o Motor Python

**Arquivo:** `backend/src/modules/optimization/optimization.service.ts:263`

```typescript
const optimizerUrl = this.configService.get('OPTIMIZER_URL', 'http://localhost:8000');

// Called internally:
const response = await this._callOptimizerService(optimizerUrl, payload);

// Response is NOT awaited in runOptimization() - it's queued via:
this.processOptimizationQueue(); // Background processing
```

**Problema identificado:** O serviço faz polling interno do Python, mas não há circuit breaker configurado. Se o Python ficar indisponível, o NestJS pode ficar preso em loops de retry.

### 3.4 Sistema de Autenticação/Autorização

| Componente | Implementação |
|------------|---------------|
| Autenticação | JWT via `@nestjs/jwt` + Passport |
| Armazenamento | `localStorage` no Frontend |
| Header | `Authorization: Bearer <token>` |
| Guards | `RolesGuard` + Decorator `@Roles()` |
| Company Scope | `company-scope.util.ts` - IDOR protection |

**Arquivos de autenticação:**
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/jwt.strategy.ts`

---

## 4. MAPEAMENTO DO FRONTEND (Next.js 14)

### 4.1 Estrutura de Diretórios

```
frontend/src/
├── app/
│   ├── (DashboardLayout)/
│   │   ├── otimiz/
│   │   │   ├── optimization/
│   │   │   │   ├── page.tsx              # Página principal
│   │   │   │   ├── loading.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── TabGantt.tsx       # Gráfico de Gantt
│   │   │   │       ├── TabOverview.tsx     # KPIs
│   │   │   │       ├── TabAlerts.tsx       # Conflitos
│   │   │   │       ├── Toolbar.tsx
│   │   │   │       └── Sidebar.tsx
│   │   │   ├── dashboard/
│   │   │   ├── reports/
│   │   │   ├── trips/
│   │   │   ├── vehicles/
│   │   │   ├── lines/
│   │   │   ├── settings/
│   │   │   └── vehicles-routes/
│   │   └── layout/
│   ├── auth/
│   │   └── auth1/login/page.tsx
│   └── api/
├── lib/
│   ├── api.ts               # Cliente Axios + interceptors
│   └── query-hooks.ts       # React Query hooks
├── store/
│   ├── store.ts             # Zustand store principal
│   └── hooks.ts             # Hooks de acesso ao store
├── utils/
│   ├── theme.ts            # MUI theme
│   └── gantt-utils.ts      # Utilitários Gantt
└── types/
    └── index.ts             # Tipos TypeScript
```

### 4.2 Gerenciamento de Estado

| Estado | Biblioteca | Escopo |
|--------|------------|--------|
| Estado global da aplicação | **Zustand** | `store/store.ts` |
| Token JWT | `localStorage` | `'otimiz_token'` |
| Dados do usuário | `localStorage` | `'otimiz_user'` |
| Cache de requisições | **React Query** | `lib/query-hooks.ts` |

**Store Zustand (`frontend/src/store/store.ts`):**
- Otimizações ativas
- Seleção de linha(s)
- Configurações de visualização
- Estado do Gantt (zoom, pan, seleção)

### 4.3 Componentes Visuais de Complexidade

#### 4.3.1 TabGantt.tsx
**Arquivo:** `frontend/src/app/(DashboardLayout)/otimiz/optimization/_components/TabGantt.tsx`

| Característica | Implementação |
|---------------|---------------|
| Tipo | Gráfico de barras horizontais |
| Renderização | Canvas + HTML sobrepositivo |
| Drag-and-drop | Implementado para mover trips |
| Zoom | Suportado (dias, horas) |
| Líneas | Uma barra por bloco |
| Cores | Por tipo de veículo ou linha |

#### 4.3.2 TabOverview.tsx
Exibição de KPIs:
- Total de veículos
- Total de tripulantes
- Custo total
- Violações CCT

#### 4.3.3 TabAlerts.tsx
Lista de conflitos:
- Violações de janela de tempo
- Capacidade excedida
- Falta de conexão viável

### 4.4 Consumo de API

**Cliente HTTP:** `frontend/src/lib/api.ts`

```typescript
// Axios instance com interceptors
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
});

// Interceptor de request - adiciona JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('otimiz_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de response - trata erros 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect para login
    }
    return Promise.reject(error);
  }
);
```

**React Query Hooks (`frontend/src/lib/query-hooks.ts`):**

```typescript
// Exemplo de hooks
export function useOptimization(id: number) { ... }
export function useOptimizations(companyId: number) { ... }
export function useRunOptimization() { ... }
export function useTrips(filters: TripFilters) { ... }
```

---

## 5. CONTRATOS DE INTEGRAÇÃO (NestJS <-> Python)

### 5.1 POST /optimize (Endpoint Principal)

**URL:** `http://optimizer:8000/optimize`

#### 5.1.1 Request Payload (TypeScript → Python)

```typescript
// backend/src/modules/optimization/dto/optimizer-payload.dto.ts
interface OptimizerPayloadDto {
  trips: Array<{
    id: number;
    line_id: number;
    trip_group_id: number | null;
    start_time: number;        // minutos desde meia-noite
    end_time: number;          // minutos desde meia-noite
    origin_id: number;         // terminal de origem
    destination_id: number;    // terminal de destino
    duration: number;           // duração em minutos
    distance_km: number;
    deadhead_times: Record<number, number>; // { terminalId: minutos }
  }>;

  vehicle_types: Array<{
    id: number;
    name: string;
    passenger_capacity: number;
    cost_per_km: number;
    cost_per_hour: number;
    fixed_cost: number;
    is_electric: boolean;
    battery_capacity_kwh: number;
    minimum_soc: number;
    charge_rate_kw: number;
    energy_cost_per_kwh: number;
  }>;

  algorithm: 'hybrid_pipeline' | 'greedy' | 'genetic' | 'simulated_annealing' 
           | 'tabu_search' | 'set_partitioning' | 'mcnf' | 'joint_solver';

  depot_id?: number;
  depots?: Array<{
    id: number;
    capacity: number;
  }>;

  time_budget_s?: number;

  cct_params?: {
    max_shift_minutes?: number;
    min_work_minutes?: number;
    max_work_minutes?: number;
    min_layover_minutes?: number;
    connection_tolerance_minutes?: number;
    allow_relief_points?: boolean;
    operator_change_terminals_only?: boolean;
    // ... outros parâmetros CCT/CLT
  };

  vsp_params?: {
    fixed_vehicle_activation_cost?: number;
    deadhead_cost_per_minute?: number;
    idle_cost_per_minute?: number;
    max_vehicle_shift_minutes?: number;
    allow_multi_line_block?: boolean;
    allow_vehicle_split_shifts?: boolean;
    min_layover_minutes?: number;
    // ... outros parâmetros VSP
  };
}
```

#### 5.1.2 Response Payload (Python → NestJS)

```json
{
  "status": "ok",
  "vehicles": 12,
  "crew": 18,
  "total_trips": 156,
  "total_cost": 45210.50,
  "cct_violations": 0,
  "unassigned_trips": 0,
  "uncovered_blocks": 0,
  "vsp_algorithm": "hybrid_pipeline",
  "csp_algorithm": "set_partitioning_optimized_csp",
  "elapsed_ms": 12500.5,
  "blocks": [
    {
      "block_id": 1,
      "trips": [101, 102, 103],
      "num_trips": 3,
      "start_time": 360,
      "end_time": 720,
      "activation_cost": 800.0,
      "connection_cost": 45.0,
      "distance_cost": 125.50,
      "time_cost": 340.25,
      "idle_cost": 12.75,
      "total_cost": 1323.50,
      "warnings": [],
      "meta": {}
    }
  ],
  "duties": [
    {
      "duty_id": 1,
      "blocks": [1, 2],
      "trip_ids": [101, 102, 103, 201, 202],
      "start_time": 360,
      "end_time": 1140,
      "work_time": 420,
      "spread_time": 780,
      "rest_violations": 0,
      "work_cost": 175.0,
      "total_cost": 320.50,
      "cct_penalties_cost": 0
    }
  ],
  "warnings": [],
  "cost_breakdown": {
    "total": 45210.50,
    "vsp": {
      "total": 28500.00,
      "activation": 9600.00,
      "connection": 540.00,
      "distance": 12500.00,
      "time": 5860.00
    },
    "csp": {
      "total": 16710.50,
      "work": 12000.00,
      "guaranteed": 2000.00,
      "overtime": 2710.50
    },
    "shares": {
      "vsp": 0.630,
      "csp": 0.370
    }
  },
  "solver_explanation": {},
  "phase_summary": {
    "mcnf_ms": 250.0,
    "sa_ms": 3200.0,
    "tabu_ms": 4100.0,
    "genetic_ms": 3800.0,
    "ilp_ms": 1150.0
  },
  "trip_group_audit": {}
}
```

### 5.2 POST /evaluate-delta (Endpoint What-If)

**URL:** `http://optimizer:8000/api/v1/evaluate-delta`

**Adicionado em:** 2026-04-13 (último commit)

#### 5.2.1 Request Payload

```json
{
  "blocks": [
    {
      "id": 1,
      "trips": [
        {
          "id": 101,
          "line_id": 10,
          "start_time": 360,
          "end_time": 420,
          "origin_id": 1,
          "destination_id": 2,
          "distance_km": 5.5,
          "deadhead_times": {"1": 0, "2": 8}
        }
      ],
      "vehicle_type_id": 1
    }
  ],
  "trip_id": 101,
  "source_block_id": 1,
  "target_block_id": 2,
  "target_index": 0,
  "vehicle_types": [
    {
      "id": 1,
      "name": "Urban Bus",
      "passenger_capacity": 50,
      "cost_per_km": 0.85,
      "cost_per_hour": 25.00,
      "fixed_cost": 800.00
    }
  ]
}
```

#### 5.2.2 Response Payload

```json
{
  "status": "ok",
  "blocks": [
    {
      "block_id": 1,
      "trips": [102, 103],
      "num_trips": 2,
      "start_time": 450,
      "end_time": 720,
      "total_cost": 892.50
    },
    {
      "block_id": 2,
      "trips": [101, 201, 202],
      "num_trips": 3,
      "start_time": 360,
      "end_time": 900,
      "total_cost": 1425.00
    }
  ],
  "cost_breakdown": {
    "total": 2317.50,
    "vsp": { "total": 2317.50 },
    "csp": { "total": 0 },
    "shares": { "vsp": 1.0, "csp": 0.0 }
  }
}
```

### 5.3 GET /health

**URL:** `http://optimizer:8000/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-13T10:00:00Z"
}
```

---

## 6. MAPEAMENTO DE FRAGILIDADES, BUGS OCULTOS E TODOs

### 6.1 TODOs e FIXMEs Encontrados

| Local | Linha | Tipo | Descrição |
|-------|-------|------|-----------|
| `backend/src/modules/optimization/optimization.service.ts` | 2534 | **FIXME** | "Restaurar logic de cancelar execuções presas no banco após restarts" |
| `optimizer/src/algorithms/csp/set_partitioning_optimized.py` | 349 | Comentário | Log de corte prematuro (não é bug, apenas comentário) |
| `frontend/src/app/(DashboardLayout)/otimiz/_components/settings/settings-constants.ts` | 47 | Comentário | Documentação (não é TODO) |
| `optimizer/src/algorithms/utils.py` | 59 | Docstring | Descrição de função (não é TODO) |
| `optimizer/tests/qa_exhaustive.py` | 1003 | Comentário | Documentação de teste (não é TODO) |

### 6.2 Bugs Ocultos Identificados

#### BUG-001: Lógica de Cancelamento de Runs Zumbis (CRÍTICA)
**Arquivo:** `backend/src/modules/optimization/optimization.service.ts:2534`

```typescript
// FIXME: Restaurar logic de cancelar execuções presas no banco após restarts
```
**Problema:** Não há implementação funcional para cancelar execuções que ficaram em estado `RUNNING` após crash do servidor.
**Impacto:** Runs podem ficar presas para sempre no estado `RUNNING`.
**Recomendação:** Implementar `_cleanupZombieRuns()` com lógica robusta.

#### BUG-002: Fallback Inline Sub-ótimo (MÉDIA)
**Arquivo:** `backend/src/modules/optimization/optimization.service.ts`

Quando o motor Python está indisponível, o sistema faz fallback para um algoritmo interno que pode não ser otimizado.
**Impacto:** Resultados sub-ótimos podem ser persistidos.
**Recomendação:** Documentar comportamento e considerar circuit breaker.

#### BUG-003: Possível N+1 em Listagens (MÉDIA)
**Arquivo:** `backend/src/modules/optimization/optimization.service.ts`

Métodos de listagem podem não usar `JOIN` adequado para carregar relacionamentos.
**Impacto:** Performance degradada em listagens com muitas otimizações.
**Recomendação:** Auditar queries com `EXPLAIN ANALYZE`.

### 6.3 Falhas Arquiteturais

#### FALHA-001: Sem Circuit Breaker (ALTA)
**Descrição:** Backend NestJS não implementa circuit breaker ao chamar o motor Python.
**Impacto:** Se o Python ficar indisponível, múltiplos requests podem se acumular.
**Recomendação:** Implementar Polly.js ou similar.

#### FALHA-002: Sem Rate Limiting (MÉDIA)
**Descrição:** Não há rate limiting em nenhum endpoint.
**Impacto:** Possível DoS acidental ou malicioso.
**Recomendação:** Implementar `@nestjs/throttler`.

#### FALHA-003: Hardcoded Credentials (ALTA)
**Arquivos:**
- `backend/.env:13` - DB_PASSWORD
- `backend/.env:19` - JWT_SECRET
- `optimizer/.env:16` - DB_PASSWORD
- `optimizer/.env:20` - BACKEND_SECRET

**Impacto:** Exposição de credenciais se .env for commitado.
**Recomendação:** Mover para secrets manager (Vault, AWS Secrets Manager).

#### FALHA-004: IDOR Protection Incompleta (ALTA)
**Arquivo:** `backend/src/common/utils/company-scope.util.ts`

Proteção contra IDOR pode não cobrir todos os endpoints.
**Impacto:** Usuário pode acessar dados de outra empresa.
**Recomendação:** Auditar todos os endpoints com `companyId`.

#### FALHA-005: Polling Ineficiente (MÉDIA)
**Descrição:** Frontend faz polling em `useOptimizations()` sem backoff exponencial.
**Impacto:**many requests desnecessárias.
**Recomendação:** Implementar polling inteligente ou WebSockets.

### 6.4 Pontas Soltas (Mocked/Hardcoded)

| Item | Local | Status | Ação Necessária |
|------|-------|--------|----------------|
| URL do Optimizer | `optimization.service.ts:263` | Fallback para localhost | Usar variável de ambiente em produção |
| `timeout` Axios | `frontend/src/lib/api.ts` | 30s hardcoded | Configurável |
| Page size padrão | - | Não configurado | Implementar paginação |
| Mock de auth | - | Parece implementado | Verificar em produção |

### 6.5 Vazamentos de Memória Potenciais

| Local | Causa | Severidade |
|-------|-------|------------|
| `OptimizationService` | Polling sem cleanup | Média |
| `TabGantt.tsx` | Canvas não limpo em unmount | Baixa |
| React Query cache | Sem TTL configurado | Baixa |

### 6.6 Matriz de Severidade de Issues

| ID | Severidade | Esforço | Descrição |
|----|------------|---------|-----------|
| BUG-001 | CRÍTICA | Alto | Cancelamento de runs zumbis |
| FALHA-003 | ALTA | Baixo | Credenciais hardcoded |
| FALHA-004 | ALTA | Médio | IDOR protection |
| FALHA-001 | ALTA | Médio | Circuit breaker |
| BUG-002 | MÉDIA | Médio | Fallback sub-ótimo |
| BUG-003 | MÉDIA | Baixo | N+1 queries |
| FALHA-002 | MÉDIA | Baixo | Rate limiting |
| FALHA-005 | MÉDIA | Médio | Polling ineficiente |

---

## 7. RESUMO EXECUTIVO

### 7.1 Pontos Fortes

1. **Arquitetura limpa** - Separação clara de responsabilidades (Frontend/Backend/Motor)
2. **TypeORM bem utilizado** - Entities com relacionamentos definidos
3. **Algoritmos de otimização robustos** - MCNF, GA, SA, Tabu, ILP
4. **Codebase Python bem organizada** - Separação em módulos VSP/CSP/Hybrid
5. **Endpoint What-If implementado** - Permite recalc em tempo real

### 7.2 Pontos de Atenção Imediata

1. **BUG-001**: Implementar cancelamento de runs zumbis
2. **FALHA-003**: Remover credenciais hardcoded do .env
3. **FALHA-004**: Auditar proteção IDOR em todos os endpoints

### 7.3 Recomendações de Arquitetura

1. **Curto prazo**: Adicionar circuit breaker, rate limiting, paginação
2. **Médio prazo**: Migrar para secrets manager, WebSockets para polling
3. **Longo prazo**: Considerar GraphQL, service mesh (Istio), cache Redis

---

## ANEXO A: Lista de Arquivos Críticos

| Camada | Arquivo | Linhas | Criticidade |
|--------|---------|--------|-------------|
| Backend | `optimization.service.ts` | 2586 | CRÍTICA |
| Backend | `optimization.controller.ts` | ~200 | ALTA |
| Python | `mcnf.py` | 410 | ALTA |
| Python | `pipeline.py` | 337 | ALTA |
| Python | `set_partitioning_optimized.py` | 1002 | MÉDIA |
| Python | `evaluator.py` | 338 | MÉDIA |
| Frontend | `TabGantt.tsx` | ~800 | ALTA |
| Frontend | `api.ts` | ~100 | MÉDIA |

## ANEXO B: Variáveis de Ambiente

### Backend (backend/.env)
```env
NODE_ENV=development
PORT=3006
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=otmiz_new
DB_USERNAME=postgres
DB_PASSWORD=postgres          # ⚠️ HARDCODED
JWT_SECRET=supersecretkey     # ⚠️ HARDCODED
JWT_EXPIRES_IN=7d
OPTIMIZER_URL=http://localhost:8000
```

### Optimizer (optimizer/.env)
```env
PYTHON_ENV=development
OPTIMIZER_PORT=8000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=otmiz_new
DB_USER=postgres
DB_PASSWORD=postgres          # ⚠️ HARDCODED
BACKEND_SECRET=secretkey      # ⚠️ HARDCODED
LOG_LEVEL=INFO
ILP_TIMEOUT_SECONDS=60
```

---

*Documento gerado automaticamente via varredura de código.*
*Última atualização: 2026-04-13*
