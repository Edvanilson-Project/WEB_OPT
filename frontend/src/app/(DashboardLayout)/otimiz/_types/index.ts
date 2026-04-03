// ═══════════════════════════════════════════════════════════════════
// OTIMIZ — Tipos de domínio compartilhados
// Schema sincronizado com o banco de dados (TypeORM)
// ═══════════════════════════════════════════════════════════════════

export interface Company {
  id: number;
  name: string;
  /** CNPJ é obrigatório no banco (NOT NULL) */
  cnpj: string;
  tradeName?: string;
  status: 'active' | 'inactive';
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  logoUrl?: string;
  fleetSize?: number;
  dailyTrips?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Terminal {
  id: number;
  /** company_id é NOT NULL no banco */
  companyId: number;
  name: string;
  /** Coluna short_name no banco */
  shortName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isGarage: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Line {
  id: number;
  companyId: number;
  code: string;
  name: string;
  originTerminalId: number;
  destinationTerminalId: number;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
  distanceKm?: number;
  avgTripDurationMinutes?: number;
  status: 'active' | 'inactive';
  colorHex?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleType {
  id: number;
  companyId: number;
  name: string;
  /** Código opcional (ex: BUS-STD) */
  code?: string;
  /** Capacidade de passageiros (passenger_capacity) */
  passengerCapacity: number;
  costPerKm: number;
  costPerHour: number;
  fixedCost: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'super_admin' | 'company_admin' | 'analyst' | 'operator';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyId?: number;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OptimizationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type OptimizationAlgorithm =
  | 'full_pipeline'
  | 'hybrid_pipeline'
  | 'greedy'
  | 'vsp_only'
  | 'csp_only'
  | 'genetic'
  | 'simulated_annealing'
  | 'tabu_search'
  | 'set_partitioning'
  | 'joint_solver';

export interface OptimizationRun {
  id: number;
  lineId?: number | null;
  lineIds?: number[] | null;
  line?: Line;
  companyId: number;
  algorithm: OptimizationAlgorithm;
  status: OptimizationStatus;
  /** total_vehicles no banco */
  totalVehicles?: number;
  /** total_crew no banco */
  totalCrew?: number;
  totalTrips?: number;
  totalCost?: number;
  cctViolations?: number;
  durationMs?: number;
  errorMessage?: string;
  params?: Record<string, unknown>;
  resultSummary?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalLines: number;
  totalTerminals: number;
  totalVehicleTypes: number;
  totalOptimizationRuns: number;
  lastRunAt?: string;
  lastRunVehicles?: number;
  lastRunCrew?: number;
  lastRunCost?: number;
  recentRuns: OptimizationRun[];
}

export interface KpiData {
  totalRuns: number;
  completedRuns: number;
  avgVehicles: number;
  avgCrew: number;
  avgCost: number;
  avgDurationMs: number;
  successRate: number;
}

export interface HistoryPoint {
  date: string;
  runId: string;
  vehicles: number;
  crew: number;
  cost: number;
  algorithm: string;
}

// ─── Trip ────────────────────────────────────────────────────────────────────
export type TripDirection = 'outbound' | 'return';

export interface Trip {
  id: number;
  companyId: number;
  lineId: number;
  line?: Line;
  direction: TripDirection;
  startTimeMinutes: number;
  endTimeMinutes: number;
  durationMinutes: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
  tripGroupId?: number;
  isActive: boolean;
  tripCode?: string;
  passengerCount?: number;
  vehicleTypeId?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── OptimizationSettings ────────────────────────────────────────────────────
export interface OptimizationSettings {
  id: number;
  companyId: number;
  name?: string;
  description?: string;
  algorithmType: string;
  gaPopulationSize: number;
  gaGenerations: number;
  gaMutationRate: number;
  gaCrossoverRate: number;
  saInitialTemperature: number;
  saCoolingRate: number;
  saMinTemperature: number;
  tsTabuSize: number;
  tsMaxIterations: number;
  ilpTimeoutSeconds: number;
  timeBudgetSeconds: number;
  cctMaxShiftMinutes: number;
  cctMaxDrivingMinutes: number;
  cctMinBreakMinutes: number;
  cctMaxDutiesPerDay: number;
  allowReliefPoints: boolean;
  // CCT estendido
  cctMaxWorkMinutes: number;
  cctMinLayoverMinutes: number;
  applyCct: boolean;
  pulloutMinutes: number;
  pullbackMinutes: number;
  maxVehicleShiftMinutes: number;
  cctMandatoryBreakAfterMinutes?: number;
  cctSplitBreakFirstMinutes?: number;
  cctSplitBreakSecondMinutes?: number;
  cctMealBreakMinutes?: number;
  cctReducedWeeklyRestMinutes?: number;
  cctAllowReducedWeeklyRest?: boolean;
  cctDailyDrivingLimitMinutes?: number;
  cctExtendedDailyDrivingLimitMinutes?: number;
  cctMaxExtendedDrivingDaysPerWeek?: number;
  cctWeeklyDrivingLimitMinutes?: number;
  cctFortnightDrivingLimitMinutes?: number;
  cctWaitingTimePayPct?: number;
  cctMinGuaranteedWorkMinutes?: number;
  enforceSameDepotStartEnd?: boolean;
  enforceSingleLineDuty?: boolean;
  fairnessWeight?: number;
  sundayOffWeight?: number;
  holidayExtraPct?: number;
  sameDepotRequired?: boolean;
  maxSimultaneousChargers?: number;
  peakEnergyCostPerKwh?: number;
  offpeakEnergyCostPerKwh?: number;
  minWorkpieceMinutes?: number;
  maxWorkpieceMinutes?: number;
  minTripsPerPiece?: number;
  maxTripsPerPiece?: number;
  pricingEnabled?: boolean;
  useSetCovering?: boolean;
  preservePreferredPairs?: boolean;
  maxCandidateSuccessorsPerTask?: number;
  maxGeneratedColumns?: number;
  maxPricingIterations?: number;
  maxPricingAdditions?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers tipados para respostas paginadas ────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Extrai array de resposta que pode ser T[] ou PaginatedResponse<T>
export function extractArray<T>(res: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(res)) return res;
  return res.data ?? [];
}
