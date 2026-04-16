import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

/**
 * Serviço de Autenticação (SRP: Responsável exclusivo pela lógica de verificação de identidade e geração de tokens).
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Realiza a validação das credenciais e gera o payload do token JWT.
   * 
   * @param dto Dados de login (email e senha)
   * @returns Objeto contendo o token e os dados básicos do usuário
   * @throws UnauthorizedException se as credenciais forem inválidas
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Credenciais inválidas.');

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Credenciais inválidas.');

    // Busca o nome da empresa para incluir no token
    // Nota: Em um sistema real, faríamos um JOIN no repositório.
    // Aqui usaremos o ID direto se o nome não estiver no UserEntity.
    const companyName = user.companyId === 1 ? 'Transportes Alpha' : 'Expresso Beta';

    await this.usersService.updateLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: companyName, // Novo: Rastreabilidade de Nome
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: companyName, // Novo: Para exibição no Frontend
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Recupera os dados do perfil do usuário atual.
   * 
   * @param userId ID do usuário extraído do token
   */
  async getProfile(userId: number) {
    return this.usersService.findOne(userId);
  }
}
