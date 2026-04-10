import { ForbiddenException } from '@nestjs/common';
import { OptimizationController } from './optimization.controller';

describe('OptimizationController company scoping', () => {
  const service = {
    startOptimization: jest.fn(),
    findAll: jest.fn(),
    getDashboardStats: jest.fn(),
    getRunAudit: jest.fn(),
    compareRuns: jest.fn(),
    findOne: jest.fn(),
    cancel: jest.fn(),
  };

  const controller = new OptimizationController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injeta o companyId do usuario ao iniciar a execucao', () => {
    const dto: any = { lineId: 16 };
    const req = { user: { id: 99, companyId: 7 } };

    controller.run(dto, req);

    expect(dto.companyId).toBe(7);
    expect(service.startOptimization).toHaveBeenCalledWith(dto, 99);
  });

  it('bloqueia listagem com companyId diferente do escopo do usuario', () => {
    expect(() => controller.findAll({ user: { companyId: 7 } }, '9')).toThrow(
      ForbiddenException,
    );
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('propaga o escopo do usuario para audit, compare, detail e cancel', () => {
    const req = { user: { companyId: 7 } };

    controller.audit(11, req);
    controller.compare(11, 12, req);
    controller.findOne(11, req);
    controller.cancel(11, req);

    expect(service.getRunAudit).toHaveBeenCalledWith(11, 7);
    expect(service.compareRuns).toHaveBeenCalledWith(11, 12, 7);
    expect(service.findOne).toHaveBeenCalledWith(11, 7);
    expect(service.cancel).toHaveBeenCalledWith(11, 7);
  });
});
