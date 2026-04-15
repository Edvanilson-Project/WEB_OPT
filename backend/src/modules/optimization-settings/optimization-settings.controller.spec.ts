import { ForbiddenException } from '@nestjs/common';
import { OptimizationSettingsController } from './optimization-settings.controller';

describe('OptimizationSettingsController company scoping', () => {
  const service = {
    findAll: jest.fn(),
    findActive: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    remove: jest.fn(),
  };

  const controller = new OptimizationSettingsController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa o companyId do usuario quando a query nao informa companyId', () => {
    controller.findAll({ user: { id: 1, email: 't@t.com', role: 'analyst', companyId: 5 } });
    controller.findActive({ user: { id: 1, email: 't@t.com', role: 'analyst', companyId: 5 } });
    controller.findOne(10, { user: { id: 1, email: 't@t.com', role: 'analyst', companyId: 5 } });

    expect(service.findAll).toHaveBeenCalledWith(5);
    expect(service.findActive).toHaveBeenCalledWith(5);
    expect(service.findOne).toHaveBeenCalledWith(10, 5);
  });

  it('bloqueia create com companyId fora do escopo do usuario', () => {
    expect(() =>
      controller.create({} as any, { user: { id: 1, email: 't@t.com', role: 'analyst', companyId: 5 } }, '9'),
    ).toThrow(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('propaga o escopo validado em update, activate e remove', () => {
    const req = { user: { id: 1, email: 't@t.com', role: 'analyst', companyId: 5 } };
    const dto: any = { fairnessWeight: 0.2 };

    controller.update(10, dto, req, '5');
    controller.setActive(10, req, '5');
    controller.remove(10, req, '5');

    expect(service.update).toHaveBeenCalledWith(10, 5, dto, 'analyst');
    expect(service.setActive).toHaveBeenCalledWith(10, 5);
    expect(service.remove).toHaveBeenCalledWith(10, 5);
  });
});
