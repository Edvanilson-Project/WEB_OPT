"""Persistência local para cenários estratégicos, ingestões de feed e relatórios de reconciliação."""
from __future__ import annotations

import json
import os
from filelock import FileLock
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


class StrategyPersistenceService:
    def __init__(self, base_dir: str) -> None:
        self.base_path = Path(base_dir)
        self.base_path.mkdir(parents=True, exist_ok=True)
        # Arquivos de persistência
        self._scenarios_file = self.base_path / "scenarios.json"
        self._feeds_file = self.base_path / "feeds.json"
        self._reports_file = self.base_path / "reconciliation_reports.json"

        # Garante arquivos existentes antes de criar locks
        self._ensure_file(self._scenarios_file)
        self._ensure_file(self._feeds_file)
        self._ensure_file(self._reports_file)

        # Locks a nível de sistema operativo (Multi-Process Safe)
        # Adiciona timeout de segurança para evitar bloqueio infinito caso um processo morra
        self._scenarios_lock = FileLock(str(self._scenarios_file) + ".lock", timeout=10)
        self._feeds_lock = FileLock(str(self._feeds_file) + ".lock", timeout=10)
        self._reports_lock = FileLock(str(self._reports_file) + ".lock", timeout=10)

    def save_scenario(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._scenarios_lock:
            data = self._read_json(self._scenarios_file)
            items = data.get("items", [])
            scenario_id = int(data.get("last_id", 0)) + 1
            now_iso = self._utc_now_iso()

            item = {
                "id": scenario_id,
                "created_at": now_iso,
                "updated_at": now_iso,
                **payload,
            }
            items.append(item)

            self._write_json(
                self._scenarios_file,
                {
                    "last_id": scenario_id,
                    "items": items,
                },
            )
            return item

    def list_scenarios(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._scenarios_lock:
            data = self._read_json(self._scenarios_file)
            items = data.get("items", [])
            return list(reversed(items[-max(1, limit):]))

    def get_scenario(self, scenario_id: int) -> Optional[Dict[str, Any]]:
        with self._scenarios_lock:
            data = self._read_json(self._scenarios_file)
            items = data.get("items", [])
            for item in items:
                if int(item.get("id", 0)) == int(scenario_id):
                    return item
        return None

    def get_latest_scenario(self) -> Optional[Dict[str, Any]]:
        with self._scenarios_lock:
            data = self._read_json(self._scenarios_file)
            items = data.get("items", [])
            if not items:
                return None
            return items[-1]

    def ingest_feed(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        with self._feeds_lock:
            data = self._read_json(self._feeds_file)
            snapshots = data.get("snapshots", [])
            snapshot_id = int(data.get("last_id", 0)) + 1

            valid_gps = sum(1 for e in entries if e.get("gps_valid") is True)
            invalid_gps = sum(1 for e in entries if e.get("gps_valid") is False)
            terminal_ok = sum(1 for e in entries if e.get("sent_to_driver_terminal") is True)
            terminal_missing = sum(1 for e in entries if e.get("sent_to_driver_terminal") is False)

            quality = {
                "total_records": len(entries),
                "gps_valid_count": valid_gps,
                "gps_invalid_count": invalid_gps,
                "terminal_ack_count": terminal_ok,
                "terminal_ack_missing_count": terminal_missing,
                "gps_valid_ratio": round(valid_gps / len(entries), 4) if entries else 0.0,
                "terminal_ack_ratio": round(terminal_ok / len(entries), 4) if entries else 0.0,
            }

            snapshot = {
                "id": snapshot_id,
                "created_at": self._utc_now_iso(),
                "quality": quality,
                "records": entries,
            }
            snapshots.append(snapshot)

            self._write_json(
                self._feeds_file,
                {
                    "last_id": snapshot_id,
                    "snapshots": snapshots,
                },
            )

            return {
                "snapshot_id": snapshot_id,
                "quality": quality,
            }

    def get_latest_feed_records(self) -> List[Dict[str, Any]]:
        with self._feeds_lock:
            data = self._read_json(self._feeds_file)
            snapshots = data.get("snapshots", [])
            if not snapshots:
                return []
            latest = snapshots[-1]
            return list(latest.get("records", []))

    def get_latest_feed_snapshot(self) -> Optional[Dict[str, Any]]:
        with self._feeds_lock:
            snapshots = self._read_json(self._feeds_file).get("snapshots", [])
            if not snapshots:
                return None
            return dict(snapshots[-1])

    def save_reconciliation_report(self, report: Dict[str, Any]) -> Dict[str, Any]:
        with self._reports_lock:
            data = self._read_json(self._reports_file)
            items = data.get("items", [])
            report_id = int(data.get("last_id", 0)) + 1
            now_iso = self._utc_now_iso()

            item = {
                "id": report_id,
                "created_at": now_iso,
                "report": report,
            }
            items.append(item)

            self._write_json(
                self._reports_file,
                {
                    "last_id": report_id,
                    "items": items,
                },
            )
            return item

    def list_reconciliation_reports(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._reports_lock:
            items = self._read_json(self._reports_file).get("items", [])
            return list(reversed(items[-max(1, limit):]))

    def prune_data(
        self,
        max_scenarios: int,
        max_feed_snapshots: int,
        max_reports: int,
        max_age_days: int,
    ) -> Dict[str, int]:
        # Acquire locks in a fixed order to avoid deadlocks across processes
        with self._scenarios_lock:
            with self._feeds_lock:
                with self._reports_lock:
                    scenarios_data = self._read_json(self._scenarios_file)
                    feeds_data = self._read_json(self._feeds_file)
                    reports_data = self._read_json(self._reports_file)

                    scenarios = scenarios_data.get("items", [])
                    snapshots = feeds_data.get("snapshots", [])
                    reports = reports_data.get("items", [])

                    new_scenarios = self._apply_retention(
                        scenarios,
                        max_items=max_scenarios,
                        max_age_days=max_age_days,
                    )
                    new_snapshots = self._apply_retention(
                        snapshots,
                        max_items=max_feed_snapshots,
                        max_age_days=max_age_days,
                    )
                    new_reports = self._apply_retention(
                        reports,
                        max_items=max_reports,
                        max_age_days=max_age_days,
                    )

                    self._write_json(
                        self._scenarios_file,
                        {
                            "last_id": self._compute_last_id(new_scenarios),
                            "items": new_scenarios,
                        },
                    )
                    self._write_json(
                        self._feeds_file,
                        {
                            "last_id": self._compute_last_id(new_snapshots),
                            "snapshots": new_snapshots,
                        },
                    )
                    self._write_json(
                        self._reports_file,
                        {
                            "last_id": self._compute_last_id(new_reports),
                            "items": new_reports,
                        },
                    )

                    return {
                        "scenarios_removed": max(0, len(scenarios) - len(new_scenarios)),
                        "feed_snapshots_removed": max(0, len(snapshots) - len(new_snapshots)),
                        "reports_removed": max(0, len(reports) - len(new_reports)),
                    }

    @staticmethod
    def _utc_now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _ensure_file(path: Path) -> None:
        if path.exists():
            return
        path.write_text(json.dumps({}, ensure_ascii=False), encoding="utf-8")

    @staticmethod
    def _read_json(path: Path) -> Dict[str, Any]:
        try:
            raw = path.read_text(encoding="utf-8").strip()
            if not raw:
                return {}
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            return {}
        except Exception:
            return {}

    @staticmethod
    def _write_json(path: Path, payload: Dict[str, Any]) -> None:
        import tempfile
        tmp_fd, tmp_path = tempfile.mkstemp(
            dir=str(path.parent), suffix=".tmp", prefix=path.stem
        )
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                f.write(
                    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False)
                )
            os.replace(tmp_path, str(path))
        except Exception:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise

    @classmethod
    def _apply_retention(
        cls,
        items: List[Dict[str, Any]],
        max_items: int,
        max_age_days: int,
    ) -> List[Dict[str, Any]]:
        kept = list(items)

        if max_age_days > 0:
            cutoff = datetime.now(timezone.utc).timestamp() - (max_age_days * 86400)
            kept = [
                item
                for item in kept
                if cls._to_timestamp(item.get("created_at")) >= cutoff
            ]

        if max_items > 0 and len(kept) > max_items:
            kept = kept[-max_items:]

        return kept

    @staticmethod
    def _compute_last_id(items: List[Dict[str, Any]]) -> int:
        if not items:
            return 0
        return max(int(item.get("id", 0)) for item in items)

    @staticmethod
    def _to_timestamp(value: Any) -> float:
        if not value:
            return 0.0
        if not isinstance(value, str):
            return 0.0
        try:
            text = value.strip()
            if text.endswith("Z"):
                text = f"{text[:-1]}+00:00"
            return datetime.fromisoformat(text).timestamp()
        except Exception:
            return 0.0
