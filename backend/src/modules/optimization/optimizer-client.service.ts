import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Exceção customizada para erros originados no motor de otimização Python.
 */
export class OptimizerException extends HttpException {
  constructor(message: string, status: HttpStatus, data?: any) {
    super(
      {
        message: `Optimizer Error: ${message}`,
        status,
        data,
      },
      status,
    );
  }
}

/**
 * OptimizerClientService (SRP: Responsável exclusivo pela comunicação segura com o Microserviço Python).
 * Implementa a ponte de segurança (X-Internal-Key) e rastreabilidade (X-Correlation-ID).
 */
@Injectable()
export class OptimizerClientService {
  private readonly logger = new Logger(OptimizerClientService.name);
  private readonly optimizerUrl: string;
  private readonly internalKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.optimizerUrl = this.configService.get<string>('OPTIMIZER_URL');
    this.internalKey = this.configService.get<string>('INTERNAL_OPTIMIZER_KEY');
  }

  /**
   * Executa uma requisição POST segura para o Optimizer.
   * 
   * @param endpoint Caminho relativo (ex: /optimize/run)
   * @param data Payload do pedido
   * @returns Resposta do solver
   */
  async post<T>(endpoint: string, data: any): Promise<T> {
    const correlationId = uuidv4();
    const url = `${this.optimizerUrl}${endpoint}`;

    const config: AxiosRequestConfig = {
      headers: {
        'X-Internal-Key': this.internalKey,
        'X-Correlation-ID': correlationId,
        'Content-Type': 'application/json',
      },
    };

    this.logger.log(`[${correlationId}] Enviando request para ${endpoint}`);

    try {
      const response = await firstValueFrom(this.httpService.post<T>(url, data, config));
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError, correlationId, endpoint);
    }
  }

  /**
   * Executa uma requisição GET segura para o Optimizer.
   * 
   * @param endpoint Caminho relativo
   */
  async get<T>(endpoint: string): Promise<T> {
    const correlationId = uuidv4();
    const url = `${this.optimizerUrl}${endpoint}`;

    const config: AxiosRequestConfig = {
      headers: {
        'X-Internal-Key': this.internalKey,
        'X-Correlation-ID': correlationId,
      },
    };

    try {
      const response = await firstValueFrom(this.httpService.get<T>(url, config));
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError, correlationId, endpoint);
    }
  }

  /**
   * Mapeia erros de rede ou do solver para exceções claras no NestJS.
   */
  private handleError(error: AxiosError, correlationId: string, endpoint: string): never {
    const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const errorData = error.response?.data;
    
    this.logger.error(
      `[${correlationId}] Falha na comunicação com Optimizer (${endpoint}): ${error.message}`,
    );

    throw new OptimizerException(
      error.message || 'Erro desconhecido no Optimizer',
      status,
      errorData,
    );
  }
}
