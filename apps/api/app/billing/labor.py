from __future__ import annotations

from app.core.collections import ATTENDANCE, LABOUR
from app.core.repo import list_org
from app.core.store import DocumentStore
from app.engines.units import D, money


def labor_lines_for_project(store: DocumentStore, org_id: str, project_id: str) -> list[dict]:
    """Build invoice labor lines: dailyRate × present days (half_day = 0.5)."""
    rows = list_org(store, ATTENDANCE, org_id, extra_filters=[("projectId", "==", project_id)], limit=500)
    by_worker: dict[str, float] = {}
    for row in rows:
        worker_id = row.get("workerId")
        if not worker_id:
            continue
        status = str(row.get("status") or "")
        if status == "present":
            days = 1.0
        elif status == "half_day":
            days = 0.5
        elif status == "overtime":
            days = 1.0
        else:
            continue
        by_worker[str(worker_id)] = by_worker.get(str(worker_id), 0.0) + days

    lines: list[dict] = []
    for worker_id, days in by_worker.items():
        worker = store.get(LABOUR, worker_id) or {}
        rate = D(worker.get("dailyRate") or 0)
        amount = money(rate * D(days))
        if amount <= 0:
            continue
        name = worker.get("name") or "Labour"
        lines.append(
            {
                "description": f"Labour — {name} ({days:g} day{'s' if days != 1 else ''})",
                "quantity": str(days),
                "unit": "day",
                "rate": str(rate),
                "amount": str(amount),
                "workerId": worker_id,
            }
        )
    return lines
