import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  Logger,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const corsOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',');

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Prefixo global da API
  app.setGlobalPrefix('api/v1');

  // Serialização — exclui campos @Exclude() como passwordHash
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('OTIMIZ API')
    .setDescription(
      'Sistema Profissional de Otimização de Transporte Público - CSP/VSP',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticação')
    .addTag('companies', 'Empresas')
    .addTag('lines', 'Linhas')
    .addTag('terminals', 'Terminais')
    .addTag('vehicles', 'Veículos')
    .addTag('trips', 'Viagens')
    .addTag('schedules', 'Expedições')
    .addTag('optimization', 'Motor de Otimização')
    .addTag('reports', 'Relatórios')
    .build();

  const nodeEnv = config.get<string>('app.nodeEnv', 'development');
  if (nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`📖 Swagger disponível em http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`🚀 OTIMIZ API rodando em http://localhost:${port}/api/v1`);
}

bootstrap();
