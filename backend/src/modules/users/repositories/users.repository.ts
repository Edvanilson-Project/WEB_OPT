import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { BaseRepository } from '../../../common/repositories/base.repository';

/**
 * Repositório de Usuários (Padrão Repository: Abstrai a persistência e isola o TypeORM do domínio).
 * Agora estende BaseRepository para garantir isolamento Multi-Tenant.
 */
@Injectable()
export class UsersRepository extends BaseRepository<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super(userRepo);
  }

  /**
   * Busca um usuário pelo e-mail dentro da empresa logada ou em escopo global se necessário.
   * Nota: Login geralmente é global para o Identity, mas aqui buscamos no tenant.
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    // Para login, poderíamos querer busca global, mas nos repositórios de negócio 
    // sempre filtramos pelo tenant atual definido no interceptor.
    return this.findOne({ where: { email } as any });
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.findOne({ where: { id } as any });
  }
}
