import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';
import { UsersRepository } from './repositories/users.repository';

/**
 * Serviço de Usuários (SRP: Responsável pela lógica de negócio, validações e orquestração de dados de usuários).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UsersRepository,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Cria um novo usuário no sistema com senha hasheada.
   * 
   * @param dto Dados de criação
   */
  async create(dto: CreateUserDto): Promise<UserEntity> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const exists = await this.userRepository.findByEmail(normalizedEmail);
    if (exists) {
      throw new ConflictException(`E-mail ${normalizedEmail} já está em uso.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.create({
      ...dto,
      email: normalizedEmail,
      passwordHash,
      status: UserStatus.ACTIVE,
    });
    return user;
  }

  /**
   * Retorna todos os usuários cadastrados.
   */
  async findAll(): Promise<UserEntity[]> {
    return this.userRepository.findAll();
  }

  /**
   * Busca um usuário pelo ID.
   * 
   * @param id ID do usuário
   * @throws EntityNotFoundException se não encontrado
   */
  async findOne(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new EntityNotFoundException('Usuário', id);
    return user;
  }

  /**
   * Busca um usuário pelo e-mail.
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(this.normalizeEmail(email));
  }

  /**
   * Atualiza dados de um usuário, incluindo re-hash de senha se necessário.
   */
  async update(id: number, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    if (dto.password) {
      (dto as any).passwordHash = await bcrypt.hash(dto.password, 10);
      delete dto.password;
    }
    if (dto.email) {
      dto.email = this.normalizeEmail(dto.email);
    }
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  /**
   * Remove um usuário do sistema.
   */
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id); // Valida se existe no tenant
    await this.userRepository.delete(id);
  }

  /**
   * Atualiza o timestamp do último login.
   */
  async updateLastLogin(id: number): Promise<void> {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }
}
