/**
 * Trip-interval helpers — duty assignment mapping, meal-break key building,
 * interval classification display rows.
 */
import type { OptimizationDuty, TripDetail } from '../../_types';
import {
  asRecord, toMinuteValue, getTripPublicId, classifyTripInterval,
  type TripIntervalClassification, type TripIntervalViewScope,
  type TripIntervalPolicy,
} from './formatters';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface DutyTripAssignment {
  dutyId?: number | string;
  rosterId?: number | string | null;
  operatorId?: number | string | null;
  operatorName?: string | null;
}

export interface TripIntervalAssignmentContext {
  dutyId?: number | string | null;
  operatorId?: number | string | null;
  operatorName?: string | null;
  sameAssignment: boolean;
}

export interface TripIntervalDisplayRow {
  classification: TripIntervalClassification;
  start: number;
  end: number;
  originId?: number | string | null;
  destinationId?: number | string | null;
  originName?: string;
  destinationName?: string;
  duration: number;
  recordLabel: string;
  recordHint: string;
}

// ─── Builders ───────────────────────────────────────────────────────────────

export function buildDutyAssignmentsByPublicTripId(
  duties: OptimizationDuty[],
): Record<number, DutyTripAssignment[]> {
  const assignmentMap: Record<number, DutyTripAssignment[]> = {};

  duties.forEach((duty) => {
    const meta = asRecord(duty.meta);
    const assignment: DutyTripAssignment = {
      dutyId: duty.duty_id,
      rosterId: meta?.roster_id ?? null,
      operatorId: meta?.operator_id ?? null,
      operatorName: meta?.operator_name ?? null,
    };

    (duty.trips || []).forEach((trip) => {
      const publicTripId = getTripPublicId(trip);
      if (publicTripId == null) return;

      const existing = assignmentMap[publicTripId] ?? [];
      const alreadyPresent = existing.some(
        (item) =>
          item.dutyId === assignment.dutyId &&
          item.rosterId === assignment.rosterId &&
          item.operatorId === assignment.operatorId,
      );

      if (!alreadyPresent) {
        assignmentMap[publicTripId] = [...existing, assignment];
      }
    });
  });

  return assignmentMap;
}

export function buildDutyMealBreakIntervalKey(
  dutyId: number | string | null | undefined,
  previousTrip: Partial<TripDetail> | Record<string, any>,
  nextTrip: Partial<TripDetail> | Record<string, any>,
): string | null {
  if (dutyId == null) return null;

  const previousTripId = getTripPublicId(previousTrip);
  const nextTripId = getTripPublicId(nextTrip);

  if (previousTripId == null || nextTripId == null) return null;
  return `${String(dutyId)}:${previousTripId}:${nextTripId}`;
}

export function buildDutyMealBreakIntervalKeys(
  duties: OptimizationDuty[],
  policy: TripIntervalPolicy,
): Set<string> {
  const keys = new Set<string>();

  if (policy.mealBreakMinutes <= 0) return keys;

  duties.forEach((duty) => {
    const meta = asRecord(duty.meta);
    const mealBreakFound = Boolean(meta?.meal_break_found);
    if (!mealBreakFound) return;

    const connectionToleranceMinutes =
      toMinuteValue(meta?.connection_tolerance_minutes) ??
      policy.connectionToleranceMinutes;

    const sortedTrips = (duty.trips || [])
      .filter((trip): trip is TripDetail => typeof trip === 'object' && trip != null)
      .slice()
      .sort((left, right) => (left.start_time ?? 0) - (right.start_time ?? 0));

    for (let index = 1; index < sortedTrips.length; index += 1) {
      const previousTrip = sortedTrips[index - 1];
      const nextTrip = sortedTrips[index];
      const rawGap = (nextTrip.start_time ?? 0) - (previousTrip.end_time ?? 0);
      if (rawGap <= 0) continue;

      const sameTerminal =
        previousTrip.destination_id != null &&
        nextTrip.origin_id != null &&
        String(previousTrip.destination_id) === String(nextTrip.origin_id);

      if (!sameTerminal) continue;

      const effectiveGap = rawGap + connectionToleranceMinutes;
      if (effectiveGap < policy.mealBreakMinutes) continue;

      const key = buildDutyMealBreakIntervalKey(
        duty.duty_id,
        previousTrip,
        nextTrip,
      );

      if (key) {
        keys.add(key);
        break;
      }
    }
  });

  return keys;
}

function getTripAssignments(
  trip: TripDetail | undefined,
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>,
): DutyTripAssignment[] {
  if (!trip || !dutyAssignmentsByPublicTripId) return [];

  const publicTripId = getTripPublicId(trip);
  if (publicTripId == null) return [];
  return dutyAssignmentsByPublicTripId[publicTripId] ?? [];
}

function resolveTripIntervalAssignmentContext({
  previousTrip,
  nextTrip,
  defaultAssignment,
  dutyAssignmentsByPublicTripId,
}: {
  previousTrip?: TripDetail;
  nextTrip?: TripDetail;
  defaultAssignment?: DutyTripAssignment | null;
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>;
}): TripIntervalAssignmentContext {
  if (defaultAssignment?.dutyId != null || defaultAssignment?.operatorId != null) {
    return {
      dutyId: defaultAssignment.dutyId ?? null,
      operatorId: defaultAssignment.operatorId ?? null,
      operatorName: defaultAssignment.operatorName ?? null,
      sameAssignment: true,
    };
  }

  if (
    previousTrip?.duty_id != null &&
    nextTrip?.duty_id != null &&
    String(previousTrip.duty_id) === String(nextTrip.duty_id)
  ) {
    return {
      dutyId: previousTrip.duty_id,
      operatorId:
        previousTrip.operator_id != null &&
        nextTrip?.operator_id != null &&
        String(previousTrip.operator_id) === String(nextTrip.operator_id)
          ? previousTrip.operator_id
          : null,
      operatorName:
        previousTrip.operator_name &&
        nextTrip?.operator_name &&
        previousTrip.operator_name === nextTrip.operator_name
          ? previousTrip.operator_name
          : previousTrip.operator_name ?? nextTrip?.operator_name ?? null,
      sameAssignment: true,
    };
  }

  const previousAssignments = getTripAssignments(
    previousTrip,
    dutyAssignmentsByPublicTripId,
  );
  const nextAssignments = getTripAssignments(
    nextTrip,
    dutyAssignmentsByPublicTripId,
  );

  const sharedDuty = previousAssignments.find((previousAssignment) =>
    nextAssignments.some(
      (nextAssignment) =>
        previousAssignment.dutyId != null &&
        nextAssignment.dutyId != null &&
        String(previousAssignment.dutyId) === String(nextAssignment.dutyId),
    ),
  );

  if (sharedDuty) {
    return {
      dutyId: sharedDuty.dutyId ?? null,
      operatorId: sharedDuty.operatorId ?? null,
      operatorName: sharedDuty.operatorName ?? null,
      sameAssignment: true,
    };
  }

  const sharedOperator = previousAssignments.find((previousAssignment) =>
    nextAssignments.some(
      (nextAssignment) =>
        previousAssignment.operatorId != null &&
        nextAssignment.operatorId != null &&
        String(previousAssignment.operatorId) ===
          String(nextAssignment.operatorId),
    ),
  );

  if (sharedOperator) {
    return {
      dutyId: sharedOperator.dutyId ?? null,
      operatorId: sharedOperator.operatorId ?? null,
      operatorName: sharedOperator.operatorName ?? null,
      sameAssignment: true,
    };
  }

  return {
    dutyId: null,
    operatorId: null,
    operatorName: null,
    sameAssignment: false,
  };
}

export function buildTripIntervalDisplayRow({
  start,
  end,
  previousTrip,
  nextTrip,
  boundaryKind,
  policy,
  viewScope,
  defaultAssignment,
  dutyAssignmentsByPublicTripId,
  mealBreakIntervalKeys,
}: {
  start: number;
  end: number;
  previousTrip?: TripDetail;
  nextTrip?: TripDetail;
  boundaryKind?: 'initial' | 'final';
  policy: TripIntervalPolicy;
  viewScope: TripIntervalViewScope;
  defaultAssignment?: DutyTripAssignment | null;
  dutyAssignmentsByPublicTripId?: Record<number, DutyTripAssignment[]>;
  mealBreakIntervalKeys?: Set<string>;
}): TripIntervalDisplayRow | null {
  const duration = Math.max(0, end - start);
  if (duration <= 0) return null;

  const originId = previousTrip?.destination_id ?? nextTrip?.origin_id ?? null;
  const destinationId = nextTrip?.origin_id ?? previousTrip?.destination_id ?? null;
  const originName = previousTrip?.destination_name ?? nextTrip?.origin_name;
  const destinationName = nextTrip?.origin_name ?? previousTrip?.destination_name;
  const sameTerminal =
    originId != null &&
    destinationId != null &&
    String(originId) === String(destinationId);
  const assignmentContext = resolveTripIntervalAssignmentContext({
    previousTrip,
    nextTrip,
    defaultAssignment,
    dutyAssignmentsByPublicTripId,
  });
  const mealBreakIntervalKey =
    previousTrip && nextTrip && assignmentContext.dutyId != null
      ? buildDutyMealBreakIntervalKey(
          assignmentContext.dutyId,
          previousTrip,
          nextTrip,
        )
      : null;
  const isMealBreakWindow =
    mealBreakIntervalKey != null &&
    (mealBreakIntervalKeys?.has(mealBreakIntervalKey) ?? false);
  const classification = classifyTripInterval({
    gapMinutes: duration,
    isBoundary: boundaryKind != null,
    isMealBreakWindow:
      viewScope === 'crew' &&
      previousTrip != null &&
      nextTrip != null &&
      assignmentContext.sameAssignment &&
      sameTerminal &&
      isMealBreakWindow,
    viewScope,
  });
  const previousTripId = previousTrip ? getTripPublicId(previousTrip) : null;
  const nextTripId = nextTrip ? getTripPublicId(nextTrip) : null;

  let recordLabel = 'Janela intermediária';
  let recordHint = 'Intervalo derivado da sequência real de viagens.';

  if (boundaryKind === 'initial') {
    recordLabel = 'Janela inicial';
    recordHint =
      viewScope === 'crew'
        ? 'Janela ociosa antes da primeira viagem da jornada.'
        : 'Janela ociosa do veículo antes da primeira viagem do bloco.';
  } else if (boundaryKind === 'final') {
    recordLabel = 'Janela final';
    recordHint =
      viewScope === 'crew'
        ? 'Janela ociosa após a última viagem da jornada.'
        : 'Janela ociosa do veículo após a última viagem do bloco.';
  } else if (previousTripId != null && nextTripId != null) {
    recordLabel = `Entre #${previousTripId} e #${nextTripId}`;
    if (viewScope === 'vehicle') {
      if (!assignmentContext.sameAssignment) {
        recordHint =
          'Troca de tripulante entre viagens; para o veículo isso segue como intervalo operacional.';
      } else if (!sameTerminal) {
        recordHint =
          'Troca de terminal no bloco; intervalo operacional entre viagens do veículo.';
      } else if (duration <= policy.connectionToleranceMinutes) {
        recordHint = `Conexão curta do veículo dentro da tolerância (${policy.connectionToleranceMinutes} min).`;
      } else if (duration < policy.minLayoverMinutes) {
        recordHint = `Intervalo do veículo abaixo do layover alvo (${policy.minLayoverMinutes} min).`;
      } else {
        recordHint =
          'Intervalo operacional normal entre viagens do veículo.';
      }
    } else if (!assignmentContext.sameAssignment) {
      recordHint =
        'Troca de plantão/tripulante entre viagens; não caracteriza pausa regulatória da mesma jornada.';
    } else if (!sameTerminal) {
      recordHint =
        'Troca de terminal entre viagens; não é pausa regulatória.';
    } else if (classification === 'descanso_refeicao') {
      const operatorSuffix = assignmentContext.operatorName
        ? ` para ${assignmentContext.operatorName}`
        : '';
      recordHint = `Pausa regulatória reconhecida${operatorSuffix} nesta jornada.`;
    } else if (
      policy.mealBreakMinutes > 0 &&
      duration + policy.connectionToleranceMinutes >= policy.mealBreakMinutes
    ) {
      recordHint =
        'Janela longa no mesmo terminal, mas a jornada já utilizou outra pausa como descanso/refeição real.';
    } else if (duration <= policy.connectionToleranceMinutes) {
      recordHint = `Mesmo terminal; conexão curta dentro da tolerância (${policy.connectionToleranceMinutes} min).`;
    } else if (duration < policy.minLayoverMinutes) {
      recordHint = `Mesmo terminal; conexão abaixo do layover alvo (${policy.minLayoverMinutes} min).`;
    } else {
      recordHint =
        'Mesmo terminal; intervalo operacional normal entre viagens.';
    }
  }

  return {
    classification,
    start,
    end,
    originId,
    destinationId,
    originName,
    destinationName,
    duration,
    recordLabel,
    recordHint,
  };
}
