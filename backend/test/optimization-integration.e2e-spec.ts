import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('Optimization Integration - Enterprise Hardening', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ 
      transform: true, 
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();

    const jwtService = moduleFixture.get<JwtService>(JwtService);
    // Use proper UserRole.COMPANY_ADMIN to test scoping
    token = jwtService.sign({ sub: 1, email: 'hardening@test.com', role: 'company_admin', companyId: 1 });
  });

  afterAll(async () => {
    // Give a small grace period for any pending async operations in NestJS
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.close();
  });

  describe('Strict Param Validation (DTO Hardening)', () => {
    it('should reject VSP restarts above 50 (Max constraint)', async () => {
      await request(app.getHttpServer())
        .post('/optimization/run')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vspParams: { restarts: 100 }
        })
        .expect(400);
    });

    it('should reject CSP maxWorkMinutes above 1440 (Total Day)', async () => {
      await request(app.getHttpServer())
        .post('/optimization/run')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cspParams: { maxWorkMinutes: 2000 }
        })
        .expect(400);
    });

    it('should reject timeBudgetSeconds below 5s (Min constraint)', async () => {
      const resp = await request(app.getHttpServer())
        .post('/optimization/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ timeBudgetSeconds: 4 })
        .expect(400);
      
      expect(resp.body.message).toContain('timeBudgetSeconds deve ser no mínimo 5 segundos.');
    });

    it('should accept valid premium parameters', async () => {
      const payload = {
        name: 'Enterprise Test Run',
        lineIds: [101, 102],
        operationMode: 'urban',
        vspParams: {
          restarts: 10,
          maxVehicles: 50,
          deadheadCostPerMinute: 5.5
        },
        cspParams: {
          maxWorkMinutes: 480,
          breakMinutes: 60,
          fairnessWeight: 0.5
        }
      };

      const response = await request(app.getHttpServer())
        .post('/optimization/run')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      // Successfully validated parameters
      expect(response.status).not.toBe(400);
    });
  });

  describe('Pipeline Integrity & Performance Protection', () => {
    it('should support multi-line optimization requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/optimization/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ lineIds: [1, 2, 3], name: 'Multi-line Test' });
      
      expect(response.status).not.toBe(400);
    });

    it('should enforce numeric constraints on optimization timers', async () => {
      // timeBudgetSeconds must be within [5, 3600]
      await request(app.getHttpServer())
        .post('/optimization/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ timeBudgetSeconds: 4000 })
        .expect(400);
    });
  });
});
