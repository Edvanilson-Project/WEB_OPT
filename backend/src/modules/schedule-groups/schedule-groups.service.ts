import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ScheduleGroupEntity } from './entities/schedule-group.entity';
import { ScheduleGroupItemEntity } from './entities/schedule-group-item.entity';
import { CreateScheduleGroupDto } from './dto/create-schedule-group.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class ScheduleGroupsService {
  constructor(
    @InjectRepository(ScheduleGroupEntity)
    private readonly groupRepo: Repository<ScheduleGroupEntity>,
    @InjectRepository(ScheduleGroupItemEntity)
    private readonly itemRepo: Repository<ScheduleGroupItemEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateScheduleGroupDto): Promise<ScheduleGroupEntity> {
    const group = this.groupRepo.create({
      name: dto.name,
      description: dto.description,
      companyId: dto.companyId,
      status: 'draft',
    });
    const saved = await this.groupRepo.save(group);

    if (dto.scheduleIds?.length) {
      const items = dto.scheduleIds.map((sid) =>
        this.itemRepo.create({ scheduleGroupId: saved.id, scheduleId: sid }),
      );
      await this.itemRepo.save(items);
    }

    return saved;
  }

  async findAll(companyId?: number): Promise<any[]> {
    const groups = await this.groupRepo.find({
      where: companyId ? { companyId } : {},
      order: { createdAt: 'DESC' },
    });

    if (!groups.length) return [];

    const allItems = await this.itemRepo.find({
      where: { scheduleGroupId: In(groups.map((g) => g.id)) },
    });

    const itemsByGroup = new Map<number, number[]>();
    for (const item of allItems) {
      const list = itemsByGroup.get(item.scheduleGroupId) ?? [];
      list.push(item.scheduleId);
      itemsByGroup.set(item.scheduleGroupId, list);
    }

    return groups.map((g) => ({
      ...g,
      scheduleIds: itemsByGroup.get(g.id) ?? [],
    }));
  }

  async findOne(id: number): Promise<any> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new EntityNotFoundException('ScheduleGroup', id);

    const items = await this.itemRepo.find({
      where: { scheduleGroupId: id },
    });

    return { ...group, scheduleIds: items.map((i) => i.scheduleId) };
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.itemRepo.delete({ scheduleGroupId: id });
    await this.groupRepo.delete(id);
  }

  /**
   * Gera viagens automaticamente a partir dos quadros horários do grupo.
   *
   * Para cada schedule no grupo:
   *   1. Busca a linha (origin/destination terminals)
   *   2. Busca timetable_rules (headway por faixa)
   *   3. Busca line_trip_profiles (duração por sentido+faixa)
   *   4. Gera departures IDA e VOLTA alternadas pelo headway
   *   5. Marca primeira viagem como pullout e última como pullback
   *   6. Calcula tempo ocioso entre viagens
   *   7. Salva trips na tabela trips com schedule_group_id
   */
  async generateTrips(
    groupId: number,
  ): Promise<{ totalTrips: number; tripsByLine: Record<string, number> }> {
    const group = await this.findOne(groupId);
    if (!group.scheduleIds?.length) {
      throw new BadRequestException(
        'Grupo não tem quadros horários vinculados',
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Limpar trips anteriores deste grupo
      await qr.query(`DELETE FROM trips WHERE schedule_group_id = $1`, [
        groupId,
      ]);

      let totalTrips = 0;
      const tripsByLine: Record<string, number> = {};
      let tripIdCounter = 0;

      // ── B-M3: Batch fetch schedules, rules, profiles to avoid N+1 ──
      const schedules = await qr.query(
        `SELECT s.*, l.code as line_code, l.name as line_name,
                l.origin_terminal_id, l.destination_terminal_id,
                l.distance_km, l.avg_trip_duration_minutes,
                l.pullout_duration_minutes, l.pullback_duration_minutes
         FROM schedules s
         JOIN lines l ON l.id = s.line_id
         WHERE s.id = ANY($1)`,
        [group.scheduleIds],
      );
      const scheduleMap = new Map(schedules.map((s: any) => [Number(s.id), s]));

      const allRules = schedules.length
        ? await qr.query(
            `SELECT tr.*, tb.name as band_name, tb.start_minutes, tb.end_minutes, tb.is_peak
             FROM timetable_rules tr
             JOIN time_bands tb ON tb.id = tr.time_band_id
             WHERE tr.schedule_id = ANY($1)
             ORDER BY tr.schedule_id, tb.start_minutes`,
            [group.scheduleIds],
          )
        : [];
      const rulesMap = new Map<number, any[]>();
      for (const r of allRules) {
        const sid = Number(r.schedule_id);
        if (!rulesMap.has(sid)) rulesMap.set(sid, []);
        rulesMap.get(sid)!.push(r);
      }

      const lineIds = [...new Set(schedules.map((s: any) => Number(s.line_id)))];
      const allProfiles = lineIds.length
        ? await qr.query(
            `SELECT * FROM line_trip_profiles WHERE line_id = ANY($1)`,
            [lineIds],
          )
        : [];
      const profilesByLine = new Map<number, any[]>();
      for (const p of allProfiles) {
        const lid = Number(p.line_id);
        if (!profilesByLine.has(lid)) profilesByLine.set(lid, []);
        profilesByLine.get(lid)!.push(p);
      }

      for (const scheduleId of group.scheduleIds) {
        const schedule: any = scheduleMap.get(Number(scheduleId));
        if (!schedule) continue;

        const rules = rulesMap.get(Number(scheduleId)) || [];
        if (!rules.length) continue;

        const profiles = profilesByLine.get(Number(schedule.line_id)) || [];

        // Mapear perfis: { "outbound_3": { duration: 45, ... } }
        const profileMap: Record<string, any> = {};
        for (const p of profiles) {
          profileMap[`${p.direction}_${p.time_band_id}`] = p;
        }

        // Gerar viagens
        const lineTrips: any[] = [];
        const pullout = Number(schedule.pullout_duration_minutes) || 10;
        const pullback = Number(schedule.pullback_duration_minutes) || 10;
        const avgDuration = Number(schedule.avg_trip_duration_minutes) || 40;

        for (const rule of rules) {
          const bandStart = Number(rule.start_minutes);
          const bandEnd = Number(rule.end_minutes);
          const headway = Number(rule.headway_minutes);
          if (headway <= 0) continue;

          let departTime = bandStart;
          let direction: 'outbound' | 'return' = 'outbound';

          while (departTime < bandEnd) {
            // Buscar perfil específico ou usar média
            const profileKey = `${direction}_${rule.time_band_id}`;
            const profile = profileMap[profileKey];
            const duration = profile
              ? Number(profile.trip_duration_minutes)
              : avgDuration;
            // distance_km disponível em profile.distance_km ou schedule.distance_km (não usado aqui)
            const demand = profile ? Number(profile.passenger_demand || 0) : 0;

            const originId =
              direction === 'outbound'
                ? Number(schedule.origin_terminal_id)
                : Number(schedule.destination_terminal_id);
            const destId =
              direction === 'outbound'
                ? Number(schedule.destination_terminal_id)
                : Number(schedule.origin_terminal_id);

            tripIdCounter++;
            const tripCode = `${schedule.line_code}-${String(tripIdCounter).padStart(4, '0')}`;

            lineTrips.push({
              tripCode,
              lineId: Number(schedule.line_id),
              scheduleId,
              direction,
              startTimeMinutes: departTime,
              endTimeMinutes: departTime + duration,
              durationMinutes: duration,
              originTerminalId: originId,
              destinationTerminalId: destId,
              passengerCount: demand,
              companyId: group.companyId,
              scheduleGroupId: groupId,
              timetableRuleId: Number(rule.id),
              isPullOut: false,
              isPullBack: false,
              idleBeforeMinutes: 0,
              idleAfterMinutes: 0,
            });

            departTime += headway;
            // Alternar sentido a cada viagem para realismo
            direction = direction === 'outbound' ? 'return' : 'outbound';
          }
        }

        if (lineTrips.length === 0) continue;

        // Ordenar por horário
        lineTrips.sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);

        // Marcar pull-out na primeira e pull-back na última viagem
        lineTrips[0].isPullOut = true;
        lineTrips[0].idleBeforeMinutes = pullout;
        lineTrips[lineTrips.length - 1].isPullBack = true;
        lineTrips[lineTrips.length - 1].idleAfterMinutes = pullback;

        // Calcular tempo ocioso entre viagens (para detectar split shifts)
        for (let i = 1; i < lineTrips.length; i++) {
          const prevEnd = lineTrips[i - 1].endTimeMinutes;
          const currStart = lineTrips[i].startTimeMinutes;
          const idle = currStart - prevEnd;
          if (idle > 0) {
            lineTrips[i].idleBeforeMinutes = idle;
          }
        }

        // Criar trip_group_id para viagens casadas (ida/volta consecutivas)
        let groupCounter = 1;
        for (let i = 0; i < lineTrips.length - 1; i += 2) {
          lineTrips[i].tripGroupId = groupCounter;
          if (i + 1 < lineTrips.length) {
            lineTrips[i + 1].tripGroupId = groupCounter;
          }
          groupCounter++;
        }

        // Inserir no banco
        for (const trip of lineTrips) {
          await qr.query(
            `INSERT INTO trips (
              company_id, trip_code, line_id, schedule_id, direction,
              start_time_minutes, end_time_minutes, duration_minutes,
              origin_terminal_id, destination_terminal_id, passenger_count,
              schedule_group_id, timetable_rule_id,
              is_pull_out, is_pull_back, idle_before_minutes, idle_after_minutes,
              trip_group_id, is_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
            [
              trip.companyId,
              trip.tripCode,
              trip.lineId,
              trip.scheduleId,
              trip.direction,
              trip.startTimeMinutes,
              trip.endTimeMinutes,
              trip.durationMinutes,
              trip.originTerminalId,
              trip.destinationTerminalId,
              trip.passengerCount,
              trip.scheduleGroupId,
              trip.timetableRuleId,
              trip.isPullOut,
              trip.isPullBack,
              trip.idleBeforeMinutes,
              trip.idleAfterMinutes,
              trip.tripGroupId || null,
              true,
            ],
          );
        }

        const lineName = `${schedule.line_code} - ${schedule.line_name}`;
        tripsByLine[lineName] = lineTrips.length;
        totalTrips += lineTrips.length;
      }

      // Atualizar status do grupo
      await qr.query(
        `UPDATE schedule_groups SET status = 'ready', updated_at = NOW() WHERE id = $1`,
        [groupId],
      );

      await qr.commitTransaction();
      return { totalTrips, tripsByLine };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * Retorna todas as viagens geradas para este grupo, editáveis.
   */
  async getTrips(groupId: number): Promise<any[]> {
    return this.dataSource.query(
      `SELECT t.*, l.code as line_code, l.name as line_name
       FROM trips t
       JOIN lines l ON l.id = t.line_id
       WHERE t.schedule_group_id = $1 AND t.is_active = true
       ORDER BY t.line_id, t.start_time_minutes`,
      [groupId],
    );
  }
}
