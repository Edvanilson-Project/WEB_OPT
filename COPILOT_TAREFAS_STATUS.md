# Copilot - Tarefas em Andamento

Data: 2026-04-12
Branch: feat/extreme-optimizer-refactor

## Ja feito
- Branch de trabalho criada para refatoracoes avancadas.
- Base do Gantt ja estava com virtualizacao e agrupamento inicial de ciclos.
- Refatoracao visual enterprise do Gantt concluida:
  - ciclo ida/volta consolidado em faixa continua,
  - tempo improdutivo com hachura/transparencia,
  - painel lateral (Drawer) para detalhes nao criticos,
  - legenda de linhas recolhivel para reduzir ruido.
- Refino da tela principal de visualizacao concluido:
  - mais whitespace,
  - cabecalho/tabulacao mais limpa,
  - texto orientado a decisao operacional.
- Validacao de build do frontend concluida com sucesso (Next.js build OK).
- Refinamento de densidade informacional concluido em Escalas e Veiculos.
- Suite de testes de interacao do Gantt adicionada e validada (3 testes passando).
- **Suite de stress tests criada e validada (8/8 passing)**:
  - Renderizacao de 20, 50, 100+ e 200 linhas sem degradacao.
  - Expansao/recolhimento seletivo de blocos sob stress.
  - Performance metrics validadas.
- **Indicadores de conflitos operacionais implementados**:
  - Deteccao de: sobrepostura de viagens, gaps irrealisticos, violacao de pausas, falta de retorno.
  - Componente visual com badges de erro/aviso no cabecalho do Gantt.
  - 8 testes unitarios de deteccao de conflitos (8/8 passing).
  - Integrado no TabGantt.tsx sem poluir o grid.
- **Refinamentos tipograficos enterprise completados**:
  - Escalas centralizadas em typography-scales.ts
  - Labels com melhor hierarchia visual (sectionLabel, sectionSubtitle, metadata, etc.)
  - Aplicado a titles, timestamps, contadores do Gantt.
- **Modal expandido de conflitos com rastreabilidade**:
  - Visualizacao detalhada de conflitos operacionais
  - Filtro por tipo de conflito
  - Tabela com blocos afetados, severidade, mensagens
  - Recomendacoes de acao para o operador
  - Clicavel no indicador para abrir modal

## Fazendo agora
- Finalizacao da iteracao atual.

## Proximo
- Performance profiling em cenarios extremos (500+ blocos)
- Integracao com export de relatorio de conflitos (PDF/CSV)
- Dashboard resumitivo de KPIs com visualizacoes historicas
- **Export de conflitos operacionais implementado** (13/13 testes passing):
  - CSV com headers e dados estruturados
  - JSON com metadata completo (stats, timestamps, agregações)
  - HTML com relatório formatado e gráfico visual
  - TSV para compatibilidade com planilhas
  - Menu de dropdown no modal para download
  - Nomes de arquivo com timestamp (YYYY-MM-DD)
- **Performance profiler para cenários extremos** (15/15 testes passing):
  - Profiling de render time para 50, 100, 250, 500, 1000 blocos
  - Medição de interactionLatency (expand/collapse)
  - Validação contra thresholds customizáveis
  - Geração de relatório legível em texto
  - Suporta até 1000 blocos sem crash
  - Análise de escalabilidade (O(n) vs O(n²))
- **Dashboard resumitivo de KPIs com visualizações históricas concluído**:
  - Dashboard agora consome histórico normalizado em vez de depender de aliases inconsistentes do backend.
  - KPIs históricos com tendências por janela (7d/30d/90d): sucesso, custo médio, tempo médio e execuções limpas.
  - Snapshot da última otimização com sinais operacionais do período (CCT médio, alertas soft, aderência de grupos).
  - Série histórica consolidada de veículos, tripulação e custo + mix de algoritmos no dashboard.
- **Tela de relatórios alinhada ao contrato real do backend**:
  - Histórico de relatórios passou a usar a mesma normalização compartilhada do dashboard.
  - Correção de incompatibilidade entre campos `createdAt`/`totalVehicles`/`totalCost` do backend e o tipo antigo de `HistoryPoint` no frontend.
  - Suite nova de helpers adicionada com 4 testes unitários cobrindo normalização e tendências.
- **Sync ao vivo integrado via API existente + cache TanStack Query**:
  - Camada compartilhada de live sync criada sobre a listagem de runs, com polling adaptativo: 5s quando há execução ativa e 30s em modo passivo.
  - Dashboard e relatórios migrados de fetch manual para queries cacheadas com invalidação automática quando a lista de runs muda.
  - Cockpit e notificações passaram a reutilizar a mesma fonte de verdade para status ativo/pendente e refresh.
  - Estado `pending` agora aparece explicitamente no cockpit enquanto a execução aguarda slot do motor.
  - Validação concluída com testes do helper histórico (4/4) e build de produção do frontend OK.
- **Cache/refetch OTIMIZ otimizado para volume alto**:
  - Dashboard e relatórios deixaram de fazer polling pesado em paralelo; agora dependem da invalidação disparada pela lista de runs.
  - Queries de dashboard, KPIs e histórico ganharam `staleTime`/`gcTime` dedicados para reaproveitar melhor cache entre navegação e troca de período.
  - Histórico e resumos usam `placeholderData` para preservar o snapshot anterior durante transições e reduzir flicker em recargas.
  - Build de produção validado após a redução de fetch redundante.
- **Comparativos históricos aprofundados entregues na tela de relatórios**:
  - Benchmark por algoritmo adicionado com score operacional, custo médio, taxa de sucesso, limpeza operacional e CCT médio por janela.
  - Bloco de líderes do período destaca melhor score, menor custo médio, menor duração média e maior aderência de grupos.
  - Duelo entre duas execuções concluídas integrado na tela de relatórios usando o endpoint de comparação já existente.
  - Comparação agora mostra headline do backend, deltas de métricas principais, integridade de replay e timings por fase.
  - Helper histórico ganhou benchmark por algoritmo com teste unitário adicional (5/5) e build do frontend validado.
- **Auditoria de custo/qualidade por algoritmo com baseline operacional entregue**:
  - Relatórios agora expõem o baseline operacional do período selecionado com sucesso, custo, duração e qualidade média das execuções concluídas.
  - Nova tabela de auditoria mostra por algoritmo os desvios contra o baseline em score operacional, custo, tempo, sucesso, execuções limpas, CCT e aderência de grupos.
  - Algoritmos passam a ser classificados como acima do baseline, monitorar ou abaixo do baseline com heurística explícita baseada em score e penalidades.
  - Helper histórico ganhou baseline operacional + auditoria por algoritmo, com suite atualizada para 6/6 testes passando.
  - Build de produção do frontend validado após a nova seção analítica na tela de relatórios.
- **Persistência explícita e visualização de Profile Id/Name concluída**:
  - Colunas `profileId` (indexado) e `profileName` adicionadas à tabela e entidade `OptimizationRun`.
  - Service injeta ativamente os nomes de perfil durante inicialização (`PENDING`) e execução.
  - Helper do frontend com fallback legado normaliza IDs/Nomes sem crashes para dados antigos.
  - Filtros ativos e botão "Limpar filtros" injetados via chips visuais na tela de relatórios.
  - Relatório QA visual validado (via render response).
- **Avanço para Infraestrutura de Produção e Limpeza Técnica Concluídos**:
  - Limpeza profunda de mais de 50+ scripts de debug perdidos na raiz e pastas internas do `optimizer`.
  - Configuração de deployment unificada via `docker-compose.yml` (Postgres, Redis, Optimizer, Backend e Frontend).
  - Proxy reverso NGINX configurado (`nginx.conf`) para envelopar todo o stack simulando ambiente de produção.
  - Implementação tática de endpoints de monitoramento de integridade`/health` estendida ao Backend NestJS (`AppController`) e no ambiente Next.js Frontend (`app/api/health/route.ts`).

## Fazendo agora
- Revisão das execuções e lógica focada em melhorias do Algoritmo Genético do otimizador e logging avançado.

## Proximo
- Otimizar o Genetic Algorithm e integrar logs de monitoramento no optimizer.
