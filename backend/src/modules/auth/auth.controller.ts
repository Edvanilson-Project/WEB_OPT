import {
  Controller,
  Post,
  Body,
  Get,
  Request,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Controller de Autenticação (SRP: Responsável por gerenciar as rotas de acesso e retorno de cookies/token).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint de Login. Realiza o login e define o cookie HTTP-Only.
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário e obter JWT via Cookie' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);

    // Define o cookie seguro (HTTP-Only)
    response.cookie('otimiz_auth', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return {
      user: result.user,
      message: 'Login realizado com sucesso',
    };
  }

  /**
   * Retorna os dados do usuário autenticado.
   */
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }
}
