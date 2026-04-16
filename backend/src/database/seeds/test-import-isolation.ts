import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { TripsImportService } from '../../modules/trips/trips-import.service';
import { TripsRepository } from '../../modules/trips/repositories/trips.repository';
import { LinesRepository } from '../../modules/lines/repositories/lines.repository';
import { TripEntity } from '../../modules/trips/entities/trip.entity';
import { LineEntity } from '../../modules/lines/entities/line.entity';
import { TenantContext } from '../../common/context/tenant.context';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Script de Teste: Validação de Isolamento Cross-Tenant na Importação.
 */
async function validate() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [TripEntity, LineEntity],
  });

  await ds.initialize();

  // Injeção de dependências manual para o teste (Saltando DI do Nest para script standalone)
  const tripsRepo = new TripsRepository(ds.getRepository(TripEntity) as any);
  const linesRepo = new LinesRepository(ds.getRepository(LineEntity) as any);
  const importService = new TripsImportService(tripsRepo, linesRepo);

  const csvPath = path.join(__dirname, 'sample_trips_alpha.csv');
  const buffer = fs.readFileSync(csvPath);

  console.log('🧪 Iniciando teste de isolamento...');

  // 1. Simular Contexto da Empresa ALPHA (ID: 1)
  await TenantContext.run({ tenant: { companyId: 1, companyName: 'Alpha' } }, async () => {
    console.log('--- Contexto: Empresa ALPHA ---');
    const initialCount = await tripsRepo.count();
    
    const result = await importService.importFromBuffer(buffer, 1);
    console.log(`✅ Importação Alpha: ${result.success} sucessos, ${result.errors.length} erros.`);
    
    const finalCount = await tripsRepo.count();
    console.log(`📊 Total ALPHA no Banco: ${finalCount} (Incremento: ${finalCount - initialCount})`);
  });

  // 2. Simular Contexto da Empresa BETA (ID: 2)
  await TenantContext.run({ tenant: { companyId: 2, companyName: 'Beta' } }, async () => {
    console.log('\n--- Contexto: Empresa BETA ---');
    
    // O count() do BaseRepository DEVE filtrar automaticamente apenas dados da Beta
    const tripsBeta = await tripsRepo.count();
    console.log(`📊 Total BETA no Banco: ${tripsBeta}`);
    
    if (tripsBeta > 5) { // O seed cria 5 viagens para a Beta. Se houver mais, falhou o isolamento.
      console.error('❌ ERRO: Vazamento de dados detectado! Beta está vendo trips da Alpha.');
    } else {
      console.log('✅ SUCESSO: Beta continua isolada e não vê dados da Alpha.');
    }
  });

  await ds.destroy();
}

validate().catch(console.error);
