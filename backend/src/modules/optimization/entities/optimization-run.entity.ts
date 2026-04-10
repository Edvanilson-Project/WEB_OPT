import { Entity, Column, Index } from 'typeorm';
import { BaseCompanyEntity } from '../../../common/entities/base.entity';

export enum OptimizationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum OptimizationAlgorithm {
  VSP_GREEDY = 'vsp_greedy',
  VSP_ONLY = 'vsp_only',
  VSP_LOCAL_SEARCH = 'vsp_local_search',
  CSP_COLUMN_GENERATION = 'csp_column_generation',
  CSP_HEURISTIC = 'csp_heuristic',
  CSP_ONLY = 'csp_only',
  FULL_PIPELINE = 'full_pipeline',
  HYBRID_PIPELINE = 'hybrid_pipeline',
  GENETIC = 'genetic',
  SIMULATED_ANNEALING = 'simulated_annealing',
  TABU_SEARCH = 'tabu_search',
  SET_PARTITIONING = 'set_partitioning',
  JOINT_SOLVER = 'joint_solver',
  GREEDY = 'greedy',
}

@Entity('optimization_runs')
export class OptimizationRunEntity extends BaseCompanyEntity {
  @Index()
  @Column({ name: 'line_id', nullable: true })
  lineId: number;

  /** Para otimizações multi-linha. Null = apenas lineId acima. */
  @Column({ name: 'line_ids', type: 'jsonb', nullable: true })
  lineIds: number[] | null;

  @Column({ name: 'schedule_id', nullable: true })
  scheduleId: number;

  @Column({
    type: 'enum',
    enum: OptimizationStatus,
    default: OptimizationStatus.PENDING,
  })
  status: OptimizationStatus;

  @Column({
    type: 'enum',
    enum: OptimizationAlgorithm,
    default: OptimizationAlgorithm.FULL_PIPELINE,
  })
  algorithm: OptimizationAlgorithm;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs: number;

  @Column({ type: 'jsonb', name: 'params', nullable: true })
  params: Record<string, any>;

  @Column({ type: 'jsonb', name: 'result_summary', nullable: true })
  resultSummary: Record<string, any>;

  @Column({ name: 'total_vehicles', nullable: true })
  totalVehicles: number;

  @Column({ name: 'total_crew', nullable: true })
  totalCrew: number;

  @Column({ name: 'total_trips', nullable: true })
  totalTrips: number;

  @Column({
    name: 'total_cost',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  totalCost: number;

  @Column({ name: 'cct_violations', default: 0 })
  cctViolations: number;

  @Column({ name: 'error_message', nullable: true, length: 2000 })
  errorMessage: string;

  @Column({ name: 'stdout_log', nullable: true, type: 'text' })
  stdoutLog: string;

  @Column({ name: 'triggered_by_user_id', nullable: true })
  triggeredByUserId: number;
}
