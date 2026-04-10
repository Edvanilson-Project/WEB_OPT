# INVENTÁRIO COMPLETO DO PROJETO OTIMIZ

> Documento gerado em 04/04/2026 — mapa completo do sistema para evitar perdas e retrabalho.

---

## 1. VISÃO GERAL

O OTIMIZ é um sistema de otimização de transporte público com 3 componentes:

| Componente | Tecnologia | Porta | Função |
|-----------|-----------|-------|--------|
| **Backend** | NestJS + TypeORM + PostgreSQL | 3001 | API REST, CRUD, autenticação, orquestração |
| **Optimizer** | FastAPI + PuLP + NumPy | 8000 | Algoritmos VSP/CSP (Vehicle/Crew Scheduling) |
| **Frontend** | Next.js + Material UI + Redux | 3000 | Interface web |

**Banco de dados:** PostgreSQL (`otmiz_new`)  
**Prefixo de API:** `/api/v1/`

---

## 2. ARQUIVOS NA RAIZ — O QUE MANTER E O QUE PODE SER REMOVIDO

### ✅ MANTER (essenciais ao projeto)
| Arquivo | Razão |
|---------|-------|
| `package.json` | Dependências raiz (scripts de test) |
| `seed.sql` | Dados iniciais do banco |
| `PLANO_30_60_90_OTIMIZACAO.md` | Documentação de roadmap |
| `RESUMO_OTIMIZACAO_E_VALIDACOES.md` | Documentação de validações |
| `INVENTARIO_PROJETO_OTIMIZ.md` | Este documento |

### 🗑️ PODEM SER REMOVIDOS (patches temporários e testes ad-hoc)
Estes arquivos são patches de desenvolvimento e testes manuais que já foram aplicados ou não são mais necessários:

| Arquivo | Tipo | Razão para remover |
|---------|------|-------------------|
| `backend_patch.sh` | Patch | Já aplicado |
| `patch_240.sh` | Patch | Já aplicado |
| `patch_backend_cct.sh` | Patch | Já aplicado |
| `patch_csp_backend.sh` | Patch | Já aplicado |
| `patch_csp_params.sh` | Patch | Já aplicado |
| `patch_deadhead.sh` | Patch | Já aplicado |
| `patch_deadhead2.sh` | Patch | Já aplicado |
| `patch_dump_payload.js` | Debug | Ferramenta de debug temporária |
| `patch_hybrid.sh` | Patch | Já aplicado |
| `patch_joint.py` | Patch | Já aplicado |
| `patch_joint_swap.py` | Patch | Já aplicado |
| `patch_last.sh` | Patch | Já aplicado |
| `patch_max_work.js` | Patch | Já aplicado |
| `patch_optimizer.py` | Patch | Já aplicado |
| `patch_pairs.py` | Patch | Já aplicado |
| `patch_pipeline_2.py` | Patch | Já aplicado |
| `patch_revert_pairs.py` | Patch | Revert já aplicado |
| `patch_revert_transfer.py` | Patch | Revert já aplicado |
| `patch_single_vehicle.sh` | Patch | Já aplicado |
| `patch_split_backend.sh` | Patch | Já aplicado |
| `patch_stochastic.py` | Patch | Já aplicado |
| `patch_transfer_needed.py` | Patch | Já aplicado |
| `patch_utils.sh` | Patch | Já aplicado |
| `patch_validator.sh` | Patch | Já aplicado |
| `patch_vsp.py` | Patch | Já aplicado |
| `patch_vsp.sh` | Patch | Já aplicado |
| `patch_vsp2.py` | Patch | Já aplicado |
| `patch.py` | Patch | Já aplicado |
| `revert_patch_pipeline.py` | Patch | Revert já aplicado |
| `check_runs.js` | Debug | Script de debug |
| `trigger_opt.js` | Debug | Script de debug |
| `update_limits.js` | Debug | Script de debug |
| `test_carta_horaria_e2e.js` | Teste ad-hoc | Mover para backend/test/ |
| `test_cct.py` | Teste ad-hoc | Mover para optimizer/tests/ |
| `test_concurrent.js` | Teste ad-hoc | Mover para backend/test/ |
| `test_concurrent_15.js` | Teste ad-hoc | Mover para backend/test/ |
| `test_crud_full.py` | Teste ad-hoc | Mover para backend/test/ |
| `test_crud_v2.py` | Teste ad-hoc | Mover para backend/test/ |
| `test_e2e_full.py` | Teste ad-hoc | Mover para backend/test/ |
| `test_error.js` | Teste ad-hoc | Mover para backend/test/ |
| `test_gaps.js` | Teste ad-hoc | Debug |
| `test_joint_ideas.py` | Teste ad-hoc | Debug |
| `test_line_names.js` | Teste ad-hoc | Debug |
| `test_mega_qa.sh` | Teste ad-hoc | Debug |
| `test_overlap.py` | Teste ad-hoc | Debug |
| `test_peak_multi.js` | Teste ad-hoc | Debug |
| `test_python_greedy.py` | Teste ad-hoc | Debug |
| `test_runs.js` | Teste ad-hoc | Debug |
| `test_timetable_e2e.js` | Teste ad-hoc | Debug |
| `test_vsp_sa.py` | Teste ad-hoc | Debug |

**Total: 45 arquivos removíveis na raiz**

---

## 3. MÓDULOS DO BACKEND (20 módulos)

| Módulo | Status | Entidade | CRUD | Observações |
|--------|--------|----------|------|-------------|
| auth | ✅ Completo | — | Login/Profile | JWT com bcrypt |
| users | ✅ Completo | UserEntity | CRUD + roles | 4 roles: SUPER_ADMIN, COMPANY_ADMIN, ANALYST, OPERATOR |
| companies | ✅ Completo | CompanyEntity | CRUD | CNPJ único |
| lines | ✅ Completo | LineEntity | CRUD | 4 modos: ROUNDTRIP, OUTBOUND_ONLY, RETURN_ONLY, FLEXIBLE |
| terminals | ✅ Completo | TerminalEntity | CRUD | soft delete, lat/long, isGarage |
| vehicle-types | ✅ Completo | VehicleTypeEntity | CRUD | custo/km, custo/h, capacidade |
| trips | ✅ Completo | TripEntity | CRUD + bulk | direction outbound/return, tripGroupId |
| schedules | ✅ Completo | ScheduleEntity | CRUD | WEEKDAY/SATURDAY/SUNDAY/HOLIDAY |
| schedule-groups | ✅ Completo | ScheduleGroupEntity | CRUD + generateTrips | Agrupamento de quadros |
| timetables | ✅ Completo | TimetableEntity | CRUD + generateTrips | Carta horária por demanda |
| timetable-rules | ✅ Completo | TimetableRuleEntity | CRUD | headway por faixa horária |
| time-bands | ✅ Completo | TimeBandEntity | CRUD | Faixas horárias (pico/vale) |
| passenger-configs | ✅ Completo | PassengerConfigEntity | CRUD + bands | Demanda por faixa |
| trip-time-configs | ✅ Completo | TripTimeConfigEntity | CRUD + bands | Duração por faixa |
| line-trip-profiles | ✅ Completo | LineTripProfileEntity | CRUD + bulk | Perfil viagem por linha |
| optimization | ✅ Completo | OptimizationRunEntity | Run + dashboard | Orquestra solver |
| optimization-settings | ✅ Completo | OptimizationSettingsEntity | CRUD + activate | 60+ parâmetros |
| reports | ✅ Completo | — | KPIs + comparação | Sem entidade própria |
| crew-shifts | ⚠️ Incompleto | CrewShiftEntity | ❌ Sem service/controller | Só a entidade existe |
| vehicle-routes | ⚠️ Incompleto | VehicleRouteEntity | ❌ Sem service/controller | Só a entidade existe |

### Módulos que PRECISAM ser completados:
1. **crew-shifts** — Precisa de Service + Controller para salvar/consultar jornadas de tripulantes
2. **vehicle-routes** — Precisa de Service + Controller para salvar/consultar rotas de veículos

---

## 4. ALGORITMOS DO OPTIMIZER

| Algoritmo | Classe | Tipo | Status | Resultados Típicos |
|-----------|--------|------|--------|-------------------|
| Greedy | GreedyVSP | VSP | ✅ | Baseline (15 veíc. para 88 trips) |
| Simulated Annealing | SimulatedAnnealingVSP | VSP | ✅ | -13% veículos vs greedy |
| Tabu Search | TabuSearchVSP | VSP | ✅ | -33% veículos vs greedy |
| Genetic Algorithm | GeneticVSP | VSP | ⚠️ | Igual ao greedy (safety net) |
| Greedy CSP | GreedyCSP | CSP | ✅ | Funcional com CCT completo |
| Set Partitioning | SetPartitioningCSP | CSP | ⚠️ | ILP via PuLP — lento para problemas grandes |
| Hybrid Pipeline | HybridPipeline | VSP+CSP | ✅ | Greedy → SA(35%) → Tabu(35%) → GA(20%) |
| Joint Solver | JointSolver | VSP+CSP | ⚠️ | Iterativo, pode ser instável |

---

## 5. FUNCIONALIDADES — COMPARAÇÃO COM OPTIBUS/GOAL

### O que o Optibus/Goal têm e o OTIMIZ já tem:

| Funcionalidade | Optibus | GOAL | OTIMIZ | Status |
|---------------|---------|------|--------|--------|
| **Planejamento de Rotas** | ✅ | ✅ | ✅ | Linhas com terminais, distâncias, tempos |
| **Vehicle Scheduling (VSP)** | ✅ AI | ✅ | ✅ | Greedy + SA + Tabu + Genetic |
| **Crew Scheduling (CSP)** | ✅ AI | ✅ | ✅ | Greedy + ILP (Set Partitioning) |
| **Rostering** | ✅ Avançado | ✅ | ✅ Básico | Agrupamento por inter-shift rest |
| **CCT/Legislação Trabalhista** | ✅ Hard rules | ✅ | ✅ | 25+ restrições CCT |
| **Pareamento Ida/Volta** | ✅ | ✅ | ✅ | trip_group_id + inferência |
| **Multi-linha** | ✅ | ✅ | ✅ | lineIds[] no payload |
| **Dashboard/KPIs** | ✅ | ✅ | ✅ | Veículos, tripulantes, custo, tendências |
| **Comparação de Cenários** | ✅ | ✅ | ✅ | compare(run1, run2) |
| **Swagger/OpenAPI** | ✅ | ✅ | ✅ | Documentação automática |
| **Autenticação JWT** | ✅ | ✅ | ✅ | Roles + empresas |
| **Carta Horária (Timetable)** | ✅ | ✅ | ✅ | Geração automática por demanda |

### O que o Optibus/Goal têm e o OTIMIZ NÃO tem ainda:

| Funcionalidade | Prioridade | Descrição | Complexidade |
|---------------|-----------|-----------|-------------|
| **Operações em Tempo Real** | 🔴 Alta | Monitoramento de frota, alertas, ajustes ao vivo | Alta |
| **App do Motorista** | 🔴 Alta | App mobile com escalas, rotas, notificações | Alta |
| **GTFS Import/Export** | 🔴 Alta | Formato padrão da indústria para dados de transporte | Média |
| **Gestão de Frota Elétrica (EV)** | 🟡 Média | Já tem código base, falta frontend e carregamento inteligente | Média |
| **Mapa Interativo** | 🟡 Média | Visualização de rotas, terminais, GPS no mapa | Média |
| **Transfer Planning** | 🟡 Média | Otimização de conexões entre linhas | Alta |
| **Rotating Rosters** | 🟡 Média | Escalas rotativas equitativas (4/5 dias) | Média |
| **What-If Scenarios** | 🟡 Média | Comparação visual lado a lado de cenários | Baixa |
| **Driver Safety (AI)** | 🟢 Baixa | Monitoramento de fadiga/distração por câmera | Alta |
| **Passenger Information** | 🟢 Baixa | Informação de passageiro em tempo real | Alta |
| **Machine Learning** | 🟢 Baixa | Previsão de demanda, ajuste automático | Alta |
| **Integração Hardware** | 🟢 Baixa | GPS, validadores, câmeras | Alta |

---

## 6. BUGS CONHECIDOS E CORREÇÕES APLICADAS

### Bugs Corrigidos Nesta Sessão:

| # | Bug | Arquivo | Correção |
|---|-----|---------|----------|
| 1 | Direction (ida/volta) não enviada ao optimizer | optimization.service.ts | Adicionado campo `direction` no payload |
| 2 | Terminal ID "1" hardcoded como "Central" | optimization.service.ts | Removido hardcode, usa minLayover universal |
| 3 | Sem `depot_id` no payload de trips | optimization.service.ts | Adicionado `depot_id` para suportar troca de tripulante |
| 4 | Direction ausente no modelo Trip do optimizer | models.py, schemas.py, converters.py | Adicionado campo `direction: Optional[str]` |
| 5 | Inferência ida/volta não usa direction | optimizer_service.py | Adicionada verificação de direction no pairing |
| 6 | Direction inferida errada no inline ("inbound" vs "return") | optimization.service.ts | Corrigido para "return" + usa campo real |
| 7 | Pairing inline não verifica bidirecionalidade | optimization.service.ts | Adicionada verificação `ida.origin == volta.destination` |
| 8 | Hard constraint validation frágil | optimization.service.ts | Verifica hard_issues quando ok é undefined |

### Bugs Conhecidos Ainda Pendentes:

| # | Bug | Severidade | Descrição |
|---|-----|-----------|-----------|
| 1 | Trip 5436 duplicada em 2 duties | Média | Bug no CSP cross-merge (mitigado por dedup) |
| 2 | Genetic Algorithm = safety net (igual greedy) | Baixa | Fitness function desconectada dos custos reais |
| 3 | CrewShift/VehicleRoute sem CRUD | Média | Entidades existem mas sem Service/Controller |
| 4 | Fallback deadhead 30min genérico | Baixa | Pode causar inviabilidade em terminais próximos |
| 5 | Troca de tripulante mid-trip | Feature | Só suporta troca entre trips, não durante uma trip |

---

## 7. FLUXO DE IDA/VOLTA — COMO FUNCIONA HOJE

### Conceito:
- **IDA (outbound)**: Viagem Terminal A → Terminal B
- **VOLTA (return)**: Viagem Terminal B → Terminal A
- **Par ida/volta**: Mesmo motorista faz ida E volta consecutivas

### Fluxo no Sistema:

```
1. BACKEND (TripEntity)
   - Trip tem campo `direction: OUTBOUND | RETURN`
   - Trip tem campo `tripGroupId` (liga ida com volta)
   - Trip tem `originTerminalId` e `destinationTerminalId`

2. PAYLOAD PARA OPTIMIZER
   - direction: enviado como campo ✅ (corrigido)
   - trip_group_id: enviado ✅
   - origin_id / destination_id: terminais reais ✅

3. OPTIMIZER (VSP)
   - _sort_trips(): Ordena mantendo pares sequenciais
   - build_preferred_pairs(): Detecta pares por terminal reverso
   - _forced_trip_group_candidate(): Força trip_group no mesmo bloco

4. OPTIMIZER (CSP)
   - prepare_tasks(): Run-cutting respeita pair_guard (não corta par)
   - solve(): Prioriza duty que já tem trips do mesmo trip_group

5. VALIDAÇÃO
   - MANDATORY_GROUP_SPLIT: Checa se pares ficaram no mesmo roster
```

### Onde Pode Falhar:
1. ❌ Trips sem `tripGroupId` → optimizer tenta inferir, pode errar
2. ❌ Trips sem `direction` → inferência por terminal ID (frágil)
3. ❌ Gaps entre ida/volta > 30 min → não pareados pela inferência
4. ❌ `enforce_trip_groups_hard=false` → pairs podem ser separados

### Recomendação:
**Sempre gerar trips com `tripGroupId` preenchido na carta horária.** A inferência automática é um fallback, não a solução principal.

---

## 8. TROCA DE TRIPULANTE — COMO FUNCIONA HOJE

### Conceito:
O tripulante pode ser trocado nos seguintes pontos:
1. **Entre trips**: No terminal de chegada de uma trip, antes de iniciar a próxima
2. **Em relief points**: Pontos designados para troca de tripulante
3. **No depósito**: Quando o veículo retorna à garagem

### Regras Atuais:
- `operator_change_terminals_only=true` (padrão): Só troca em terminais
- `allow_relief_points=false` (padrão): Relief points desativados
- `operator_single_vehicle_only=false` (padrão): Tripulante pode operar múltiplos veículos

### O que NÃO é suportado hoje:
- **Troca mid-trip**: Não é possível trocar o tripulante durante uma viagem (ex: em um ponto intermediário). A viagem é atômica no sistema.
- **Para implementar troca mid-trip seria necessário**:
  1. Dividir a trip em 2 sub-trips no ponto de troca
  2. Ou marcar o ponto intermediário como relief_point na trip
  3. Adicionar campo `mid_trip_relief_points: [{km, terminal_id, time_offset}]` no TripEntity

---

## 9. PÁGINAS DO FRONTEND (14 páginas)

| Página | URL | Status |
|--------|-----|--------|
| Dashboard | /otimiz/dashboard | ✅ |
| Otimização | /otimiz/optimization | ✅ |
| Configurações | /otimiz/settings | ✅ |
| Viagens | /otimiz/trips | ✅ |
| Linhas | /otimiz/lines | ✅ |
| Terminais | /otimiz/terminals | ✅ |
| Veículos | /otimiz/vehicles | ✅ |
| Empresas | /otimiz/companies | ✅ |
| Usuários | /otimiz/users | ✅ |
| Passageiros | /otimiz/passengers | ✅ |
| Tempos de Viagem | /otimiz/trip-times | ✅ |
| Cartas Horárias | /otimiz/timetables | ✅ |
| Grupos de Programação | /otimiz/schedule-groups | ✅ |
| Relatórios | /otimiz/reports | ✅ |

---

## 10. CHECKLIST DE QUALIDADE — O QUE VERIFICAR ANTES DE CADA DEPLOY

### Backend
- [ ] Todas as entidades têm `companyId` (multi-tenancy)
- [ ] DTOs com `@IsOptional()`, `@IsBoolean()` etc.
- [ ] Endpoints com `@UseGuards(JwtAuthGuard)`
- [ ] `recoverStaleRuns()` ativo no `onModuleInit`
- [ ] Swagger acessível em `/api/docs`

### Optimizer
- [ ] `POST /optimize` retorna estrutura correta (blocks, duties, meta)
- [ ] Hard constraint validator não bloqueia soft issues
- [ ] Pareamento ida/volta funciona com tripGroupId explícito
- [ ] Pareamento ida/volta funciona com inferência automática
- [ ] CCT: shift, work, driving, breaks todos validados
- [ ] Run-cutting respeita pair_guard

### Frontend
- [ ] Login funciona e armazena token
- [ ] CRUD de todas as entidades funciona
- [ ] Otimização inicia e mostra resultado
- [ ] Configurações são salvas e recuperadas
- [ ] Sem erros no console do navegador

---

## 11. COMO EXECUTAR

### Backend
```bash
cd backend
npm install
npm run start:dev  # porta 3001
```

### Optimizer
```bash
cd optimizer
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npx next dev -p 3000
```

### Banco de Dados
```bash
psql -U postgres -d otmiz_new -f seed.sql
```

---

## 12. ROADMAP DE PRIORIDADES

### 🔴 Prioridade 1 — Correções Críticas
1. Completar módulos crew-shifts e vehicle-routes (Service + Controller)
2. Garantir que toda trip tenha tripGroupId ao ser gerada pela carta horária
3. Melhorar Genetic Algorithm (fitness function real)
4. Adicionar campo `relief_points` na TripEntity para troca mid-trip

### 🟡 Prioridade 2 — Funcionalidades Essenciais
5. Import/Export GTFS
6. Mapa interativo (terminais, rotas)
7. Rotating rosters avançado
8. What-if scenarios (comparação visual)

### 🟢 Prioridade 3 — Diferenciais Competitivos
9. App do motorista (React Native)
10. Monitoramento em tempo real
11. Gestão de frota elétrica (frontend)
12. Machine Learning para previsão de demanda
