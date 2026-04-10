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
import { TimeBandsModule } from './modules/time-bands/time-bands.module';
import { LineTripProfilesModule } from './modules/line-trip-profiles/line-trip-profiles.module';
import { TimetableRulesModule } from './modules/timetable-rules/timetable-rules.module';
import { ScheduleGroupsModule } from './modules/schedule-groups/schedule-groups.module';
import { TripTimeConfigsModule } from './modules/trip-time-configs/trip-time-configs.module';
import { PassengerConfigsModule } from './modules/passenger-configs/passenger-configs.module';
import { TimetablesModule } from './modules/timetables/timetables.module';
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
    TimeBandsModule,
    LineTripProfilesModule,
    TimetableRulesModule,
    ScheduleGroupsModule,
    TripTimeConfigsModule,
    PassengerConfigsModule,
    TimetablesModule,
  ],
})
export class AppModule {}
