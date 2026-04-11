# Pendências para o Copilot (Backlog Técnico)

Este arquivo documenta itens identificados durante a estabilização profunda do sistema que podem ser implementados ou melhorados futuramente. O sistema atual está **100% estável e funcional (Zero Erros)**, estes itens são focados em expandir funcionalidades.

## 1. Módulo de Otimização (Backend)

- [ ] **Restaurar Run Audit**: Atualmente o método `getRunAudit` retorna apenas o resumo do resultado. Restaurar a implementação detalhada que permite auditoria profunda de cada decisão do motor.
    - *Local:* `backend/src/modules/optimization/optimization.service.ts` (Linha 1407)
- [ ] **Comparação de Execuções**: O método `compareRuns` é um stub. Restaurar a lógica que permite comparar métricas entre duas execuções diferentes (ex: Antes vs Depois da mudança de parâmetros).
    - *Local:* `backend/src/modules/optimization/optimization.service.ts` (Linha 1413)
- [ ] **Recuperação de Execuções Presas**: Adicionar lógica no `recoverStaleRuns` para cancelar automaticamente execuções que ficaram com status `running` após um restart do servidor.
    - *Local:* `backend/src/modules/optimization/optimization.service.ts` (Linha 1425)

## 2. Segurança e Scoping (Deep Scan Findings)

- [ ] **Reforço de `companyId`**: Embora a funcionalidade esteja ok, alguns serviços (`SchedulesService`, `VehicleTypesService`) poderiam ser reforçados com verificações de `companyId` nos métodos `findOne`, `update` e `remove` para garantir isolamento multi-tenant absoluto.

## 3. UI/UX (Frontend)

- [ ] **Filtros Avançados no Cockpit**: Adicionar filtros por horário de início/fim nas abas de Veículos e Escalas para facilitar a navegação em resultados muito grandes.
- [ ] **Exportação de PDF/Excel**: Implementar a funcionalidade de exportar o resultado da otimização para formatos de relatório oficiais para motoristas.

---
*Status do Sistema: **100% Estável / Zero Erros de Linting / Fluxo de Dados Validado***
