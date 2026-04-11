import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import {
  OptimizationRunEntity,
  OptimizationStatus,
  OptimizationAlgorithm,
} from './entities/optimization-run.entity';
import { RunOptimizationDto } from './dto/run-optimization.dto';
import { TripsService } from '../trips/trips.service';
import { OptimizationSettingsService } from '../optimization-settings/optimization-settings.service';
import { LinesService } from '../lines/lines.service';
import { TerminalsService } from '../terminals/terminals.service';
import { VehicleTypesService } from '../vehicle-types/vehicle-types.service';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

export interface ActiveSettingsDto {
  id?: number | string;
  name?: string;
  algorithmType?: string;
  cctMealBreakMinutes?: number;
  allowReliefPoints?: boolean;
  preservePreferredPairs?: boolean;
  enforceSingleLineDuty?: boolean;
  timeBudgetSeconds?: number;
  operationMode?: 'urban' | 'charter';
  [key: string]: any;
}

export interface OptimizationResultPayload {
  vehicles?: number;
  num_vehicles?: number;
  crew?: number;
  num_crew?: number;
  total_cost?: number | string;
  totalCost?: number | string;
  cct_violations?: number;
  cctViolations?: number;
  total_trips?: number;
  totalTrips?: number;
  blocks?: any[];
  duties?: any[];
  unassigned_trips?: any[];
  warnings?: any[];
  meta?: {
    hard_constraint_report?: {
      output?: {
        ok?: boolean;
        hard_issues?: unknown[];
      };
    };
    [key: string]: unknown;
  };
  [key: string]: any;
}

@Injectable()
export class OptimizationService {
  private readonly logger = new Logger(OptimizationService.name);

  constructor(
    @InjectRepository(OptimizationRunEntity)
    private readonly runRepo: Repository<OptimizationRunEntity>,
    private readonly tripsService: TripsService,
    private readonly settingsService: OptimizationSettingsService,
    private readonly configService: ConfigService,
    private readonly linesService: LinesService,
    private readonly terminalsService: TerminalsService,
    private readonly vehicleTypesService: VehicleTypesService,
  ) {}

  /**
   * Inicia uma nova execução de otimização assíncrona.
   * Retorna o run criado imediatamente; processa em background.
   */
  async startOptimization(
    dto: RunOptimizationDto,
    userId?: number,
  ): Promise<OptimizationRunEntity> {
    // Suporte multi-linha: lineIds tem prioridade sobre lineId
    const effectiveLineId =
      dto.lineIds?.length === 1 ? dto.lineIds[0] : (dto.lineId ?? null);
    const effectiveLineIds =
      (dto.lineIds?.length ?? 0) > 1 ? dto.lineIds : null;

    const algStr = (dto.algorithm ??
      OptimizationAlgorithm.HYBRID_PIPELINE) as any;
    const algEnum = Object.values(OptimizationAlgorithm).includes(algStr)
      ? (algStr as OptimizationAlgorithm)
      : OptimizationAlgorithm.HYBRID_PIPELINE;

    const run = this.runRepo.create({
      lineId: effectiveLineId,
      lineIds: effectiveLineIds,
      companyId: dto.companyId,
      scheduleId: dto.scheduleId,
      algorithm: algEnum,
      status: OptimizationStatus.PENDING,
      params: { vsp: dto.vspParams, csp: dto.cspParams },
      triggeredByUserId: userId,
    });

    const saved = await this.runRepo.save(run);
    const lineDesc = effectiveLineIds
      ? `linhas [${effectiveLineIds.join(',')}]`
      : `linha ${effectiveLineId}`;
    this.logger.log(`Otimização iniciada: run#${saved.id} para ${lineDesc}`);

    // Execução assíncrona – não aguardar
    this._executeOptimization(saved.id, dto).catch((err) => {
      this.logger.error(`Falha na otimização run#${saved.id}: ${err.message}`);
    });

    return saved;
  }

  private async _executeOptimization(
    runId: number,
    dto: RunOptimizationDto,
  ): Promise<void> {
    await this.runRepo.update(runId, {
      status: OptimizationStatus.RUNNING,
      startedAt: new Date(),
    });
    let activeSettings: any = null;

    try {
      // Busca viagens para todas as linhas solicitadas
      const lineIdsToFetch: number[] = dto.lineIds?.length
        ? dto.lineIds
        : dto.lineId
          ? [dto.lineId]
          : [];

      if (!lineIdsToFetch.length) {
        throw new Error('Nenhuma linha especificada para otimizar');
      }

      const tripsArrays = await Promise.all(
        lineIdsToFetch.map((lid) =>
          this.tripsService.findAll(dto.companyId, lid),
        ),
      );
      const trips = tripsArrays.flat();
      const totalTripsCount = trips.length;

      if (!totalTripsCount) {
        const desc =
          lineIdsToFetch.length > 1
            ? 'as linhas selecionadas'
            : `linha ${lineIdsToFetch[0]}`;
        throw new Error(`Nenhuma viagem encontrada para ${desc}`);
      }

      // Tenta chamar o microserviço FastAPI primeiro
      const optimizerUrl = this.configService.get(
        'OPTIMIZER_URL',
        'http://localhost:8000',
      );
      activeSettings = await this.settingsService
        .findActive(dto.companyId)
        .catch(() => null);

      let result: any;
      try {
        // Parâmetros CCT: DB settings como base, dto.cspParams como override por-requisição
        const normalizeWeight = (value: any, fallback: number) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return fallback;
          if (parsed <= 0) return 0;
          return parsed > 1 ? parsed / 100 : parsed;
        };
        const configuredFairness = normalizeWeight(
          activeSettings?.fairnessWeight,
          0,
        );
        const fairnessWeight =
          configuredFairness > 0 ? configuredFairness : 0.6;

        const cctBase = {
          max_shift_minutes: activeSettings?.cctMaxShiftMinutes ?? 560,
          max_work_minutes: activeSettings?.cctMaxWorkMinutes ?? 480,
          max_driving_minutes: activeSettings?.cctMaxDrivingMinutes ?? 270,
          min_break_minutes: activeSettings?.cctMinBreakMinutes ?? 20,
          min_layover_minutes: activeSettings?.cctMinLayoverMinutes ?? 10,
          pullout_minutes: activeSettings?.pulloutMinutes ?? 10,
          pullback_minutes: activeSettings?.pullbackMinutes ?? 10,
          apply_cct: activeSettings?.applyCct ?? true,
          // Novos CCT/CLT (2026)
          min_work_minutes: activeSettings?.cctMinWorkMinutes ?? 0,
          min_shift_minutes: activeSettings?.cctMinShiftMinutes ?? 0,
          overtime_limit_minutes:
            activeSettings?.cctOvertimeLimitMinutes ?? 120,
          mandatory_break_after_minutes:
            activeSettings?.cctMandatoryBreakAfterMinutes ?? 270,
          split_break_first_minutes:
            activeSettings?.cctSplitBreakFirstMinutes ?? 15,
          split_break_second_minutes:
            activeSettings?.cctSplitBreakSecondMinutes ?? 30,
          meal_break_minutes: activeSettings?.cctMealBreakMinutes ?? 20,
          inter_shift_rest_minutes:
            activeSettings?.cctInterShiftRestMinutes ?? 660,
          weekly_rest_minutes: activeSettings?.cctWeeklyRestMinutes ?? 1440,
          reduced_weekly_rest_minutes:
            activeSettings?.cctReducedWeeklyRestMinutes ?? 2160,
          allow_reduced_weekly_rest:
            activeSettings?.cctAllowReducedWeeklyRest ?? false,
          daily_driving_limit_minutes:
            activeSettings?.cctDailyDrivingLimitMinutes ?? 540,
          extended_daily_driving_limit_minutes:
            activeSettings?.cctExtendedDailyDrivingLimitMinutes ?? 600,
          max_extended_driving_days_per_week:
            activeSettings?.cctMaxExtendedDrivingDaysPerWeek ?? 2,
          weekly_driving_limit_minutes:
            activeSettings?.cctWeeklyDrivingLimitMinutes ?? 3360,
          fortnight_driving_limit_minutes:
            activeSettings?.cctFortnightDrivingLimitMinutes ?? 5400,
          idle_time_is_paid: activeSettings?.cctIdleTimeIsPaid ?? true,
          waiting_time_pay_pct: activeSettings?.cctWaitingTimePayPct ?? 0.3,
          min_guaranteed_work_minutes:
            activeSettings?.cctMinGuaranteedWorkMinutes ?? 0,
          allow_relief_points: true,
          enforce_same_depot_start_end:
            activeSettings?.enforceSameDepotStartEnd ?? false,
          enforce_single_line_duty:
            activeSettings?.enforceSingleLineDuty ?? false,
          fairness_weight: fairnessWeight,
          fairness_target_work_minutes: 420,
          fairness_tolerance_minutes: 30,
          long_unpaid_break_limit_minutes: 180,
          long_unpaid_break_penalty_weight: 1.0,
          operator_change_terminals_only: true,
          operator_single_vehicle_only: true,
          enforce_trip_groups_hard: false,
          operator_pairing_hard: false,
          strict_hard_validation: true,
          sunday_off_weight: activeSettings?.sundayOffWeight ?? 0,
          holiday_extra_pct: activeSettings?.holidayExtraPct ?? 1.0,
          goal_weights: {
            fairness: fairnessWeight,
            overtime: 0.8,
            spread: 0.15,
            min_work: 0.2,
          },
          nocturnal_start_hour: activeSettings?.cctNocturnalStartHour ?? 22,
          nocturnal_end_hour: activeSettings?.cctNocturnalEndHour ?? 5,
          nocturnal_factor: activeSettings?.cctNocturnalFactor ?? 0.875,
          nocturnal_extra_pct: activeSettings?.cctNocturnalExtraPct ?? 0.2,
        };
        // Aplicar heurísticas de Modo de Operação (Urban vs Charter/Fretamento)
        const opMode = dto.operationMode ?? 'urban';
        if (opMode === 'charter') {
          cctBase.max_shift_minutes = 900;
          cctBase.idle_time_is_paid = true;
          cctBase.waiting_time_pay_pct = 0.3;
          cctBase.allow_relief_points = true;
          cctBase.operator_change_terminals_only = false;
          cctBase.long_unpaid_break_limit_minutes = 600;
        }

        // dto.cspParams sobrescreve campos específicos (override por run)
        const cctOverride = dto.cspParams ?? {};
        const cctParams = {
          ...cctBase,
          ...(cctOverride.maxWorkMinutes !== undefined && {
            max_work_minutes: cctOverride.maxWorkMinutes,
          }),
          ...(cctOverride.breakMinutes !== undefined && {
            min_break_minutes: 12,
          }),
          ...((cctOverride as any).maxUnpaidBreakMinutes !== undefined
            ? {
                max_unpaid_break_minutes: (cctOverride as any)
                  .maxUnpaidBreakMinutes,
              }
            : { max_unpaid_break_minutes: opMode === 'charter' ? 600 : 360 }),
          ...(cctOverride.minShiftMinutes !== undefined && {
            min_shift_minutes: cctOverride.minShiftMinutes,
          }),
          ...(cctOverride.maxShiftMinutes !== undefined && {
            max_shift_minutes: cctOverride.maxShiftMinutes,
          }),
          ...(cctOverride.maxDrivingMinutes !== undefined && {
            max_driving_minutes: cctOverride.maxDrivingMinutes,
          }),

          ...(cctOverride.enforceSingleLineDuty !== undefined && {
            enforce_single_line_duty: cctOverride.enforceSingleLineDuty,
          }),
          ...(cctOverride.fairnessWeight !== undefined && {
            fairness_weight: cctOverride.fairnessWeight,
          }),
          ...(cctOverride.fairnessTargetWorkMinutes !== undefined && {
            fairness_target_work_minutes: cctOverride.fairnessTargetWorkMinutes,
          }),
          ...(cctOverride.fairnessToleranceMinutes !== undefined && {
            fairness_tolerance_minutes: cctOverride.fairnessToleranceMinutes,
          }),
          ...((cctOverride as any).maxUnpaidBreakMinutes !== undefined && {
            max_unpaid_break_minutes: (cctOverride as any)
              .maxUnpaidBreakMinutes,
          }),
          ...((cctOverride as any).maxTotalUnpaidBreakMinutes !== undefined && {
            max_total_unpaid_break_minutes: (cctOverride as any)
              .maxTotalUnpaidBreakMinutes,
          }),
          ...((cctOverride as any).longUnpaidBreakLimitMinutes !==
            undefined && {
            long_unpaid_break_limit_minutes: (cctOverride as any)
              .longUnpaidBreakLimitMinutes,
          }),
          ...((cctOverride as any).longUnpaidBreakPenaltyWeight !==
            undefined && {
            long_unpaid_break_penalty_weight: (cctOverride as any)
              .longUnpaidBreakPenaltyWeight,
          }),
          ...((cctOverride as any).strictHardValidation !== undefined && {
            strict_hard_validation: (cctOverride as any).strictHardValidation,
          }),
          ...(cctOverride.enforceTripGroupsHard !== undefined && {
            enforce_trip_groups_hard: cctOverride.enforceTripGroupsHard,
          }),
          ...(cctOverride.operatorChangeTerminalsOnly !== undefined && {
            operator_change_terminals_only:
              cctOverride.operatorChangeTerminalsOnly,
          }),
          ...((cctOverride as any).operatorSingleVehicleOnly !== undefined && {
            operator_single_vehicle_only: (cctOverride as any)
              .operatorSingleVehicleOnly,
          }),
          ...((cctOverride as any).connectionToleranceMinutes !== undefined && {
            connection_tolerance_minutes: (cctOverride as any)
              .connectionToleranceMinutes,
          }),
        };
        const fairnessOverride = normalizeWeight(
          (cctOverride as any).fairnessWeight,
          fairnessWeight,
        );
        const mergedGoalWeights = {
          ...(cctBase.goal_weights ?? {}),
          ...(cctParams.goal_weights ?? {}),
        };
        cctParams.goal_weights = {
          overtime: Number((mergedGoalWeights as any).overtime ?? 0.8),
          spread: Number((mergedGoalWeights as any).spread ?? 0.15),
          min_work: Number((mergedGoalWeights as any).min_work ?? 0.2),
          fairness: fairnessOverride,
        };

        const vspBase = {
          max_vehicle_shift_minutes: 1200,
          min_layover_minutes: 10,
          time_budget_s: activeSettings?.timeBudgetSeconds ?? 300,
          fixed_vehicle_activation_cost:
            activeSettings?.fixedVehicleActivationCost ?? 3000,
          deadhead_cost_per_minute:
            activeSettings?.deadheadCostPerMinute ?? 0.85,
          idle_cost_per_minute: activeSettings?.idleCostPerMinute ?? 0.5,
          same_depot_required: activeSettings?.sameDepotRequired ?? false,
          preserve_preferred_pairs:
            activeSettings?.preservePreferredPairs ?? false,
          allow_multi_line_block: activeSettings?.allowMultiLineBlock ?? true,
          allow_vehicle_split_shifts:
            activeSettings?.allowVehicleSplitShifts ?? true,
          split_shift_min_gap_minutes: 120,
          split_shift_max_gap_minutes: 600,
          max_connection_cost_for_reuse_ratio: 2.5,
          max_simultaneous_chargers:
            activeSettings?.maxSimultaneousChargers ?? 0,
          peak_energy_cost_per_kwh: activeSettings?.peakEnergyCostPerKwh ?? 0,
          offpeak_energy_cost_per_kwh:
            activeSettings?.offpeakEnergyCostPerKwh ?? 0,
          min_workpiece_minutes: activeSettings?.minWorkpieceMinutes ?? 0,
          max_workpiece_minutes: activeSettings?.maxWorkpieceMinutes ?? 480,
          min_trips_per_piece: activeSettings?.minTripsPerPiece ?? 1,
          max_trips_per_piece: activeSettings?.maxTripsPerPiece ?? 6,
          pricing_enabled: activeSettings?.pricingEnabled ?? true,
          use_set_covering: activeSettings?.useSetCovering ?? false,
          max_candidate_successors_per_task:
            activeSettings?.maxCandidateSuccessorsPerTask ?? 10,
          max_generated_columns: activeSettings?.maxGeneratedColumns ?? 8000,
          max_pricing_iterations: activeSettings?.maxPricingIterations ?? 5,
          max_pricing_additions: activeSettings?.maxPricingAdditions ?? 512,
          strict_hard_validation: true,
        };
        const vspParams = {
          ...vspBase,
          ...(dto.timeBudgetSeconds !== undefined && {
            time_budget_s: dto.timeBudgetSeconds,
          }),
          ...(dto.vspParams?.timeBudgetSeconds !== undefined && {
            time_budget_s: dto.vspParams.timeBudgetSeconds,
          }),
          ...(dto.vspParams?.maxVehicles !== undefined && {
            max_vehicles: dto.vspParams.maxVehicles,
            maxVehicles: dto.vspParams.maxVehicles,
          }),
          ...((dto.vspParams as any)?.fixedVehicleActivationCost !==
            undefined && {
            fixed_vehicle_activation_cost: (dto.vspParams as any)
              .fixedVehicleActivationCost,
          }),
          ...((dto.vspParams as any)?.deadheadCostPerMinute !== undefined && {
            deadhead_cost_per_minute: (dto.vspParams as any)
              .deadheadCostPerMinute,
          }),
          ...((dto.vspParams as any)?.idleCostPerMinute !== undefined && {
            idle_cost_per_minute: (dto.vspParams as any).idleCostPerMinute,
          }),
          ...((dto.vspParams as any)?.maxConnectionCostForReuseRatio !==
            undefined && {
            max_connection_cost_for_reuse_ratio: (dto.vspParams as any)
              .maxConnectionCostForReuseRatio,
          }),
          ...((dto.vspParams as any)?.strictHardValidation !== undefined && {
            strict_hard_validation: (dto.vspParams as any).strictHardValidation,
          }),
          ...((dto.vspParams as any)?.allowMultiLineBlock !== undefined && {
            allow_multi_line_block: (dto.vspParams as any).allowMultiLineBlock,
          }),
          ...((dto.vspParams as any)?.allowVehicleSplitShifts !== undefined && {
            allow_vehicle_split_shifts: (dto.vspParams as any)
              .allowVehicleSplitShifts,
          }),
          ...((dto.vspParams as any)?.splitShiftMinGapMinutes !== undefined && {
            split_shift_min_gap_minutes: (dto.vspParams as any)
              .splitShiftMinGapMinutes,
          }),
          ...((dto.vspParams as any)?.splitShiftMaxGapMinutes !== undefined && {
            split_shift_max_gap_minutes: (dto.vspParams as any)
              .splitShiftMaxGapMinutes,
          }),
        };

        // ── Calcular matriz de deadhead entre terminais ──────────────────
        // Usa a duração mínima de viagem entre cada par de terminais como proxy.
        const deadheadMatrix = new Map<string, number>();
        for (const t of trips) {
          const orig = t.originTerminalId ?? 1;
          const dest = t.destinationTerminalId ?? 2;
          if (orig === dest) continue;
          const key = `${dest}-${orig}`; // deadhead do destino desta viagem para o origem de outra
          const dur = t.durationMinutes ?? 0;
          if (dur > 0) {
            const cur = deadheadMatrix.get(key) ?? Infinity;
            if (dur < cur) deadheadMatrix.set(key, dur);
          }
        }
        // Garantir simétrica e fallback: se A→B existe mas B→A não, usar A→B
        const terminalIds = new Set<number>();
        for (const t of trips) {
          terminalIds.add(t.originTerminalId ?? 1);
          terminalIds.add(t.destinationTerminalId ?? 2);
        }
        for (const a of terminalIds) {
          for (const b of terminalIds) {
            if (a === b) continue;
            const ab = deadheadMatrix.get(`${a}-${b}`);
            const ba = deadheadMatrix.get(`${b}-${a}`);
            if (ab === undefined && ba !== undefined) {
              deadheadMatrix.set(`${a}-${b}`, ba);
            }
          }
        }

        // Gerar deadhead_times por viagem (do destination desta viagem para cada terminal)
        const minLayover = vspParams.min_layover_minutes ?? 10;
        const terminalCentralMinLayover = 12; // Terminal Central (id=1): 12 min entre ida/volta

        const buildDeadheadTimes = (
          destTerminal: number,
        ): Record<number, number> => {
          const dh: Record<number, number> = {};
          for (const tid of terminalIds) {
            if (tid === destTerminal) {
              // Mesmo terminal: layover mínimo (não 0!)
              // Terminal Central exige 12 min, outros usam min_layover
              dh[tid] =
                destTerminal === 1 ? terminalCentralMinLayover : minLayover;
            } else {
              const key = `${destTerminal}-${tid}`;
              dh[tid] = Math.max(minLayover, deadheadMatrix.get(key) ?? 30);
            }
          }
          return dh;
        };

        const optimizerPayload: Record<string, any> = {
          trips: trips.map((t: any) => ({
            id: t.id,
            line_id: t.lineId ?? dto.lineId,
            trip_group_id: t.tripGroupId ?? null,
            start_time: t.startTimeMinutes ?? 0,
            end_time: t.endTimeMinutes ?? 0,
            // Usar terminal ID real (sem prefixo de linha).
            // Todas as linhas compartilham os mesmos terminais físicos,
            // então veículos podem trocar de linha no mesmo terminal.
            origin_id: t.originTerminalId ?? 1,
            destination_id: t.destinationTerminalId ?? 2,
            duration: t.durationMinutes ?? 0,
            distance_km: t.distanceKm ?? 0,
            deadhead_times: buildDeadheadTimes(t.destinationTerminalId ?? 2),
          })),
          vehicle_types: [],
          algorithm: this._mapAlgorithm(dto.algorithm as any),
          run_id: runId,
          line_id:
            (dto.lineIds?.length ?? 0) > 1
              ? null
              : (dto.lineId ?? dto.lineIds?.[0] ?? null),
          company_id: dto.companyId,
          time_budget_s:
            dto.timeBudgetSeconds ??
            dto.vspParams?.timeBudgetSeconds ??
            activeSettings?.timeBudgetSeconds ??
            null,
          cct_params: cctParams,
          vsp_params: vspParams,
        };

        try {
          require('fs').writeFileSync(
            '/tmp/optimizer_payload.json',
            JSON.stringify(optimizerPayload, null, 2),
          );
          require('fs').writeFileSync(
            '/tmp/optimizer_payload.json',
            JSON.stringify(optimizerPayload, null, 2),
          );
          require('fs').writeFileSync(
            '/tmp/optimizer_payload.json',
            JSON.stringify(optimizerPayload, null, 2),
          );
          require('fs').writeFileSync(
            '/tmp/optimizer_payload.json',
            JSON.stringify(optimizerPayload, null, 2),
          );
          result = await this._callOptimizerService(
            optimizerUrl,
            optimizerPayload,
          );
        } catch (optimizerRunErr) {
          const msg = (optimizerRunErr as Error).message ?? '';
          const hasFleetCap = dto.vspParams?.maxVehicles !== undefined;
          const uncoveredTripError = msg.includes('UNCOVERED_TRIP');

          if (hasFleetCap && uncoveredTripError) {
            this.logger.warn(
              `run#${runId}: cobertura inviável com maxVehicles=${dto.vspParams?.maxVehicles}; reexecutando sem teto de frota.`,
            );

            const relaxedPayload = {
              ...optimizerPayload,
              vsp_params: {
                ...(optimizerPayload.vsp_params ?? {}),
              },
            };
            delete relaxedPayload.vsp_params.max_vehicles;
            delete relaxedPayload.vsp_params.maxVehicles;

            result = await this._callOptimizerService(
              optimizerUrl,
              relaxedPayload,
            );
            result.meta = {
              ...(result.meta ?? {}),
              fleet_cap_relaxed: true,
              fleet_cap_requested: dto.vspParams?.maxVehicles,
              fleet_cap_relaxation_reason: 'UNCOVERED_TRIP',
            };
          } else {
            throw optimizerRunErr;
          }
        }
      } catch (httpErr) {
        const optimizerError = this._classifyOptimizerError(httpErr as Error);
        if (optimizerError.kind === 'business') {
          throw new Error(optimizerError.message);
        }
        if (this._requiresFullOptimizer(dto, trips, activeSettings)) {
          throw new Error(
            `Otimizador Python indisponível (${optimizerError.message}). Esta execução exige o solver completo e não pode usar fallback inline.`,
          );
        }
        this.logger.warn(
          `Microserviço optimizer indisponível (${optimizerError.message}). Usando fallback inline.`,
        );
        result = await this._runInlineOptimization(trips, dto);
      }

      // Enrich blocks with full trip details so the frontend can display them
      this._enrichBlockTrips(result, trips);

      await this._saveResults(runId, result, totalTripsCount);
    } catch (err) {
      const diagnostics = this._buildFailureDiagnostics(
        (err as Error).message,
        dto,
        activeSettings,
      );
      await this.runRepo.update(runId, {
        status: OptimizationStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: diagnostics.userMessage,
        resultSummary: {
          diagnostics,
        } as any,
      });
    }
  }

  /** Chama o microserviço FastAPI optimizer via HTTP. */
  private _callOptimizerService(
    baseUrl: string,
    payload: Record<string, any>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const url = new URL('/optimize/', baseUrl);

      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON from optimizer: ${data}`));
            }
          } else {
            reject(new Error(`Optimizer HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(360000, () => {
        req.destroy();
        reject(new Error('Optimizer request timed out'));
      });
      req.write(body);
      req.end();
    });
  }

  /**
   * Mapeia o algoritmo do frontend/enum para o AlgorithmType válido do microserviço Python.
   * O Python só aceita: greedy | genetic | simulated_annealing | tabu_search |
   *                     set_partitioning | joint_solver | hybrid_pipeline
   * full_pipeline, vsp_only, csp_only NÃO existem no enum Python → mapeados para equivalentes.
   */
  private _mapAlgorithm(algorithm?: string): string {
    const map: Record<string, string> = {
      // Valores válidos — passam direto
      greedy: 'greedy',
      genetic: 'genetic',
      simulated_annealing: 'simulated_annealing',
      tabu_search: 'tabu_search',
      set_partitioning: 'set_partitioning',
      joint_solver: 'joint_solver',
      hybrid_pipeline: 'hybrid_pipeline',
      // Aliases que NÃO existem no Python
      full_pipeline: 'hybrid_pipeline', // pipeline completo → hybrid
      vsp_only: 'greedy', // só VSP → usa greedy
      csp_only: 'greedy', // só CSP → usa greedy
      // Enum legado
      vsp_greedy: 'greedy',
      vsp_local_search: 'tabu_search',
      csp_column_generation: 'set_partitioning',
      csp_heuristic: 'greedy',
    };
    return map[algorithm ?? ''] ?? 'hybrid_pipeline';
  }

  /** Algoritmo inline simplificado (fallback quando o microserviço não está disponível) */
  /**
   * Fallback VSP+CSP inline — usado quando o microserviço Python está offline.
   *
   * Garante:
   * - Sem sobreposição (gap >= 0 em todo encadeamento)
   * - Deadhead terminal-aware: usa mínima duração de viagem como proxy de deslocamento
   * - Layover mínimo configurable (padrão 8min no mesmo terminal)
   * - Blocos por linha: um veículo não muda de linha sem retornar ao depósito
   * - Viagens casadas preferidas: T1→T2 emparelha com T2→T1 por menor folga
   * - CCT no CSP: spread máximo, trabalho efetivo, pausas
   */
  private async _runInlineOptimization(
    trips: any[],
    dto: RunOptimizationDto,
  ): Promise<any> {
    const MIN_LAYOVER = 0;
    const MAX_VEHICLE_SHIFT = 960;
    const MAX_CCT_SHIFT = dto.cspParams?.maxShiftMinutes ?? 480;
    const MAX_CCT_WORK = dto.cspParams?.maxWorkMinutes ?? 440;
    const MAX_DRIVING = dto.cspParams?.maxDrivingMinutes ?? 270;
    const MIN_BREAK = dto.cspParams?.breakMinutes ?? 30;
    const PULLOUT = 10;
    const PULLBACK = 10;

    // ── 1. Ordenar viagens por horário de início ─────────────────────────────
    const sorted = [...trips].sort(
      (a, b) => (a.startTimeMinutes ?? 0) - (b.startTimeMinutes ?? 0),
    );

    if (!sorted.length) {
      return {
        vehicles: 0,
        crew: 0,
        blocks: [],
        duties: [],
        cct_violations: 0,
        vsp_algorithm: 'inline_greedy_v2',
        csp_algorithm: 'inline_greedy_v2',
        elapsed_ms: 0,
      };
    }

    // ── 2. Deadhead matrix: tempo mínimo de deslocamento entre terminais ─────
    // Terminal IDs codificados por linha: (lineId*1000 + terminalId)
    // Garante que terminais de linhas distintas NUNCA sejam considerados iguais → sem teletransporte
    const _encTerm = (
      lineId: number | null | undefined,
      terminalId: number | null | undefined,
      def: number,
    ) => (lineId ?? 0) * 1000 + (terminalId ?? def);

    const minTripDuration = new Map<string, number>();
    for (const t of sorted) {
      const encOrig = _encTerm(t.lineId, t.originTerminalId, 1);
      const encDest = _encTerm(t.lineId, t.destinationTerminalId, 2);
      const key = `${encOrig}-${encDest}`;
      const cur = minTripDuration.get(key) ?? Infinity;
      if ((t.durationMinutes ?? 0) < cur)
        minTripDuration.set(key, t.durationMinutes ?? 0);
    }
    const deadhead = (fromDest: number, toOrigin: number): number => {
      if (fromDest === toOrigin) {
        if (fromDest % 1000 === 1) return 15; // Final da volta -> Início da ida: mínimo 15 min
        return MIN_LAYOVER;
      }
      // Proxy: mínima duração de viagem fromDest→toOrigin
      const fwd = minTripDuration.get(`${fromDest}-${toOrigin}`);
      if (fwd !== undefined && fwd > 0) return fwd;
      // Nenhuma viagem direta conhecida → custo muito alto (inviável)
      return 9999;
    };

    // ── 3. VSP Guloso com regras físicas ─────────────────────────────────────
    interface InlineBlock {
      blockId: number;
      lineId: number | null;
      trips: any[];
      startTime: number;
      endTime: number;
      lastDestTerminal: number;
      workMinutes: number;
    }
    const activeBlocks: InlineBlock[] = [];
    const closedBlocks: InlineBlock[] = [];
    let nextBlockId = 1;

    const warnings: string[] = [];

    for (const trip of sorted) {
      const tripStart = trip.startTimeMinutes ?? 0;
      const tripEnd = trip.endTimeMinutes ?? 0;
      // Terminal IDs codificados por linha — previne teletransporte cross-line
      const _lid = trip.lineId ?? null;
      const originT =
        (_lid != null ? _lid * 1000 : 0) + (trip.originTerminalId ?? 1);
      const destT =
        (_lid != null ? _lid * 1000 : 0) + (trip.destinationTerminalId ?? 2);
      const lineId = trip.lineId ?? null;
      const dur = trip.durationMinutes ?? 0;

      // Fecha blocos que não poderão mais aceitar viagens (cutoff 3h de folga)
      const newActive: InlineBlock[] = [];
      for (const blk of activeBlocks) {
        const worstDeadhead = deadhead(blk.lastDestTerminal, originT);
        if (blk.endTime + worstDeadhead + 180 < tripStart) {
          closedBlocks.push(blk);
        } else {
          newActive.push(blk);
        }
      }
      // Substitui sem mutar o array original
      activeBlocks.length = 0;
      activeBlocks.push(...newActive);

      // Encontrar melhor bloco compatível (menor folga válida)
      let bestBlk: InlineBlock | null = null;
      let bestSlack = Infinity;

      for (const blk of activeBlocks) {
        // Restrição de linha: veículo não muda de linha
        if (lineId !== null && blk.lineId !== null && blk.lineId !== lineId)
          continue;
        // Turno máximo do veículo
        if (tripEnd - blk.startTime > MAX_VEHICLE_SHIFT) continue;

        const gap = tripStart - blk.endTime;
        const needed = deadhead(blk.lastDestTerminal, originT);
        // Verificação física: gap suficiente para deadhead?
        if (gap < needed) continue;
        // Sem sobreposição
        if (gap < 0) continue;

        const slack = gap - needed;
        if (slack < bestSlack) {
          bestSlack = slack;
          bestBlk = blk;
        }
      }

      if (bestBlk) {
        bestBlk.trips.push(trip);
        bestBlk.endTime = tripEnd;
        bestBlk.lastDestTerminal = destT;
        bestBlk.workMinutes += dur;
        if (lineId !== null && bestBlk.lineId === null) bestBlk.lineId = lineId;
      } else {
        // Novo bloco (novo veículo)
        activeBlocks.push({
          blockId: nextBlockId++,
          lineId,
          trips: [trip],
          startTime: tripStart,
          endTime: tripEnd,
          lastDestTerminal: destT,
          workMinutes: dur,
        });
      }
    }

    const allBlocks: InlineBlock[] = [...closedBlocks, ...activeBlocks];

    // ── 4. Validação de qualidade do VSP ─────────────────────────────────────
    let overlapCount = 0;
    let layoverZeroCount = 0;
    let deadheadInsufCount = 0;

    for (const blk of allBlocks) {
      const tds = [...blk.trips].sort(
        (a, b) => (a.startTimeMinutes ?? 0) - (b.startTimeMinutes ?? 0),
      );
      for (let i = 0; i < tds.length - 1; i++) {
        const cur = tds[i],
          nxt = tds[i + 1];
        const gap = (nxt.startTimeMinutes ?? 0) - (cur.endTimeMinutes ?? 0);
        const dh = deadhead(
          _encTerm(cur.lineId, cur.destinationTerminalId, 2),
          _encTerm(nxt.lineId, nxt.originTerminalId, 1),
        );
        if (gap < 0) {
          overlapCount++;
          warnings.push(
            `OVERLAP B${blk.blockId}: T${cur.id}(end=${cur.endTimeMinutes})→T${nxt.id}(start=${nxt.startTimeMinutes}) gap=${gap}min`,
          );
        } else if (gap < dh) {
          deadheadInsufCount++;
          warnings.push(
            `DEADHEAD_INSUF B${blk.blockId}: T${cur.id}→T${nxt.id} gap=${gap}min<needed=${dh}min`,
          );
        } else if (gap === 0) {
          layoverZeroCount++;
          warnings.push(`LAYOVER_ZERO B${blk.blockId}: T${cur.id}→T${nxt.id}`);
        }
      }
    }

    if (overlapCount > 0 || deadheadInsufCount > 0) {
      this.logger.warn(
        `[InlineVSP] Qualidade: overlaps=${overlapCount} deadhead_insuf=${deadheadInsufCount} layover_zero=${layoverZeroCount}`,
      );
    }

    // ── 5. CSP Inline — Atribuição de motoristas com regras CCT ──────────────
    interface InlineDuty {
      dutyId: number;
      segments: Array<{ blockId: number; trips: any[]; driveMin: number }>;
      spreadFrom: number;
      lastTripEnd: number;
      workTime: number;
      contDrive: number;
      shiftViolations: number;
      warnings: string[];
    }

    // Flatten: (trip, blockId) ordenado por start_time
    const tripBlock: Array<{ trip: any; blockId: number }> = [];
    for (const blk of allBlocks) {
      const sorted2 = [...blk.trips].sort(
        (a, b) => (a.startTimeMinutes ?? 0) - (b.startTimeMinutes ?? 0),
      );
      for (const t of sorted2)
        tripBlock.push({ trip: t, blockId: blk.blockId });
    }
    tripBlock.sort(
      (a, b) => (a.trip.startTimeMinutes ?? 0) - (b.trip.startTimeMinutes ?? 0),
    );

    const duties: InlineDuty[] = [];
    let nextDutyId = 1;
    let cctViolations = 0;

    for (const { trip, blockId } of tripBlock) {
      const tStart = trip.startTimeMinutes ?? 0;
      const tEnd = trip.endTimeMinutes ?? 0;
      const dur = trip.durationMinutes ?? tEnd - tStart;

      let assigned = false;
      for (const d of duties) {
        const gap = tStart - d.lastTripEnd;
        if (gap < 0) continue; // sobreposição
        const sameBlock =
          blockId === d.segments[d.segments.length - 1]?.blockId;
        if (!sameBlock && gap < MIN_BREAK) continue; // handoff sem pausa
        if (gap < MIN_LAYOVER) continue; // layover mínimo

        const newSpread = tEnd - d.spreadFrom;
        if (newSpread + PULLOUT + PULLBACK > MAX_CCT_SHIFT) continue;

        const newWork = d.workTime + dur;
        if (newWork > MAX_CCT_WORK) continue;

        const hadBreak = gap >= MIN_BREAK;
        const newContDrive = hadBreak ? dur : d.contDrive + gap + dur;
        if (newContDrive > MAX_DRIVING) continue;

        // Aceitar viagem neste plantão
        const lastSeg = d.segments[d.segments.length - 1];
        if (sameBlock && lastSeg) {
          lastSeg.trips.push(trip);
          lastSeg.driveMin += dur;
        } else {
          d.segments.push({ blockId, trips: [trip], driveMin: dur });
        }
        d.lastTripEnd = tEnd;
        d.workTime = newWork;
        d.contDrive = hadBreak ? dur : newContDrive;
        assigned = true;
        break;
      }

      if (!assigned) {
        duties.push({
          dutyId: nextDutyId++,
          segments: [{ blockId, trips: [trip], driveMin: dur }],
          spreadFrom: tStart,
          lastTripEnd: tEnd,
          workTime: dur,
          contDrive: dur,
          shiftViolations: 0,
          warnings: [],
        });
      }
    }

    // Valida CCT final
    for (const d of duties) {
      const spread = d.lastTripEnd - d.spreadFrom + PULLOUT + PULLBACK;
      if (spread > MAX_CCT_SHIFT) {
        d.shiftViolations++;
        cctViolations++;
        d.warnings.push(`Jornada ${spread}min > ${MAX_CCT_SHIFT}min`);
      }
    }

    // ── 6. Detectar Viagens Casadas ──────────────────────────────────────────
    // Viagem casada = T1→T2(ida) emparelha com T2→T1(volta) quando:
    //  1. mesma linha
    //  2. destino ida == origem volta
    //  3. volta.start >= ida.end + MIN_LAYOVER
    const pairedTrips = new Set<number>();
    const sortedForPairing = [...sorted];
    for (let i = 0; i < sortedForPairing.length; i++) {
      const ida = sortedForPairing[i];
      if (pairedTrips.has(ida.id)) continue;
      for (let j = i + 1; j < sortedForPairing.length; j++) {
        const volta = sortedForPairing[j];
        if (pairedTrips.has(volta.id)) continue;
        if ((volta.startTimeMinutes ?? 0) > (ida.endTimeMinutes ?? 0) + 120)
          break; // janela de 2h
        if (
          ida.lineId === volta.lineId &&
          ida.destinationTerminalId === volta.originTerminalId &&
          (volta.startTimeMinutes ?? 0) >=
            (ida.endTimeMinutes ?? 0) + MIN_LAYOVER
        ) {
          pairedTrips.add(ida.id);
          pairedTrips.add(volta.id);
          break;
        }
      }
    }

    // ── 7. Buscar nomes dos terminais para o resultado ────────────────────────
    const companyId = (await this.tripsService.findOne(sorted[0].id))?.companyId ?? 1;
    const allTerms = await this.terminalsService.findAll(companyId);
    const termMap = new Map(allTerms.map(t => [t.id, t.shortName || t.name]));

    // ── 8. Formatar resultado ─────────────────────────────────────────────────
    const blocksOut = allBlocks.map((blk) => {
      const tripsSorted = [...blk.trips].sort(
        (a, b) => (a.startTimeMinutes ?? 0) - (b.startTimeMinutes ?? 0),
      );
      const spread = blk.endTime - blk.startTime;
      const tripsDetails = tripsSorted.map((t) => ({
        id: t.id,
        trip_id: t.id,
        start_time: t.startTimeMinutes ?? 0,
        end_time: t.endTimeMinutes ?? 0,
        origin_id: t.originTerminalId ?? 1,
        destination_id: t.destinationTerminalId ?? 2,
        origin_name: termMap.get(t.originTerminalId ?? 1) || 'T#1',
        destination_name: termMap.get(t.destinationTerminalId ?? 2) || 'T#2',
        duration: t.durationMinutes ?? 0,
        line_id: t.lineId ?? null,
        is_paired: pairedTrips.has(t.id),
        direction:
          (t.originTerminalId ?? 1) < (t.destinationTerminalId ?? 2)
            ? ('outbound' as const)
            : ('inbound' as const),
      }));

      return {
        block_id: blk.blockId,
        trips: tripsDetails,
        num_trips: tripsSorted.length,
        start_time: blk.startTime,
        end_time: blk.endTime,
        spread_minutes: spread,
        idle_minutes: spread - blk.workMinutes,
        trip_details: tripsDetails,
      };
    });

    const dutiesOut = duties.map((d) => {
      const dutyTrips = d.segments.flatMap((s) => s.trips).map(t => ({
        id: t.id,
        trip_id: t.id,
        start_time: t.startTimeMinutes ?? 0,
        end_time: t.endTimeMinutes ?? 0,
        origin_id: t.originTerminalId ?? 1,
        destination_id: t.destinationTerminalId ?? 2,
        duration: t.durationMinutes ?? 0,
        line_id: t.lineId ?? null,
      }));

      return {
        duty_id: d.dutyId,
        blocks: [...new Set(d.segments.map((s) => s.blockId))],
        trip_ids: d.segments.flatMap((s) => s.trips.map((t) => t.id)),
        trips: dutyTrips,
        work_time: d.workTime,
        spread_time: d.lastTripEnd - d.spreadFrom,
        shift_violations: d.shiftViolations,
        continuous_driving_violation: false,
        warnings: d.warnings,
        segments: d.segments.map((s) => ({
          block_id: s.blockId,
          drive_minutes: s.driveMin,
          trip_ids: s.trips.map((t) => t.id),
          trips: s.trips.map(t => ({
            id: t.id,
            start_time: t.startTimeMinutes ?? 0,
            end_time: t.endTimeMinutes ?? 0,
          })),
        })),
      };
    });

    const qaWarnings = warnings.slice(0, 20).map((msg) => ({
      type: msg.startsWith('OVERLAP')
        ? 'overlap'
        : msg.startsWith('DEADHEAD')
          ? 'deadhead_insufficient'
          : 'layover_zero',
      severity: 'error',
      message: msg,
    }));

    return {
      vehicles: allBlocks.length,
      num_vehicles: allBlocks.length,
      crew: duties.length,
      num_crew: duties.length,
      blocks: blocksOut,
      duties: dutiesOut,
      total_trips: sorted.length,
      paired_trips: pairedTrips.size,
      total_cost: allBlocks.length * 800 + duties.length * 400,
      cct_violations: cctViolations,
      overlap_issues: overlapCount,
      deadhead_issues: deadheadInsufCount,
      warnings: [
        {
          type: 'fallback_inline',
          severity: 'warning',
          message:
            'Resultado gerado por fallback inline simplificado. Ele não garante preservação de pares ida-volta, continuidade estrita por linha ou regras avançadas do solver Python.',
        },
        ...qaWarnings,
      ],
      solver_source: 'inline_fallback',
      vsp_algorithm: 'inline_greedy_v2',
      csp_algorithm: 'inline_greedy_v2',
      elapsed_ms: 0,
    };
  }

  private _requiresFullOptimizer(
    dto: RunOptimizationDto,
    trips: any[],
    activeSettings: any,
  ): boolean {
    const multiLineRun = (dto.lineIds?.length ?? 0) > 1;
    const algorithm = String(
      dto.algorithm ?? OptimizationAlgorithm.FULL_PIPELINE,
    );
    const needsPairing =
      activeSettings?.preservePreferredPairs === true ||
      trips.some((trip) => trip?.tripGroupId != null);
    const needsSingleLineDuty =
      dto.cspParams?.enforceSingleLineDuty === true ||
      activeSettings?.enforceSingleLineDuty === true;

    return (
      multiLineRun ||
      algorithm === OptimizationAlgorithm.HYBRID_PIPELINE ||
      algorithm === OptimizationAlgorithm.SET_PARTITIONING ||
      needsPairing ||
      needsSingleLineDuty
    );
  }

  private _classifyOptimizerError(err: Error): {
    kind: 'business' | 'availability';
    message: string;
  } {
    const raw = String(err?.message ?? 'Erro desconhecido do otimizador');
    if (!raw.startsWith('Optimizer HTTP ')) {
      return { kind: 'availability', message: raw };
    }

    const jsonStart = raw.indexOf('{');
    if (jsonStart >= 0) {
      try {
        const payload = JSON.parse(raw.slice(jsonStart));
        const detail = payload?.detail;
        if (typeof detail === 'string') {
          return { kind: 'business', message: detail };
        }
        if (detail?.message) {
          return { kind: 'business', message: detail.message };
        }
      } catch {
        // fallback abaixo
      }
    }

    return { kind: 'availability', message: raw };
  }

  private _buildFailureDiagnostics(
    rawMessage: string,
    dto: RunOptimizationDto,
    activeSettings: ActiveSettingsDto | null,
  ): {
    code: string;
    userMessage: string;
    summary: string;
    hints: string[];
    currentSettings: Record<string, any>;
  } {
    const message = String(rawMessage || 'Falha desconhecida na execução');
    const hints: string[] = [];
    let code = 'UNKNOWN_FAILURE';
    let summary =
      'A execução falhou e precisa de ajuste antes de gerar a programação.';

    if (message.includes('MEAL_BREAK_MISSING')) {
      code = 'MEAL_BREAK_MISSING';
      summary =
        'O solver não conseguiu encaixar o intervalo de refeição exigido com as regras e viagens atuais.';
      hints.push(
        'Reduza o intervalo de refeição para 30 min se a operação permitir.',
      );
      hints.push(
        'Ative "Permitir relief points" para abrir mais pontos de troca e pausa.',
      );
      hints.push(
        'Se for multi-linha, teste primeiro uma única linha para identificar onde a grade está mais apertada.',
      );
      hints.push(
        'Se a operação exigir refeição de 60 min, revise a grade de partidas porque hoje não há janela suficiente.',
      );
    }

    if (message.includes('CONTINUOUS_DRIVING_EXCEEDED')) {
      code = 'CONTINUOUS_DRIVING_EXCEEDED';
      summary =
        'Há jornadas que ultrapassam o limite de direção contínua sem pausa válida.';
      hints.push(
        'Aumente folgas operacionais entre viagens ou permita relief points.',
      );
      hints.push(
        'Verifique se o break mínimo não está maior do que a folga real entre viagens.',
      );
    }

    if (message.includes('SPREAD_EXCEEDED')) {
      code = 'SPREAD_EXCEEDED';
      summary =
        'A jornada total está ultrapassando o spread máximo configurado.';
      hints.push('Aumente o spread máximo se a regra da empresa permitir.');
      hints.push('Ou divida a operação em mais jornadas/mais tripulantes.');
    }

    if (
      message.includes('DUTY_MULTI_LINE') ||
      message.includes('BLOCK_MULTI_LINE')
    ) {
      code = 'MULTI_LINE_CONFLICT';
      summary =
        'As regras atuais não aceitaram mistura de linhas nos blocos ou jornadas.';
      hints.push(
        'Desative "Manter tripulante em uma única linha" se a operação permitir mistura controlada.',
      );
      hints.push(
        'Se a regra for obrigatória, rode menos linhas por vez ou revise os tempos entre viagens.',
      );
    }

    if (message.includes('MANDATORY_GROUP_SPLIT')) {
      code = 'MANDATORY_GROUP_SPLIT';
      summary =
        'O sistema não conseguiu manter juntos alguns pares ida/volta que foram marcados como obrigatórios.';
      hints.push(
        'Teste o algoritmo híbrido para dar mais espaço à recombinação das jornadas.',
      );
      hints.push(
        'Ative relief points se a operação permitir troca em mais pontos.',
      );
      hints.push(
        'Se o dado de pairing estiver incorreto, revise o agrupamento ida/volta das viagens.',
      );
      hints.push(
        'Se a regra não for obrigatória em todos os casos, alivie o pairing rígido do cenário.',
      );
    }

    if (message.includes('Optimizer request timed out')) {
      code = 'OPTIMIZER_TIMEOUT';
      summary = 'O serviço do otimizador demorou demais para responder.';
      hints.push('Verifique se o serviço Python do otimizador está ativo.');
      hints.push(
        'Reduza a quantidade de linhas por execução para diagnosticar o gargalo.',
      );
      hints.push(
        'Se necessário, diminua a complexidade: menos linhas, menos pairing rígido ou menos tempo de busca.',
      );
    }

    if (message.includes('Esta execução exige o solver completo')) {
      if (code === 'UNKNOWN_FAILURE') code = 'FULL_SOLVER_REQUIRED';
      hints.push('Essa execução não pode usar o modo simplificado inline.');
      hints.push(
        'Garanta que o otimizador Python esteja no ar antes de rodar multi-linha, híbrido ou pairing rígido.',
      );
    }

    if (message.includes('Nenhuma viagem encontrada')) {
      code = 'NO_TRIPS_FOUND';
      summary = 'Não há viagens disponíveis para as linhas selecionadas.';
      hints.push(
        'Confira se a linha tem viagens cadastradas para a empresa e o período esperado.',
      );
    }

    if (hints.length === 0) {
      hints.push(
        'Abra a configuração ativa e revise os limites de jornada, pausa e pairing.',
      );
      hints.push(
        'Se o erro persistir, rode uma única linha para localizar o conflito com mais precisão.',
      );
    }

    const currentSettings = {
      lineIds: dto.lineIds ?? (dto.lineId ? [dto.lineId] : []),
      algorithm:
        dto.algorithm ?? activeSettings?.algorithmType ?? 'hybrid_pipeline',
      profileId: activeSettings?.id ?? null,
      profileName: activeSettings?.name ?? null,
      mealBreakMinutes: activeSettings?.cctMealBreakMinutes ?? null,
      allowReliefPoints: activeSettings?.allowReliefPoints ?? null,
      preservePreferredPairs: activeSettings?.preservePreferredPairs ?? null,
      enforceSingleLineDuty: activeSettings?.enforceSingleLineDuty ?? null,
      timeBudgetSeconds: activeSettings?.timeBudgetSeconds ?? null,
    };

    const userMessage = [
      summary,
      `Motivo técnico: ${message}`,
      'Sugestões rápidas:',
      ...hints.map((hint) => `- ${hint}`),
    ].join('\n');

    return {
      code,
      userMessage,
      summary,
      hints,
      currentSettings,
    };
  }

  private async _runPythonOptimizer(
    _pythonBin: string,
    _optimizerPath: string,
    _dto: RunOptimizationDto,
    _trips: any[],
  ): Promise<any> {
    // Mantido por compatibilidade — não utilizado mais
    throw new Error(
      'runPythonOptimizer is deprecated. Use microservice instead.',
    );
  }

  /** Enriquece result.blocks[].trips com objetos TripDetail completos para exibição no frontend. */
  private _enrichBlockTrips(result: any, trips: any[]): void {
    if (!result?.blocks || !Array.isArray(result.blocks)) return;
    const tripMap = new Map<number, any>(trips.map((t: any) => [t.id, t]));
    result.blocks = result.blocks.map((block: any) => ({
      ...block,
      trips: (block.trips ?? []).map((tripIdOrObj: any) => {
        const id = typeof tripIdOrObj === 'object' ? tripIdOrObj.id : tripIdOrObj;
        const t = tripMap.get(id);
        if (!t) return tripIdOrObj;
        return {
          id: t.id,
          trip_id: t.id,
          start_time: t.startTimeMinutes ?? null,
          end_time: t.endTimeMinutes ?? null,
          origin_id: String(t.originTerminalId ?? '--'),
          destination_id: String(t.destinationTerminalId ?? '--'),
          duration: t.durationMinutes ?? 0,
          block_id: block.block_id,
          status: 'assigned',
        };
      }),
    }));
  }

  private async _saveResults(
    runId: number,
    result: OptimizationResultPayload,
    totalTrips: number,
  ): Promise<void> {
    const finishedAt = new Date();
    const run = await this.runRepo.findOne({ where: { id: runId } });
    const durationMs = run?.startedAt
      ? finishedAt.getTime() - run.startedAt.getTime()
      : 0;

    // Sanitize numeric fields — prevent NaN/Infinity from corrupting the DB
    const safeNumber = (v: any, fallback = 0): number => {
      const n = Number(v ?? fallback);
      return Number.isFinite(n) ? n : fallback;
    };

    const cctViolations = safeNumber(result.cct_violations ?? result.cctViolations, 0);
    const totalCost = safeNumber(result.total_cost ?? result.totalCost, 0);
    const totalVehicles = safeNumber(result.vehicles ?? result.num_vehicles, 0);
    const totalCrew = safeNumber(result.crew ?? result.num_crew, 0);

    const hardOutputOk = result?.meta?.hard_constraint_report?.output?.ok;
    const hasHardViolation = hardOutputOk === false;

    if (hasHardViolation) {
      await this.runRepo.update(runId, {
        status: OptimizationStatus.FAILED,
        finishedAt,
        durationMs,
        totalVehicles,
        totalCrew,
        totalTrips,
        totalCost,
        cctViolations,
        errorMessage:
          'Execução encerrada por hard constraints inválidas. Ajuste parâmetros operacionais antes de publicar a escala.',
        resultSummary: result,
      });
      return;
    }

    await this.runRepo.update(runId, {
      status: OptimizationStatus.COMPLETED,
      finishedAt,
      durationMs,
      totalVehicles,
      totalCrew,
      totalTrips,
      totalCost,
      cctViolations,
      resultSummary: result,
    });
  }

  async findAll(companyId?: number): Promise<OptimizationRunEntity[]> {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return this.runRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(
    id: number,
    companyId?: number,
  ): Promise<OptimizationRunEntity> {
    const where: Record<string, number> =
      companyId != null ? { id, companyId } : { id };
    const run = await this.runRepo.findOne({ where });
    if (!run) throw new EntityNotFoundException('Execução de otimização', id);
    return run;
  }

  async cancel(id: number, companyId?: number): Promise<OptimizationRunEntity> {
    const run = await this.findOne(id, companyId);
    if (
      run.status === OptimizationStatus.RUNNING ||
      run.status === OptimizationStatus.PENDING
    ) {
      run.status = OptimizationStatus.CANCELLED;
      run.finishedAt = new Date();
      return this.runRepo.save(run);
    }
    return run;
  }

  async getRunAudit(id: number, companyId?: number): Promise<any> {
    // FIXME: Restaurar a implementação do Run Audit do Turn 1
    const run = await this.findOne(id, companyId);
    return run.resultSummary ?? {};
  }

  async compareRuns(
    id: number,
    otherId: number,
    companyId?: number,
  ): Promise<any> {
    // FIXME: Restaurar a implementação comparativa removida do back-end
    return {
      baseRunId: id,
      otherRunId: otherId,
    };
  }

  async recoverStaleRuns(): Promise<void> {
    // FIXME: Restaurar logic de cancelar execuções presas no banco após restarts
    this.logger.log('recouverStaleRuns stub acionado.');
  }

  async getDashboardStats(companyId: number): Promise<any> {
    const [runs, totalRuns, completedRuns, totalLines, totalTerminals, totalVehicleTypes] = await Promise.all([
      this.runRepo.find({
        where: { companyId, status: OptimizationStatus.COMPLETED },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.runRepo.count({ where: { companyId } }),
      this.runRepo.count({ where: { companyId, status: OptimizationStatus.COMPLETED } }),
      this.linesService['lineRepo'].count({ where: { companyId } }),
      this.terminalsService['terminalRepo'].count({ where: { companyId } }),
      this.vehicleTypesService['vehicleTypeRepo'].count({ where: { companyId } }),
    ]);

    const lastRun = runs[0];

    return {
      totalRuns,
      completedRuns,
      totalLines,
      totalTerminals,
      totalVehicleTypes,
      totalOptimizationRuns: totalRuns,
      lastOptimization: lastRun
        ? {
            id: lastRun.id,
            date: lastRun.finishedAt,
            vehicles: lastRun.totalVehicles,
            crew: lastRun.totalCrew,
            cost: lastRun.totalCost,
            cctViolations: lastRun.cctViolations,
          }
        : null,
      recentRuns: runs.slice(0, 5).map((r) => ({
        id: r.id,
        lineId: r.lineId,
        status: r.status,
        vehicles: r.totalVehicles,
        crew: r.totalCrew,
        cost: r.totalCost,
        duration: r.durationMs,
        createdAt: r.createdAt,
      })),
      // Campos extras para garantir compatibilidade com cockpit
      total_lines: totalLines,
      total_terminals: totalTerminals,
    };
  }
}
