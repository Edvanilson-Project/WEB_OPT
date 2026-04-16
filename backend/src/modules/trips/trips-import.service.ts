import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { TripsRepository } from './repositories/trips.repository';
import { LinesRepository } from '../lines/repositories/lines.repository';
import { TripEntity, TripDirection } from './entities/trip.entity';

/**
 * Serviço de Importação de Viagens (SRP: Gerencia o parse de arquivos e a validação de schema operacional).
 * 
 * Utiliza o context multi-tenant para garantir que dados órfãos ou de outras empresas
 * nunca sejam processados.
 */
@Injectable()
export class TripsImportService {
  private readonly logger = new Logger(TripsImportService.name);

  constructor(
    private readonly tripsRepo: TripsRepository,
    private readonly linesRepo: LinesRepository,
  ) {}

  /**
   * Processa o arquivo (CSV/XLSX) e importa as viagens para o contexto da empresa.
   * 
   * @param buffer Buffer do arquivo enviado
   * @param companyId ID da empresa (utilizado para logging e validação redundante)
   */
  async importFromBuffer(buffer: Buffer, companyId: number): Promise<{ success: number; errors: string[] }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const datasheet = workbook.Sheets[sheetName];
    
    // Converte para JSON (array de objetos)
    const rawData = XLSX.utils.sheet_to_json<any>(datasheet);
    
    if (!rawData.length) {
      throw new BadRequestException('O arquivo enviado está vazio.');
    }

    const tripsToSave: Partial<TripEntity>[] = [];
    const errors: string[] = [];
    
    // Cache de linhas para evitar múltiplas queries repetitivas
    const lineCache = new Map<string, number>();

    this.logger.log(`Iniciando processamento de ${rawData.length} registros para empresa #${companyId}`);

    for (const [index, row] of rawData.entries()) {
      const rowNum = index + 2; // +1 para 0-index, +1 para header
      
      try {
        // 1. Mapeamento de Linha (Alias Mapping)
        const lineIdentifier = row['Linha'] || row['line'] || row['COD_LINHA'];
        if (!lineIdentifier) {
          errors.push(`Linha ${rowNum}: Identificador de linha ausente.`);
          continue;
        }

        let lineId = lineCache.get(String(lineIdentifier));
        if (!lineId) {
          // Busca rigorosa no contexto da empresa logada (via LinesRepository + ALS)
          const line = await this.linesRepo.findOne({
            where: [
              { code: String(lineIdentifier) },
              { name: String(lineIdentifier) }
            ] as any
          });

          if (!line) {
            errors.push(`Linha ${rowNum}: Linha '${lineIdentifier}' não encontrada ou sem acesso.`);
            continue;
          }
          lineId = line.id;
          lineCache.set(String(lineIdentifier), lineId);
        }

        // 2. Normalização de Horários
        const startTimeRaw = row['Hora Início'] || row['start_time'];
        const endTimeRaw = row['Hora Fim'] || row['end_time'];
        
        if (!startTimeRaw || !endTimeRaw) {
          errors.push(`Linha ${rowNum}: Horários de início/fim obrigatórios.`);
          continue;
        }

        const startTimeMinutes = this.normalizeTimeToMinutes(startTimeRaw);
        const endTimeMinutes = this.normalizeTimeToMinutes(endTimeRaw);
        
        // Suporte para virada de dia (EndTime < StartTime indica que termina no dia seguinte)
        let finalEndTime = endTimeMinutes;
        if (finalEndTime < startTimeMinutes) {
          finalEndTime += 1440; // +24h
        }

        const duration = finalEndTime - startTimeMinutes;

        // 3. Direção
        const directionRaw = (row['Sentido'] || row['direction'] || '').toLowerCase();
        const direction = directionRaw.includes('volat') || directionRaw === 'return' 
          ? TripDirection.RETURN 
          : TripDirection.OUTBOUND;

        tripsToSave.push({
          lineId,
          startTimeMinutes,
          endTimeMinutes: finalEndTime,
          durationMinutes: duration,
          direction,
          tripCode: row['Viagem'] || row['trip_code'] || `${lineIdentifier}-${startTimeMinutes}`,
          companyId, // Garantia final (embora o BaseRepo já trate)
        });

      } catch (err) {
        errors.push(`Linha ${rowNum}: Erro inesperado: ${err.message}`);
      }
    }

    if (tripsToSave.length > 0) {
      // Bulk Insert usando o BaseRepository
      const promises = tripsToSave.map(trip => this.tripsRepo.create(trip as any));
      await Promise.all(promises);
    }

    return {
      success: tripsToSave.length,
      errors
    };
  }

  /**
   * Converte formatos variados (HH:mm, HH:mm:ss, strings ou números de Excel) para minutos.
   */
  private normalizeTimeToMinutes(time: any): number {
    if (typeof time === 'number') {
      // Excel armazena tempo como fração do dia (0.5 = 12:00)
      return Math.round(time * 1440);
    }

    const timeStr = String(time).trim();
    const parts = timeStr.split(':');
    
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      return hours * 60 + minutes;
    }

    throw new Error(`Formato de hora inválido: ${time}`);
  }
}
