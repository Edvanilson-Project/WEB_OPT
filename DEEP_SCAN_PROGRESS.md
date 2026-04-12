# OTIMIZ — Deep Scan: Plano de Execução e Progresso

> **Objetivo**: Tornar o sistema competitivo com Optibus e Goal.  
> **Atualizado em**: 2026-04-12 (sessão 5 — continuação 2)
> **Status geral**: 🟢 Fase 1 COMPLETA — 17/17. Fase 2 COMPLETA — 9/10 (F-as parcial). Fase 3 COMPLETA — 8/8.

---

## FASE 1 — CRITICAL FIXES (Segurança + Algoritmos)

### 1.1 Optimizer — Correções Algorítmicas Críticas

| #   | ID    | Descrição                                              | Status       | Testado |
| --- | ----- | ------------------------------------------------------ | ------------ | ------- |
| 1   | O-C4  | GA: double fitness eval (scores já computado)          | ✅ Concluído | ✅      |
| 2   | O-C3  | block_is_feasible: min_gap=8 hardcoded                 | ✅ Concluído | ✅      |
| 3   | O-C2  | MCNF: custos negativos na C-Matrix (paired_trip_bonus) | ✅ Concluído | ✅      |
| 4   | O-C1  | Overtime: spread_time vs work_time inconsistência      | ✅ Concluído | ✅      |
| 5   | O-C5  | JointSolver: sem feedback VSP←CSP real                 | ✅ Concluído | ✅      |

### 1.2 Optimizer — Performance (HIGH)

| #   | ID   | Descrição                                           | Status       | Testado |
| --- | ---- | --------------------------------------------------- | ------------ | ------- |
| 6   | O-H1 | MCNF root detection O(N²) → O(N)                   | ✅ Concluído | ✅      |
| 7   | O-H2 | deepcopy excessivo em SA/TS/GA → shallow+undo       | ✅ Concluído | ✅      |
| 8   | O-H5 | quick_cost_sorted re-ordena trips já ordenadas      | ✅ Concluído | ✅      |
| 9   | O-H3 | _try_merge_vsp_blocks O(B³) → O(B²)                | ✅ Concluído | ✅      |
| 10  | O-H6 | Greedy VSP ranking_key mistura escalas              | ✅ Concluído | ✅      |

### 1.3 Backend — Segurança Crítica

| #   | ID   | Descrição                                           | Status       | Testado |
| --- | ---- | --------------------------------------------------- | ------------ | ------- |
| 11  | B-C1 | JWT secret: remover fallback hardcoded              | ✅ Concluído | ✅      |
| 12  | B-H1 | Instalar Helmet (security headers)                  | ✅ Concluído | ✅      |
| 13  | B-H5 | Dockerfile: não rodar como root                     | ✅ Concluído | ✅      |
| 14  | B-H10| Swagger: esconder em produção                       | ✅ Concluído | ✅      |
| 15  | B-H9 | Remover debug dump fs.writeFileSync /tmp            | ✅ N/A       | ✅      |

### 1.4 Frontend — Estabilidade Crítica

| #   | ID   | Descrição                                           | Status       | Testado |
| --- | ---- | --------------------------------------------------- | ------------ | ------- |
| 16  | F-C2 | Error Boundaries no layout                          | ✅ Concluído | ✅      |
| 17  | F-H9 | Debounce nos campos de filtro                       | ✅ Concluído | ✅      |

---

## FASE 2 — ARCHITECTURE & QUALITY

### 2.1 Optimizer — Qualidade Algorítmica

| #   | ID   | Descrição                                           | Status       | Testado |
| --- | ---- | --------------------------------------------------- | ------------ | ------- |
| 18  | O-H7 | EV fragmentation: meta não propagada                | ✅ Concluído | ✅      |
| 19  | O-H8 | GA _repair_chromosome: insert por timing            | ✅ Concluído | ✅      |
| 20  | O-M8 | SP Optimized: cache key ignora duty state           | ✅ Concluído | ✅      |
| 21  | O-H4 | Tabu Search: move type ambíguo para merge           | ✅ Concluído | ✅      |

### 2.2 Backend — Arquitetura

| #   | ID   | Descrição                                           | Status       | Testado |
| --- | ---- | --------------------------------------------------- | ------------ | ------- |
| 22  | B-H4 | updateStatus: validar enum                          | ✅ Concluído | ✅      |
| 23  | B-H6 | DTO ValidateNested para vspParams/cspParams         | ✅ Concluído | ✅      |
| 24  | B-H8 | LineEntity.code compound unique (code+companyId)    | ✅ Concluído | ✅      |
| 25  | B-M3 | N+1 queries → batch WHERE IN                       | ✅ Concluído | ✅      |

### 2.3 Frontend — Qualidade

| #   | ID   | Descrição                                           | Status       | Testado |
| --- | ---- | --------------------------------------------------- | ------------ | ------- |
| 26  | F-any| catch (e: any) → catch (e: unknown) (23 locais)    | ✅ Concluído | ✅      |
| 27  | F-as | Eliminar (as any) casts (~21 ocorrências)           | ⏸️ Parcial  | ✅      |

---

## FASE 3 — UI/UX INDUSTRIAL GRADE (futuro)

| #   | Descrição                                               | Status       |
| --- | ------------------------------------------------------- | ------------ |
| 28  | Decompor optimization/page.tsx (2155→291 linhas)        | ✅ Feito     |
| 29  | Decompor OptimizationSettingsEditor (1058→314 linhas)   | ✅ Feito     |
| 30  | Gantt: virtualização com react-window                   | ✅ Feito     |
| 31  | Gantt: redesign ciclos agrupados + cores por linha      | ✅ Feito     |
| 32  | TanStack Query para cache/deduplicação API              | ✅ Feito     |
| 33  | Design tokens centralizados                             | ✅ Feito     |
| 34  | RBAC completo (RolesGuard + @Roles)                     | ✅ Feito     |
| 35  | Company scoping em TODOS os controllers (IDOR fix)      | ✅ Feito     |

---

## LOG DE EXECUÇÃO

### 2026-04-12 — Sessão 5 (continuação)

**Optimizer Critical (4/4 done)**:
- ✅ O-C4: GA `scores` computado 1x antes do loop, reutilizado entre iterações
- ✅ O-C3: `min_gap` extraído de `vsp_params["min_layover_minutes"]` e propagado por SA/TS/GA/utils
- ✅ O-C2: `C[i,j] = max(0.0, cost)` — clip negative costs no MCNF
- ✅ O-C1: `_can_extend()` agora usa `new_spread` (não `new_work`) para overtime — consistente com `finalize_selected_duties`

**Optimizer Performance HIGH (5/5 done)**:
- ✅ O-H1: MCNF root detection `targets = set()` — O(N²) → O(N)
- ✅ O-H5: `quick_cost_sorted` removido `sorted()` redundante
- ✅ O-H2: `deepcopy` eliminado em SA/TS/GA — substituído por `_copy_blocks()` (shallow) e `_copy_chrom()`. Import `deepcopy` removido de SA/TS/utils
- ✅ O-H3: `_try_merge_vsp_blocks` — loop interno O(B²) adjacente em vez de O(B³) todos-pares. Também eliminado `deepcopy(vsp_sol.blocks)` por shallow copy
- ✅ O-H6: `ranking_key` agora usa `marginal_cost` (custo unificado) em vez de `gap*100 + pairing*0.01` (escalas misturadas)

**Optimizer Critical Algorithmic (5/5 done)**:
- ✅ O-C5: JointSolver `_csp_feedback_candidates()` — round de feedback CSP→VSP que identifica blocos com violações e tenta split para eliminar overtime/rest violations

**Backend Security (4/4 done + 1 N/A)**:
- ✅ B-C1: JWT fallback removido, throw em production se JWT_SECRET ausente
- ✅ B-H1: Helmet instalado e `app.use(helmet())` adicionado em main.ts
- ✅ B-H5: Dockerfile com `USER nodejs` (non-root)
- ✅ B-H10: Swagger condicional `if (nodeEnv !== 'production')`
- ✅ B-H9: Auditado — sem debug dumps encontrados (N/A)

**Frontend Stability (2/2 done)**:
- ✅ F-C2: Error Boundaries criados: `app/error.tsx` + `otimiz/error.tsx`
- ✅ F-H9: `useDebounce(value, 300)` hook + aplicado em 5 páginas (terminals, companies, users, dashboard, optimization)

**Verificações**:
- `tsc --noEmit` backend: 0 erros
- `tsc --noEmit` frontend: 0 erros
- pytest tests/unit: **192 passed** (O-H2/H3/H6/C5 todos validados) ✅
- Teste integração fretamento: 1 falha pré-existente (não relacionada)

### 2026-04-12 — Sessão Continuação 2 (Fase 1 completa + Fase 2)
- ✅ O-H2: deepcopy → shallow copy em SA/TS/GA (192 passed)
- ✅ O-H3: _try_merge adjacente O(B²) + shallow copy (192 passed)
- ✅ O-H6: ranking_key = marginal_cost (192 passed)
- ✅ O-C5: CSP feedback round no JointSolver (192 passed)
- **Fase 1 completa: 17/17**

**Fase 2 — Optimizer Quality**:
- ✅ O-H7: EV meta propagada: `_copy_blocks` usa `dict(b.meta)`, `_split` copia meta, CSP feedback split usa `dict(b.meta)`, greedy relocate atualiza `energy_kwh`/`soc_kwh`
- ✅ O-H8: GA `_repair_chromosome` insere trips ausentes no bloco com gap temporal mais próximo (em vez de menor bloco)
- ✅ O-M8: SP cache key expandida: `(last_id, block_id, spread_time, work_time, continuous_drive)` evita stale results
- ✅ O-H4: TS merge move usa sentinel `(-1, j_id, i_id, -1)` para distinguir de reloc

**Fase 2 — Backend Architecture**:
- ✅ B-H4: `ParseEnumPipe(VehicleRouteStatus)` / `ParseEnumPipe(ShiftStatus)` nos controllers
- ✅ B-H6: `VspParamsDto` + `CspParamsDto` com `@ValidateNested()` + `@Type()` em RunOptimizationDto
- ✅ B-H8: `@Unique(['code', 'companyId'])` em LineEntity
- ✅ B-M3: Batch queries com `WHERE id = ANY($1)` em schedule-groups service (3N→3 queries)

**Fase 2 — Frontend Quality**:
- ✅ F-any: 23 `catch (e: any)` → `catch (e: unknown)` + `getErrorMessage()` helper
- ⏸️ F-as: 21 `as any` restantes — maioria em testes e boundaries de API, requer interfaces tipadas

**Verificações**:
- pytest tests/unit: **192 passed** ✅
- `tsc --noEmit` backend: 0 erros ✅
- `tsc --noEmit` frontend: 0 erros ✅

### 2026-04-12 — Sessão Continuação 4 (Fase 3 — #32)

**#32 — TanStack Query para cache/deduplicação API**:
- ✅ Instalado `@tanstack/react-query` (v5)
- ✅ Criado `lib/query-provider.tsx` — QueryClient singleton (staleTime 30s, gcTime 5min, retry 1)
- ✅ Integrado `<QueryProvider>` em `store/providers.tsx`
- ✅ Criado `lib/query-hooks.ts` — 15 hooks (useLines, useTerminals, useTrips, useCompanies, useVehicleTypes, useUsers, useOptimizationSettings, useActiveSettings, useOptimizationRuns, usePassengerConfigs, useTripTimeConfigs, useScheduleGroups, useSchedules, useTimetables) + `queryKeys` + `useInvalidate`
- ✅ `useActiveSettings(companyId?)` com `enabled: companyId != null`
- ✅ `useOptimizationRuns` com `refetchInterval` opcional
- ✅ Migração referência: `optimization/page.tsx` — removido `useEffect/useCallback/useRef` polling manual → TanStack Query hooks (loadAll → invalidate, setInterval → refetchInterval)

**Verificações**:
- `tsc --noEmit` frontend: 0 erros ✅
- Todas 10 páginas HTTP 200 ✅

### 2026-04-12 — Sessão Continuação 5 (Fase 3 — #33)

**#33 — Design tokens centralizados**:
- ✅ Criado `_tokens/design-tokens.ts` — tokens: `thSx`, `tdCompactSx`, `kpiCardSx`, `dialogTitleSx`, `getLinePalette(theme)`, `getGanttColors(theme)`
- ✅ `shared.tsx` agora re-exporta `thSx/tdCompactSx/kpiCardSx` do arquivo centralizado
- ✅ `TabGantt.tsx` — `LINE_PALETTE` e `ganttColors` agora usam `getLinePalette()` e `getGanttColors()` do token central
- ✅ `dialogTitleSx` aplicado em 9 ocorrências: timetables, trip-times, lines, companies, trips, schedule-groups, passengers

**Verificações**:
- `tsc --noEmit` frontend: 0 erros ✅
- `tsc --noEmit` backend: 0 erros ✅
- pytest tests/unit: **192 passed** (360.26s) ✅
- Todas 10 páginas HTTP 200 ✅

**🎉 Fase 3 COMPLETA — 8/8**

### 2026-04-12 — Sessão Continuação 6 (Auditoria OR / zero-falhas)

**Correções matemáticas e regulatórias no optimizer**:
- ✅ Drift de arredondamento: `evaluator.py` agora preserva precisão crua nos acumuladores e arredonda apenas na borda de saída (`_R`)
- ✅ Hora extra corrigida: CSP agora calcula overtime por `work_time` em vez de `spread_time` em `_can_extend`, merges e `finalize_selected_duties`
- ✅ Penalidade de intervalo não remunerado: trocada de quadrática para linear por faixas (1x / 3x / 10x)
- ✅ Split de energia em mid-trip relief: suporte opcional a `mid_trip_relief_distance_ratio` e `mid_trip_relief_elevation_ratio` propagado por `Trip`, schema e conversores
- ✅ `greedy.py` usa razão física quando disponível; fallback antigo continua seguro para payloads legados

**Testes adicionados/atualizados**:
- ✅ Precisão: custo agregado de 2 deveres com frações agora fecha em `16.67` (sem drift por arredondamento intermediário)
- ✅ Overtime: teste corrigido para validar `work_time` (4 min) em vez de amplitude (80 min)
- ✅ Penalidade piecewise: excesso de 90 min gera `10.5` em vez de explosão quadrática
- ✅ Relief split: energia usa ratio físico informado e schema valida `mid_trip_relief_distance_ratio`
- ✅ Cenário de relief opcional atualizado para checar que não aumenta crew/duties

**Verificações**:
- pytest unit subset: **74 passed** ✅
- pytest tests/unit completo: **196 passed** (362.67s) ✅
- `tsc --noEmit` frontend: 0 erros ✅
- `tsc --noEmit` backend: 0 erros ✅
- Todas 10 páginas HTTP 200 ✅

### 2026-04-12 — Sessão Inicial
- Criado arquivo de rastreamento
- Iniciando Fase 1: Optimizer Critical Fixes
