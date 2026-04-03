import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { LinesModule } from './modules/lines/lines.module';
import { TerminalsModule } from './modules/terminals/terminals.module';
import { VehicleTypesModule } from './modules/vehicle-types/vehicle-types.module';
import { TripsModule } from './modules/trips/trips.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { OptimizationModule } from './modules/optimization/optimization.module';
import { VehicleRoutesModule } from './modules/vehicle-routes/vehicle-routes.module';
import { CrewShiftsModule } from './modules/crew-shifts/crew-shifts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { OptimizationSettingsModule } from './modules/optimization-settings/optimization-settings.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    LinesModule,
    TerminalsModule,
    VehicleTypesModule,
    TripsModule,
    SchedulesModule,
    OptimizationModule,
    VehicleRoutesModule,
    CrewShiftsModule,
    ReportsModule,
    OptimizationSettingsModule,
  ],
})
export class AppModule {}
