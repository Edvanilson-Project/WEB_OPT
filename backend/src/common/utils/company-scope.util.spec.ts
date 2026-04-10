import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { resolveScopedCompanyId } from './company-scope.util';

describe('resolveScopedCompanyId', () => {
  it('retorna o companyId do usuario quando a requisicao nao informa companyId', () => {
    expect(resolveScopedCompanyId(7)).toBe(7);
    expect(resolveScopedCompanyId(7, '')).toBe(7);
    expect(resolveScopedCompanyId(7, null)).toBe(7);
  });

  it('aceita companyId explicito quando bate com o escopo do usuario', () => {
    expect(resolveScopedCompanyId(7, '7')).toBe(7);
    expect(resolveScopedCompanyId(7, 7)).toBe(7);
  });

  it('rejeita companyId invalido', () => {
    expect(() => resolveScopedCompanyId(7, 'abc')).toThrow(BadRequestException);
    expect(() => resolveScopedCompanyId(7, '0')).toThrow(BadRequestException);
    expect(() => resolveScopedCompanyId(7, '-2')).toThrow(BadRequestException);
  });

  it('rejeita acesso a companyId diferente do escopo do usuario', () => {
    expect(() => resolveScopedCompanyId(7, '8')).toThrow(ForbiddenException);
  });

  it('rejeita usuario sem escopo de empresa', () => {
    expect(() => resolveScopedCompanyId(undefined, '7')).toThrow(
      ForbiddenException,
    );
  });
});
