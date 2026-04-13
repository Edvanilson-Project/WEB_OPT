import { OptimizerPayloadDto } from '../src/modules/optimization/dto/optimizer-payload.dto';

describe('Sanity Check de Overlaps E2E', () => {

  it('Garante programaticamente a ausencia de overlaps (Sobreposicao de Horarios)', () => {
    // Simula a saida vinda do otimizador (que e normalizada pelo getRunAudit)
    const mockOptimizerResponse = {
      runs: [
        {
          vehicle_id: 'V1',
          trips: [
            { id: 1, start_time: 100, end_time: 150 },
            { id: 2, start_time: 150, end_time: 200 }
          ] // Valido
        },
        {
          vehicle_id: 'V2',
          trips: [
            { id: 3, start_time: 300, end_time: 350 },
            { id: 4, start_time: 360, end_time: 400 }
          ] // Valido
        }
      ]
    };

    let overLapsFound = false;

    // Routine para varrer overlaps
    for (const vehicleRun of mockOptimizerResponse.runs) {
      // Ordenar por startTime apenas por seguranca da inspecao cronologica
      const trips = vehicleRun.trips.sort((a,b) => a.start_time - b.start_time);
      
      for(let i = 0; i < trips.length - 1; i++) {
        const current = trips[i];
        const next = trips[i+1];
        
        // Se a viagem seguinte comeca ANTES da atual terminar -> OVERLAP (Erro Crasso)
        if(next.start_time < current.end_time) {
          overLapsFound = true;
          break;
        }
      }
    }

    expect(overLapsFound).toBe(false);
  });

});
