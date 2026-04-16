import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * Interface representativa do contexto do Tenant atual.
 */
export interface TenantData {
  companyId: number;
  companyName: string;
}

/**
 * TenantContext (Padrão: Context Holder via AsyncLocalStorage).
 * 
 * Permite que o ID da empresa e outras informações do tenant sejam acessíveis
 * em qualquer lugar da aplicação sem a necessidade de passar parâmetros manuais (Prop Drilling).
 */
@Injectable()
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantStore>();

  /**
   * Inicializa o contexto para a execução atual da requisição.
   */
  static run<T>(store: TenantStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  /**
   * Obtém os dados do Tenant da requisição atual.
   * 
   * @throws Error se o contexto não estiver inicializado.
   */
  static get(): TenantData {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error('TenantContext não inicializado. Verifique se o TenantInterceptor está ativo.');
    }
    return store.tenant;
  }

  /**
   * Atalho para obter apenas o companyId.
   */
  static getCompanyId(): number {
    return this.get().companyId;
  }

  /**
   * Atalho para obter apenas o companyName.
   */
  static getCompanyName(): string {
    return this.get().companyName;
  }
}

/**
 * Estrutura interna de armazenamento do ALS.
 */
interface TenantStore {
  tenant: TenantData;
}
