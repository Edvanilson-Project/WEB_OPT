from __future__ import annotations

import time
from typing import Dict, List

import requests

ALGORITHMS = [
    "greedy",
    "genetic",
    "simulated_annealing",
    "tabu_search",
    "set_partitioning",
    "joint_solver",
    "hybrid_pipeline",
]

BASE_URLS = ["http://127.0.0.1:8001", "http://127.0.0.1:8000"]

TIMEOUT_BY_ALGO = {
    "greedy": 20,
    "genetic": 30,
    "simulated_annealing": 30,
    "tabu_search": 70,
    "set_partitioning": 40,
    "joint_solver": 70,
    "hybrid_pipeline": 70,
}


def choose_base_url() -> str:
    for base_url in BASE_URLS:
        try:
            response = requests.get(f"{base_url}/health/", timeout=2)
            if response.status_code == 200:
                return base_url
        except Exception:
            pass
    raise RuntimeError("Optimizer API offline em 8000/8001")


def trip(trip_id: int, line_id: int, start_time: int, duration: int, origin: int, destination: int, group_id: int | None = None) -> Dict:
    return {
        "id": trip_id,
        "line_id": line_id,
        "trip_group_id": group_id,
        "start_time": start_time,
        "end_time": start_time + duration,
        "origin_id": line_id * 1000 + origin,
        "destination_id": line_id * 1000 + destination,
        "duration": duration,
        "distance_km": round(duration * 0.42, 2),
        "deadhead_times": {
            str(line_id * 1000 + 1): 0,
            str(line_id * 1000 + 2): 0,
            str(line_id * 1000 + 3): 3,
        },
    }


def build_dataset() -> List[Dict]:
    trips: List[Dict] = []
    trip_id = 1
    pair_id = 1

    # 3 linhas com ida/volta intercaladas e alguns blocos sem volta para stress realista
    lines = [815, 819, 826]
    starts = [220, 250, 280, 320, 360, 410, 460, 520]

    for line in lines:
        for start in starts:
            duration_ida = 45 + ((start // 10) % 15)
            ida_id = trip_id
            trips.append(trip(ida_id, line, start, duration_ida, 1, 2, pair_id))
            trip_id += 1

            # Em parte das viagens adiciona volta para validar agrupamento
            if (start // 10) % 3 != 0:
                gap = 0 if (start // 10) % 2 == 0 else 8
                volta_start = start + duration_ida + gap
                duration_volta = 43 + ((start // 5) % 12)
                trips.append(trip(trip_id, line, volta_start, duration_volta, 2, 1, pair_id))
                trip_id += 1

            pair_id += 1

    # ordenação final
    trips.sort(key=lambda item: (item["start_time"], item["line_id"], item["id"]))
    return trips


def run_once(base_url: str, algorithm: str, trips: List[Dict]) -> Dict:
    payload = {
        "algorithm": algorithm,
        "trips": trips,
        "vehicle_types": [],
        "cct_params": {
            "apply_cct": True,
            "max_shift_minutes": 540,
            "max_work_minutes": 500,
            "max_driving_minutes": 240,
            "min_break_minutes": 20,
            "min_layover_minutes": 0,
            "enforce_single_line_duty": True,
            "strict_hard_validation": True,
        },
        "vsp_params": {
            "min_layover_minutes": 0,
            "preserve_preferred_pairs": True,
            "preferred_pair_window_minutes": 40,
            "strict_hard_validation": True,
            "max_generated_columns": 800,
            "max_pricing_iterations": 1,
            "max_pricing_additions": 64,
        },
    }

    start = time.time()
    response = requests.post(
        f"{base_url}/optimize/",
        json=payload,
        timeout=TIMEOUT_BY_ALGO.get(algorithm, 40),
    )
    elapsed = time.time() - start

    if response.status_code != 200:
        return {
            "ok": False,
            "algorithm": algorithm,
            "status": response.status_code,
            "elapsed": round(elapsed, 2),
            "error": str(response.text)[:180],
        }

    data = response.json()
    return {
        "ok": data.get("unassigned_trips", 0) == 0 and data.get("cct_violations", 0) == 0,
        "algorithm": algorithm,
        "status": 200,
        "elapsed": round(elapsed, 2),
        "vehicles": data.get("vehicles", 0),
        "crew": data.get("crew", 0),
        "unassigned": data.get("unassigned_trips", -1),
        "cct_violations": data.get("cct_violations", -1),
        "warnings": len(data.get("warnings", [])),
    }


def main() -> int:
    base_url = choose_base_url()
    trips = build_dataset()
    print(f"API: {base_url}")
    print(f"Dataset: {len(trips)} viagens multi-linhas")

    failures: List[Dict] = []
    for algorithm in ALGORITHMS:
        try:
            result = run_once(base_url, algorithm, trips)
        except Exception as exc:
            result = {
                "ok": False,
                "algorithm": algorithm,
                "status": "EXC",
                "elapsed": -1,
                "error": repr(exc)[:180],
            }

        if result.get("ok"):
            print(
                f"[OK] {algorithm:<20} "
                f"{result['elapsed']:>5}s  "
                f"veh={result.get('vehicles', 0):>3} "
                f"crew={result.get('crew', 0):>3} "
                f"warn={result.get('warnings', 0):>2}"
            )
        else:
            failures.append(result)
            print(f"[FAIL] {algorithm:<20} {result}")

    print("\nResumo:")
    print(f"- total algoritmos: {len(ALGORITHMS)}")
    print(f"- falhas: {len(failures)}")

    if failures:
        print("\nFalhas detectadas:")
        for item in failures:
            print(item)
        return 1

    print("Todos os algoritmos passaram no smoke test rápido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
