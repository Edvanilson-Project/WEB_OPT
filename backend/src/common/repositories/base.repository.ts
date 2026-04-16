import { Repository, SelectQueryBuilder, FindManyOptions, FindOneOptions, UpdateResult, DeleteResult } from 'typeorm';
import { TenantContext } from '../context/tenant.context';

/**
 * BaseRepository (Padrão: Abstract Repository with Hidden Filter).
 * 
 * Esta classe abstrata fornece métodos utilitários que garantem que todas as operações
 * de banco de dados ocorram dentro do contexto do Tenant atual.
 * 
 * SRP: Centralizar a regra de isolamento de dados (Multi-Tenancy).
 */
export abstract class BaseRepository<T> {
  constructor(protected readonly repo: Repository<T>) {}

  /**
   * Obtém o ID da empresa do contexto atual.
   */
  protected get companyId(): number {
    return TenantContext.getCompanyId();
  }

  /**
   * Cria um QueryBuilder já pré-filtrado pela empresa do usuário.
   */
  protected createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    return this.repo.createQueryBuilder(alias)
      .where(`${alias}.companyId = :companyId`, { companyId: this.companyId });
  }

  /**
   * Busca registros garantindo o isolamento.
   */
  async findAll(options: FindManyOptions<T> = {}): Promise<T[]> {
    const tenantFilter = { companyId: this.companyId };
    
    // Se houver condicionais existentes, mescla.
    const where = options.where 
      ? Array.isArray(options.where) 
        ? options.where.map(w => ({ ...w, ...tenantFilter }))
        : { ...options.where as object, ...tenantFilter }
      : tenantFilter;

    return this.repo.find({ ...options, where } as FindManyOptions<T>);
  }

  /**
   * Conta os registros garantindo o isolamento.
   */
  async count(options: FindManyOptions<T> = {}): Promise<number> {
    const tenantFilter = { companyId: this.companyId };
    const where = options.where 
      ? Array.isArray(options.where) 
        ? options.where.map(w => ({ ...w, ...tenantFilter }))
        : { ...options.where as object, ...tenantFilter }
      : tenantFilter;

    return this.repo.count({ ...options, where } as FindManyOptions<T>);
  }

  /**
   * Busca um único registro garantindo o isolamento.
   */
  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    const where = { ...(options.where as object), companyId: this.companyId } as any;
    return this.repo.findOne({ ...options, where } as FindOneOptions<T>);
  }

  /**
   * Cria uma nova entidade já vinculada à empresa atual.
   */
  async create(data: Partial<T>): Promise<T> {
    const entity = this.repo.create({ ...data, companyId: this.companyId } as any);
    return this.repo.save(entity as any);
  }

  /**
   * Atualiza uma entidade garantindo que pertença à empresa.
   */
  async update(id: number | string, data: Partial<T>): Promise<UpdateResult> {
    return this.repo.update({ id, companyId: this.companyId } as any, data as any);
  }

  /**
   * Deleta uma entidade garantindo que pertença à empresa.
   */
  async delete(id: number | string): Promise<DeleteResult> {
    return this.repo.delete({ id, companyId: this.companyId } as any);
  }

  /**
   * Save genérico (usar com cautela para garantir que o objeto tenha companyId).
   */
  async save(entity: T): Promise<T> {
    (entity as any).companyId = this.companyId;
    return this.repo.save(entity);
  }
}
