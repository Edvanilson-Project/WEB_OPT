import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function resolveScopedCompanyId(
  userCompanyId?: number,
  requestedCompanyId?: string | number | null,
): number {
  if (userCompanyId == null) {
    throw new ForbiddenException('Usuário sem escopo de empresa.');
  }

  if (requestedCompanyId == null || requestedCompanyId === '') {
    return Number(userCompanyId);
  }

  const parsedCompanyId = Number(requestedCompanyId);
  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId <= 0) {
    throw new BadRequestException('companyId inválido.');
  }

  if (parsedCompanyId !== Number(userCompanyId)) {
    throw new ForbiddenException('Acesso negado à empresa solicitada.');
  }

  return parsedCompanyId;
}
