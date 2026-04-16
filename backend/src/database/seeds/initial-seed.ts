import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CompanyEntity, CompanyStatus } from '../../modules/companies/entities/company.entity';
import { UserEntity, UserRole, UserStatus } from '../../modules/users/entities/user.entity';
import { OperatorEntity } from '../../modules/rostering/entities/operator.entity';
import { TripEntity } from '../../modules/trips/entities/trip.entity';
import { LineEntity } from '../../modules/lines/entities/line.entity';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Script de Seeding Profissional (Stage 1.1).
 * 
 * Este script popula o banco com duas empresas (Alpha e Beta) e dados isolados
 * para validar a arquitetura Multi-Tenant e o BaseRepository.
 */
async function run() {
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'otmiz_new',
    entities: [CompanyEntity, UserEntity, OperatorEntity, TripEntity, LineEntity],
    synchronize: true,
  });

  console.log('🌱 Inicializando Seeding Multi-Tenant...');
  await AppDataSource.initialize();

  // Limpeza de tabelas (Ordem importa devido a FKs)
  console.log('🧹 Limpando dados antigos...');
  await AppDataSource.query('TRUNCATE TABLE "trips", "operators", "users", "companies", "lines" RESTART IDENTITY CASCADE');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Criar Empresas
  const companyAlpha = await AppDataSource.manager.save(CompanyEntity, {
    name: 'Transportes Alpha',
    cnpj: '11.111.111/0001-11',
    status: CompanyStatus.ACTIVE,
  });

  const companyBeta = await AppDataSource.manager.save(CompanyEntity, {
    name: 'Expresso Beta',
    cnpj: '22.222.222/0001-22',
    status: CompanyStatus.ACTIVE,
  });

  console.log('✅ Empresas Alpha e Beta criadas.');

  // 2. Criar Usuários
  await AppDataSource.manager.save(UserEntity, {
    name: 'Admin Alpha',
    email: 'admin@alpha.com',
    passwordHash,
    role: UserRole.COMPANY_ADMIN,
    status: UserStatus.ACTIVE,
    companyId: companyAlpha.id,
  });

  await AppDataSource.manager.save(UserEntity, {
    name: 'Admin Beta',
    email: 'admin@beta.com',
    passwordHash,
    role: UserRole.COMPANY_ADMIN,
    status: UserStatus.ACTIVE,
    companyId: companyBeta.id,
  });

  console.log('✅ Usuários administradores criados.');

  // 2.1 Criar Linhas de Teste
  const lineAlpha = await AppDataSource.manager.save(LineEntity, {
    code: '101',
    name: 'Circular Alpha',
    companyId: companyAlpha.id,
    originTerminalId: 1,
    destinationTerminalId: 2,
  });

  const lineBeta = await AppDataSource.manager.save(LineEntity, {
    code: '202',
    name: 'Expresso Beta',
    companyId: companyBeta.id,
    originTerminalId: 3,
    destinationTerminalId: 4,
  });

  console.log('✅ Linhas semeadoras criadas.');

  // 3. Criar Motoristas (Operators)
  // Empresa Alpha: 5 motoristas (2 VIP)
  for (let i = 1; i <= 5; i++) {
    await AppDataSource.manager.save(OperatorEntity, {
      name: `Motorista Alpha ${i}`,
      registration: `REG-A-${100 + i}`,
      cp: `A${100 + i}`,
      companyId: companyAlpha.id,
      isActive: true,
      metadata: i <= 2 ? { tags: ['VIP'] } : {},
    });
  }

  // Empresa Beta: 3 motoristas
  for (let i = 1; i <= 3; i++) {
    await AppDataSource.manager.save(OperatorEntity, {
      name: `Motorista Beta ${i}`,
      registration: `REG-B-${100 + i}`,
      cp: `B${100 + i}`,
      companyId: companyBeta.id,
      isActive: true,
    });
  }

  console.log('✅ Motoristas semeados (Isolamento Alpha/Beta).');

  // 4. Criar Viagens (Trips) de Teste
  for (let i = 1; i <= 10; i++) {
    const start = 360 + i * 10; // 06:00 +
    const end = start + 30;     // 30 min trip
    await AppDataSource.manager.save(TripEntity, {
      lineId: 101,
      startTimeMinutes: start,
      endTimeMinutes: end,
      durationMinutes: 30,
      companyId: companyAlpha.id,
    });
  }

  for (let i = 1; i <= 5; i++) {
    const start = 480 + i * 15; // 08:00 +
    const end = start + 45;     // 45 min trip
    await AppDataSource.manager.save(TripEntity, {
      lineId: 202,
      startTimeMinutes: start,
      endTimeMinutes: end,
      durationMinutes: 45,
      companyId: companyBeta.id,
    });
  }

  console.log('✅ Viagens semeadas.');
  console.log('🚀 Seeding concluído com SUCESSO!');
  
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error('❌ Erro durante o Seeding:', err);
  process.exit(1);
});
