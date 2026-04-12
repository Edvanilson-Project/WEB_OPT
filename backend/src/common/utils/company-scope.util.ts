import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function resolveScopedCompanyId(
  userCompanyId?: number,
  requestedCompanyId?: string | number | null,
  userRole?: string,
): number {
  const isSuperAdmin = userRole === 'super_admin';

  if (requestedCompanyId != null && requestedCompanyId !== '') {
    const parsedCompanyId = Number(requestedCompanyId);
    if (!Number.isInteger(parsedCompanyId) || parsedCompanyId <= 0) {
      throw new BadRequestException('companyId inválido.');
    }
    if (!isSuperAdmin && parsedCompanyId !== Number(userCompanyId)) {
      throw new ForbiddenException('Acesso negado à empresa solicitada.');
    }
    return parsedCompanyId;
  }

  if (userCompanyId == null) {
    if (isSuperAdmin) {
      throw new BadRequestException(
        'SUPER_ADMIN deve informar companyId na requisição.',
      );
    }
    throw new ForbiddenException('Usuário sem escopo de empresa.');
  }

  return Number(userCompanyId);
}
