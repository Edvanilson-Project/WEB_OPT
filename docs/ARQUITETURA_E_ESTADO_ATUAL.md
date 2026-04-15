# 1. Visão Geral da Arquitetura
O sistema é dividido em três pilares que operam de forma orquestrada para prover a solução de otimização de escalas e frota:
1. **Frontend (Next.js)** e **Backend Principal (NestJS)** e **Motor (Python/FastAPI)**.

# 2. Modelagem de Dados e Banco de Dados (TypeORM / NestJS)
O banco de dados relacional gerencia o domínio de negócios. Entidades primárias incluem: Veículos, Viagens, Terminais e Otimizações.

# 3. Mapeamento do Backend (NestJS)
- **Controllers/Services Principais**: OptimizationController e OptimizationService.
- **Comunicação com Python**: Proxy REST via Axios.
- **Autenticação**: Guards do NestJS.

# 4. Mapeamento do Frontend (Next.js)
- Grafico de Gantt em React lidando com estados densos das Viagens e Blocos. Consome chamadas assíncronas para visualização do What-If (`/evaluate-delta`).

# 5. Contratos de Integração (NestJS <-> Python)
- **Payload Padrão**: Envia Trips, Vehicles e Configs.
- **Payload What-If**: `blocks`, `trip_id`, `source_block`, etc.

# 6. Mapeamento de Fragilidades, Bugs Ocultos e TODOs
- Estouro de memória em Python via MCNF particionado e contido por fallback e limite <= 1000 viagens.
- Falhas flutuantes com o BIG_M no CBC Solver amenizadas.
- O NestJS resolve as Zombie Runs por um script inicial de Clean Up em OnModuleInit.
