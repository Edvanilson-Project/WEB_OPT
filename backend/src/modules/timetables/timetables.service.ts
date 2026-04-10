import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimetableEntity } from './entities/timetable.entity';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { TripTimeBandEntity } from '../trip-time-configs/entities/trip-time-band.entity';
import { PassengerBandEntity } from '../passenger-configs/entities/passenger-band.entity';
import { TripEntity, TripDirection } from '../trips/entities/trip.entity';
import { LineEntity, LineOperationMode } from '../lines/entities/line.entity';

@Injectable()
export class TimetablesService {
  constructor(
    @InjectRepository(TimetableEntity)
    private readonly repo: Repository<TimetableEntity>,
    @InjectRepository(TripTimeBandEntity)
    private readonly timeBandRepo: Repository<TripTimeBandEntity>,
    @InjectRepository(PassengerBandEntity)
    private readonly passBandRepo: Repository<PassengerBandEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepo: Repository<TripEntity>,
    @InjectRepository(LineEntity)
    private readonly lineRepo: Repository<LineEntity>,
  ) {}

  async create(dto: CreateTimetableDto) {
    const timetable = this.repo.create(dto);
    return this.repo.save(timetable);
  }

  async findAll(companyId?: number) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return this.repo.find({ where, order: { id: 'DESC' } });
  }

  async findOne(id: number) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Carta horária não encontrada');
    return t;
  }

  async update(id: number, dto: Partial<CreateTimetableDto>) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    // remove trips linked to this timetable (transação garante atomicidade)
    return this.repo.manager.transaction(async (em) => {
      await em.delete(TripEntity, { timetableId: id });
      return em.delete(TimetableEntity, id);
    });
  }

  /**
   * Gerar viagens da Carta Horária
   *
   * Metodologia de Planejamento de Transporte:
   *
   *  1. Frequência por faixa e direção:
   *     F = ceil(D_max / (C × f_o))
   *     - D_max = demanda na seção de carga máxima
   *     - C = capacidade do veículo
   *     - f_o = fator de ocupação (85%, evita superlotação)
   *
   *  2. Pareamento (ciclo operacional):
   *     T_ciclo = T_ida + T_terminal_destino + T_volta + T_terminal_origem
   *     - Partida volta = Chegada ida (pareamento direto)
   *     - Tempo de terminal é metadado (idle_after/idle_before), não altera horário de partida
   *
   *  3. Quantidade de pares = max(F_ida, F_volta) por faixa
   *     - Sentido com menos demanda terá ocupação menor (sem desperdício de viagem)
   *
   *  4. Dimensionamento de frota:
   *     N = T_ciclo / headway
   *
   *  5. Headway não precisa ser redondo (valores fracionários arredondados ao minuto)
   */
  async generateTrips(timetableId: number) {
    const timetable = await this.findOne(timetableId);

    const timeBands = await this.timeBandRepo.find({
      where: { configId: timetable.tripTimeConfigId },
      order: { startMinutes: 'ASC' },
    });
    const passBands = await this.passBandRepo.find({
      where: { configId: timetable.passengerConfigId },
      order: { startMinutes: 'ASC' },
    });

    const line = await this.lineRepo.findOne({
      where: { id: timetable.lineId },
    });
    if (!line) throw new NotFoundException('Linha não encontrada');

    let vehicleCapacity = 80;
    if (timetable.vehicleTypeId) {
      const vtResult = await this.repo.query(
        'SELECT passenger_capacity FROM vehicle_types WHERE id = $1',
        [timetable.vehicleTypeId],
      );
      if (vtResult.length > 0)
        vehicleCapacity = vtResult[0].passenger_capacity || 80;
    }

    // Fator de ocupação: 85% para não exceder capacidade máxima
    const OCCUPANCY_FACTOR = 0.85;
    const effectiveCapacity = Math.floor(vehicleCapacity * OCCUPANCY_FACTOR);

    // Remover trips anteriores desta carta
    await this.tripRepo
      .createQueryBuilder()
      .delete()
      .where('timetable_id = :tid', { tid: timetableId })
      .execute();

    const trips: Partial<TripEntity>[] = [];
    let tripGroupId = timetableId * 10000;
    let maxFleetNeeded = 0;

    const operationMode = line.operationMode || LineOperationMode.ROUNDTRIP;

    // ── Helper: buscar duração da faixa mais próxima que tenha a direção faltante ──
    const findNearestDuration = (
      refStartMinutes: number,
      direction: 'outbound' | 'return',
    ): { duration: number; idle: number } => {
      let bestDuration = 0;
      let bestIdle = 0;
      let bestDist = Infinity;
      for (const other of timeBands) {
        const dur =
          direction === 'outbound'
            ? other.tripDurationOutbound
            : other.tripDurationReturn;
        if (dur > 0) {
          const dist = Math.abs(other.startMinutes - refStartMinutes);
          if (dist < bestDist) {
            bestDist = dist;
            bestDuration = dur;
            bestIdle =
              direction === 'outbound'
                ? other.idleMinutesOutbound || 0
                : other.idleMinutesReturn || 0;
          }
        }
      }
      return { duration: bestDuration, idle: bestIdle };
    };

    // ── Pré-processamento: consolidar faixas consecutivas de direção única ──
    // Quando faixas adjacentes só têm ida (ou só volta), elas são consolidadas
    // para evitar viagens desnecessárias em horários de baixa demanda.
    // Ex: 03:00-04:00 (50pax) + 04:00-05:00 (87pax) → 1 viagem às 04:30
    interface ProcessableBand {
      startMinutes: number;
      endMinutes: number;
      durationOut: number;
      durationRet: number;
      idleOut: number;
      idleRet: number;
      demandOut: number;
      demandRet: number;
      isMerged: boolean;
    }

    const rawBands: ProcessableBand[] = timeBands.map((tb) => {
      const pb = passBands.find(
        (p) =>
          p.startMinutes === tb.startMinutes && p.endMinutes === tb.endMinutes,
      );
      return {
        startMinutes: tb.startMinutes,
        endMinutes: tb.endMinutes,
        durationOut: tb.tripDurationOutbound,
        durationRet: tb.tripDurationReturn,
        idleOut: tb.idleMinutesOutbound || 0,
        idleRet: tb.idleMinutesReturn || 0,
        demandOut: pb?.passengersOutbound || 0,
        demandRet: pb?.passengersReturn || 0,
        isMerged: false,
      };
    });

    const consolidateBands = (bands: ProcessableBand[]): ProcessableBand[] => {
      if (operationMode !== LineOperationMode.ROUNDTRIP) return bands;

      const result: ProcessableBand[] = [];
      let i = 0;
      while (i < bands.length) {
        const b = bands[i];
        const isOutOnly = b.durationOut > 0 && !b.durationRet;
        const isRetOnly = b.durationRet > 0 && !b.durationOut;

        if (!isOutOnly && !isRetOnly) {
          result.push(b);
          i++;
          continue;
        }

        // Agrupar faixas consecutivas com mesmo padrão
        const group = [b];
        let j = i + 1;
        while (j < bands.length) {
          const next = bands[j];
          const nextOutOnly = next.durationOut > 0 && !next.durationRet;
          const nextRetOnly = next.durationRet > 0 && !next.durationOut;
          if ((isOutOnly && nextOutOnly) || (isRetOnly && nextRetOnly)) {
            group.push(next);
            j++;
          } else {
            break;
          }
        }

        if (group.length === 1) {
          result.push(b);
          i = j;
          continue;
        }

        // Consolidar grupo:
        // - Demanda = média por faixa (passageiros se distribuem no tempo)
        // - Duração = média ponderada das durações
        // - Partida no 3/4 da janela (acumula passageiros antes de sair)
        const windowStart = group[0].startMinutes;
        const windowEnd = group[group.length - 1].endMinutes;
        const totalDemandOut = group.reduce((s, g) => s + g.demandOut, 0);
        const totalDemandRet = group.reduce((s, g) => s + g.demandRet, 0);
        const durOutVals = group.filter((g) => g.durationOut > 0);
        const durRetVals = group.filter((g) => g.durationRet > 0);

        const effectiveStart = Math.round(
          windowStart + (windowEnd - windowStart) * 0.75,
        );

        result.push({
          startMinutes: effectiveStart,
          endMinutes: windowEnd,
          durationOut:
            durOutVals.length > 0
              ? Math.round(
                  durOutVals.reduce((s, g) => s + g.durationOut, 0) /
                    durOutVals.length,
                )
              : 0,
          durationRet:
            durRetVals.length > 0
              ? Math.round(
                  durRetVals.reduce((s, g) => s + g.durationRet, 0) /
                    durRetVals.length,
                )
              : 0,
          idleOut: Math.max(...group.map((g) => g.idleOut)),
          idleRet: Math.max(...group.map((g) => g.idleRet)),
          demandOut: Math.round(totalDemandOut / group.length),
          demandRet: Math.round(totalDemandRet / group.length),
          isMerged: true,
        });

        i = j;
      }
      return result;
    };

    const processableBands = consolidateBands(rawBands);

    for (const band of processableBands) {
      let durationOut = band.durationOut;
      let durationRet = band.durationRet;
      if (!durationOut && !durationRet) continue;

      const demandOut = band.demandOut;
      const demandRet = band.demandRet;
      const bandDuration = band.endMinutes - band.startMinutes;
      let idleOut = band.idleOut;
      let idleRet = band.idleRet;

      // ── Modo roundtrip: preencher direção faltante com a faixa mais próxima ──
      if (operationMode === LineOperationMode.ROUNDTRIP) {
        if (durationOut > 0 && !durationRet) {
          const nearest = findNearestDuration(band.startMinutes, 'return');
          durationRet = nearest.duration;
          idleRet = nearest.idle;
        } else if (durationRet > 0 && !durationOut) {
          const nearest = findNearestDuration(band.startMinutes, 'outbound');
          durationOut = nearest.duration;
          idleOut = nearest.idle;
        }
      }

      // ── Modo outbound_only / return_only: ignorar a direção oposta ──
      if (operationMode === LineOperationMode.OUTBOUND_ONLY) {
        durationRet = 0;
      } else if (operationMode === LineOperationMode.RETURN_ONLY) {
        durationOut = 0;
      }

      if (!durationOut && !durationRet) continue;

      // Capacidade para frequência:
      // Faixas consolidadas usam capacidade total (baixa demanda, sem risco de lotação)
      // Faixas normais usam capacidade efetiva (com fator de ocupação 85%)
      const capForFreq = band.isMerged ? vehicleCapacity : effectiveCapacity;

      // Frequência por direção: F = ceil(D_max / C)
      const freqOut =
        durationOut > 0 ? Math.max(1, Math.ceil(demandOut / capForFreq)) : 0;
      const freqRet =
        durationRet > 0 ? Math.max(1, Math.ceil(demandRet / capForFreq)) : 0;

      const bothDirections = durationOut > 0 && durationRet > 0;

      if (bothDirections) {
        // Número de pares = max(F_ida, F_volta)
        const numPairs = Math.max(freqOut, freqRet);
        const headway = numPairs > 1 ? bandDuration / numPairs : bandDuration;

        // Passageiros por viagem (demanda ÷ numPares, limitado à capacidade)
        const paxPerOut = Math.min(
          Math.ceil(demandOut / numPairs),
          vehicleCapacity,
        );
        const paxPerRet = Math.min(
          Math.ceil(demandRet / numPairs),
          vehicleCapacity,
        );

        // T_ciclo = T_ida + T_terminal_destino + T_volta + T_terminal_origem
        const cycleTime = durationOut + idleOut + durationRet + idleRet;

        // Frota necessária para esta faixa: N = T_ciclo / headway
        const fleetForBand = Math.ceil(cycleTime / headway);
        maxFleetNeeded = Math.max(maxFleetNeeded, fleetForBand);

        for (let i = 0; i < numPairs; i++) {
          tripGroupId++;
          const departOut = band.startMinutes + Math.round(i * headway);
          const arriveOut = departOut + durationOut;

          // ===== VIAGEM IDA =====
          trips.push({
            companyId: timetable.companyId,
            lineId: timetable.lineId,
            timetableId,
            direction: TripDirection.OUTBOUND,
            startTimeMinutes: departOut,
            endTimeMinutes: arriveOut,
            durationMinutes: durationOut,
            idleAfterMinutes: idleOut,
            idleBeforeMinutes: 0,
            originTerminalId: line.originTerminalId,
            destinationTerminalId: line.destinationTerminalId,
            passengerCount: paxPerOut,
            tripGroupId,
            isPullOut: false,
            isPullBack: false,
            isActive: true,
          } as any);

          // ===== VIAGEM VOLTA PAREADA =====
          // Partida volta = Chegada ida (pareamento direto)
          const departRet = arriveOut;
          const arriveRet = departRet + durationRet;

          trips.push({
            companyId: timetable.companyId,
            lineId: timetable.lineId,
            timetableId,
            direction: TripDirection.RETURN,
            startTimeMinutes: departRet,
            endTimeMinutes: arriveRet,
            durationMinutes: durationRet,
            idleAfterMinutes: idleRet,
            idleBeforeMinutes: idleOut,
            originTerminalId: line.destinationTerminalId,
            destinationTerminalId: line.originTerminalId,
            passengerCount: paxPerRet,
            tripGroupId,
            isPullOut: false,
            isPullBack: false,
            isActive: true,
          } as any);
        }
      } else if (durationOut > 0) {
        // Faixa SOMENTE IDA (modo flexible/outbound_only)
        const numTrips = freqOut;
        const headway = numTrips > 1 ? bandDuration / numTrips : bandDuration;
        const paxPer = Math.min(
          Math.ceil(demandOut / numTrips),
          vehicleCapacity,
        );

        for (let i = 0; i < numTrips; i++) {
          tripGroupId++;
          const depart = band.startMinutes + Math.round(i * headway);
          trips.push({
            companyId: timetable.companyId,
            lineId: timetable.lineId,
            timetableId,
            direction: TripDirection.OUTBOUND,
            startTimeMinutes: depart,
            endTimeMinutes: depart + durationOut,
            durationMinutes: durationOut,
            idleAfterMinutes: idleOut,
            idleBeforeMinutes: 0,
            originTerminalId: line.originTerminalId,
            destinationTerminalId: line.destinationTerminalId,
            passengerCount: paxPer,
            tripGroupId,
            isPullOut: false,
            isPullBack: false,
            isActive: true,
          } as any);
        }
      } else {
        // Faixa SOMENTE VOLTA (modo flexible/return_only)
        const numTrips = freqRet;
        const headway = numTrips > 1 ? bandDuration / numTrips : bandDuration;
        const paxPer = Math.min(
          Math.ceil(demandRet / numTrips),
          vehicleCapacity,
        );

        for (let i = 0; i < numTrips; i++) {
          tripGroupId++;
          const depart = band.startMinutes + Math.round(i * headway);
          trips.push({
            companyId: timetable.companyId,
            lineId: timetable.lineId,
            timetableId,
            direction: TripDirection.RETURN,
            startTimeMinutes: depart,
            endTimeMinutes: depart + durationRet,
            durationMinutes: durationRet,
            idleAfterMinutes: idleRet,
            idleBeforeMinutes: 0,
            originTerminalId: line.destinationTerminalId,
            destinationTerminalId: line.originTerminalId,
            passengerCount: paxPer,
            tripGroupId,
            isPullOut: false,
            isPullBack: false,
            isActive: true,
          } as any);
        }
      }
    }

    // Marcar primeira viagem como saída e última como recolhimento
    if (trips.length > 0) {
      trips[0].isPullOut = true;
      trips[trips.length - 1].isPullBack = true;
    }

    // Bulk insert para performance (em lotes de 500) — transacional
    const BATCH = 500;
    let totalSaved = 0;
    await this.repo.manager.transaction(async (em) => {
      for (let i = 0; i < trips.length; i += BATCH) {
        const batch = trips.slice(i, i + BATCH);
        await em
          .createQueryBuilder()
          .insert()
          .into(TripEntity)
          .values(batch as any[])
          .execute();
        totalSaved += batch.length;
      }
      await em.update(this.repo.target, timetableId, { status: 'active' });
    });

    const totalOut = trips.filter(
      (t) => t.direction === TripDirection.OUTBOUND,
    ).length;
    const totalRet = trips.filter(
      (t) => t.direction === TripDirection.RETURN,
    ).length;

    return {
      totalTrips: totalSaved,
      timetableId,
      outbound: totalOut,
      return: totalRet,
      vehicleCapacity,
      occupancyFactor: OCCUPANCY_FACTOR,
      effectiveCapacity,
      maxFleetEstimate: maxFleetNeeded,
    };
  }

  async getTrips(timetableId: number) {
    return this.tripRepo.find({
      where: { timetableId } as any,
      order: { startTimeMinutes: 'ASC' },
    });
  }
}
