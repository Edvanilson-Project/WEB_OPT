import { ForbiddenException } from '@nestjs/common';
import { TripsController } from './trips.controller';

describe('TripsController company scoping', () => {
  const service = {
    create: jest.fn(),
    createBulk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const controller = new TripsController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preenche companyId do create com o escopo do usuario quando omitido', () => {
    const dto: any = { lineId: 16 };

    controller.create(dto, { user: { companyId: 3 } });

    expect(dto.companyId).toBe(3);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('bloqueia create quando o DTO informa outra empresa', () => {
    expect(() =>
      controller.create({ lineId: 16, companyId: 999 } as any, {
        user: { companyId: 3 },
      }),
    ).toThrow(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('normaliza createBulk para o escopo do usuario quando os DTOs nao informam companyId', () => {
    const dtos: any[] = [{ lineId: 16 }, { lineId: 16, companyId: undefined }];

    controller.createBulk(dtos, { user: { companyId: 3 } });

    expect(dtos.every((dto) => dto.companyId === 3)).toBe(true);
    expect(service.createBulk).toHaveBeenCalledWith(dtos);
  });

  it('bloqueia createBulk com DTOs de outra empresa', () => {
    const dtos: any[] = [
      { lineId: 16, companyId: 3 },
      { lineId: 16, companyId: 4 },
    ];

    expect(() =>
      controller.createBulk(dtos, { user: { companyId: 3 } }),
    ).toThrow(ForbiddenException);
    expect(service.createBulk).not.toHaveBeenCalled();
  });

  it('propaga escopo validado em list, detail, update e remove', () => {
    const req = { user: { companyId: 3 } };
    const dto: any = { durationMinutes: 55 };

    controller.findAll(req, '3', '16');
    controller.findOne(21, req);
    controller.update(21, dto, req);
    controller.remove(21, req);

    expect(service.findAll).toHaveBeenCalledWith(3, 16);
    expect(service.findOne).toHaveBeenCalledWith(21, 3);
    expect(service.update).toHaveBeenCalledWith(21, dto, 3);
    expect(service.remove).toHaveBeenCalledWith(21, 3);
  });
});
