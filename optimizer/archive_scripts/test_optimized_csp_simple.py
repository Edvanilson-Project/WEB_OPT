#!/usr/bin/env python3
"""
Teste simples do SetPartitioningOptimizedCSP sem dependências do pydantic
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Criar classes de domínio simplificadas para teste
class Trip:
    def __init__(self, id, line_id=1, start_time=360, end_time=420,
                 origin_id=1, destination_id=2, duration=60, distance_km=10.0):
        self.id = id
        self.line_id = line_id
        self.start_time = start_time
        self.end_time = end_time
        self.origin_id = origin_id
        self.destination_id = destination_id
        self.duration = duration
        self.distance_km = distance_km

class Block:
    def __init__(self, id, trips, vehicle_type_id=1):
        self.id = id
        self.trips = trips
        self.vehicle_type_id = vehicle_type_id
        self.start_time = trips[0].start_time if trips else 0
        self.end_time = trips[-1].end_time if trips else 0
        self.work_time = sum(t.duration for t in trips) if trips else 0
        self.distance_km = sum(t.distance_km for t in trips) if trips else 0

def test_optimized_csp():
    print("="*80)
    print("TESTE SIMPLIFICADO DO SetPartitioningOptimizedCSP")
    print("="*80)

    # Criar blocos simples
    blocks = []
    start = 360

    for i in range(10):
        n_trips = 1 + (i % 2)
        trips = []
        block_start = start

        for j in range(n_trips):
            trip_id = i * 10 + j + 1
            trip_dur = 30 + (j * 15)
            origin_id = (i + j) % 5 + 1
            dest_id = ((i + j + 1) % 5) + 1

            t = Trip(
                id=trip_id,
                start_time=block_start,
                end_time=block_start + trip_dur,
                origin_id=origin_id,
                destination_id=dest_id,
                duration=trip_dur,
                distance_km=10.0,
            )
            trips.append(t)
            if j < n_trips - 1:
                block_start += trip_dur + 5

        block = Block(
            id=i + 1,
            trips=trips,
            vehicle_type_id=1,
        )
        blocks.append(block)
        gap = 15 + (i % 20)
        start = block_start + gap

    print(f"Criados {len(blocks)} blocos para teste")

    # Testar importação e execução
    try:
        from src.algorithms.csp.set_partitioning_optimized import SetPartitioningOptimizedCSP
        print("✓ SetPartitioningOptimizedCSP importado com sucesso")

        # Criar CSP otimizado
        csp = SetPartitioningOptimizedCSP(vsp_params={
            "pricing_enabled": True,
            "max_generated_columns": 1000,
            "max_candidate_successors_per_task": 4,
            "use_optimized_set_partitioning": True,
            "operator_change_terminals_only": True
        })

        # Testar construção do grafo
        print("\nConstruindo grafo de vizinhança...")
        neighbors = csp._task_neighbors_optimized(blocks)
        edges = sum(len(v) for v in neighbors.values())

        print(f"\nResultados:")
        print(f"  Blocos: {len(blocks)}")
        print(f"  Arestas: {edges}")
        print(f"  _fast_checks: {csp._fast_checks}")
        print(f"  _full_checks: {csp._full_checks}")
        print(f"  _combinations_pruned: {csp._combinations_pruned}")

        # Análise de eficácia
        total_pairs = len(blocks) * (len(blocks) - 1) // 2
        if total_pairs > 0:
            fast_eliminated = csp._fast_checks - csp._full_checks - csp._combinations_pruned
            print(f"\nEficácia da poda:")
            print(f"  Total de pares: {total_pairs}")
            print(f"  Poda early (max_shift): {csp._combinations_pruned} ({csp._combinations_pruned/total_pairs*100:.1f}%)")
            print(f"  Fast check elimina: {fast_eliminated} ({fast_eliminated/total_pairs*100:.1f}%)")
            print(f"  Verificações completas: {csp._full_checks} ({csp._full_checks/total_pairs*100:.1f}%)")

        # Verificar algumas conexões
        print(f"\nExemplo de conexões:")
        for task_id in [1, 2, 3]:
            if task_id in neighbors and neighbors[task_id]:
                print(f"  Task {task_id} → {[b.id for b in neighbors[task_id][:3]]}")

        return True

    except Exception as e:
        print(f"✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_optimized_csp()
    print(f"\n" + "="*80)
    print(f"TESTE {'BEM SUCEDIDO' if success else 'FALHOU'}")
    print("="*80)
    sys.exit(0 if success else 1)