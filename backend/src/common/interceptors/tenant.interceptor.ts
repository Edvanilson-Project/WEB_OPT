import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../context/tenant.context';

/**
 * TenantInterceptor (Padrão: Context Initializer).
 * 
 * Este interceptor captura os dados do usuário autenticado (injetados pelo JwtAuthGuard)
 * e inicializa o AsyncLocalStorage do TenantContext.
 * 
 * SRP: Garantir que o isolamento de dados esteja disponível para toda a árvore de execução 
 * subsequente (Repositories, Services, etc).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Se não houver usuário (ex: rotas @Public), permitimos passar, 
    // mas o context permanecerá nulo.
    if (!user) {
      return next.handle();
    }

    if (!user.companyId) {
      throw new UnauthorizedException('Usuário sem empresa vinculada.');
    }

    // Inicializa o contexto do ALS
    return new Observable((subscriber) => {
      TenantContext.run(
        {
          tenant: {
            companyId: user.companyId,
            companyName: user.companyName || 'Empresa Geral',
          },
        },
        () => {
          next.handle().subscribe({
            next: (data) => subscriber.next(data),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        },
      );
    });
  }
}
