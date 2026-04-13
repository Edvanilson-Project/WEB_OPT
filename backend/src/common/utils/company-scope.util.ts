import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function resolveScopedCompanyId(
  userCompanyId?: number,
  requestedCompanyId?: string | number | null,
  userRole?: string,
): number {
  const isSuperAdmin = userRole === 'super_admin';

  if (requestedCompanyId != null && requestedCompanyId !== '') {
    const parsedCompanyId = Number(requestedCompanyId);
    if (!Number.isFinite(parsedCompanyId) || parsedCompanyId <= 0) {
      throw new BadRequestException('companyId inválido.');
    }
    
    const userCid = userCompanyId != null ? Number(userCompanyId) : null;
    
    // Security Guard: Non-SuperAdmins MUST strictly match their own companyId
    if (userRole !== 'super_admin') {
      if (userCid == null) {
        throw new ForbiddenException('Usuário sem empresa vinculada.');
      }
      if (parsedCompanyId !== userCid) {
        // We FORCE the user's company ID instead of just throwing, 
        // OR we throw to be safe. Throwing is more 'enterprise security'.
        throw new ForbiddenException(`Acesso negado: Empresa ${parsedCompanyId} não pertence ao seu escopo.`);
      }
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
