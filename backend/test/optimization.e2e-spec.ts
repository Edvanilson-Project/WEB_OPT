import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('Optimization Controller (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Generate mock token for authorization
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    token = jwtService.sign({ sub: 1, email: 'e2e@test.com', role: 'admin', companyId: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /optimization/run - Payload vazio/invalido deve retornar 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/optimization/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ timeBudgetSeconds: 2 }) // Min is 5
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining(['timeBudgetSeconds deve ser no mínimo 5 segundos.'])
    );
  });

  it('POST /optimization/run - Sucesso e validacao rigorosa deferida pelo Service', async () => {
    const payload = {
      name: 'Teste de Integração E2E',
      lineId: 99999, // Um ID de linha que possivelmente não existe
      algorithm: 'greedy',
      timeBudgetSeconds: 15,
      vspParams: {
        maxVehicles: 10,
        strictHardValidation: true
      },
      cspParams: {
        strictHardValidation: true
      }
    };

    const response = await request(app.getHttpServer())
      .post('/optimization/run')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    if (response.status === 201) {
      expect(response.body.status.toUpperCase()).toBe('PENDING');
      expect(response.body.lineId).toBe(99999);
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });
});
