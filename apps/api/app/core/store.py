from __future__ import annotations

import copy
import threading
import uuid
from typing import Any, Protocol


Filter = tuple[str, str, Any]


class DocumentStore(Protocol):
    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None: ...

    def set(self, collection: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]: ...

    def create(self, collection: str, data: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]: ...

    def delete(self, collection: str, doc_id: str) -> None: ...

    def query(
        self,
        collection: str,
        filters: list[Filter] | None = None,
        order_by: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]: ...

    def next_counter(self, collection: str, key: str) -> int: ...


class MemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, dict[str, dict[str, Any]]] = {}
        self._counters: dict[str, int] = {}
        self._lock = threading.Lock()

    def _col(self, collection: str) -> dict[str, dict[str, Any]]:
        return self._data.setdefault(collection, {})

    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        doc = self._col(collection).get(doc_id)
        return copy.deepcopy(doc) if doc else None

    def set(self, collection: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
        payload = copy.deepcopy(data)
        payload["id"] = doc_id
        self._col(collection)[doc_id] = payload
        return copy.deepcopy(payload)

    def create(self, collection: str, data: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
        new_id = doc_id or uuid.uuid4().hex
        return self.set(collection, new_id, data)

    def delete(self, collection: str, doc_id: str) -> None:
        self._col(collection).pop(doc_id, None)

    def query(
        self,
        collection: str,
        filters: list[Filter] | None = None,
        order_by: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        rows = list(self._col(collection).values())
        for field, op, value in filters or []:
            if op == "==":
                rows = [r for r in rows if r.get(field) == value]
            elif op == "!=":
                rows = [r for r in rows if r.get(field) != value]
            elif op == "in":
                rows = [r for r in rows if r.get(field) in value]
            elif op == ">=":
                rows = [r for r in rows if r.get(field) is not None and r.get(field) >= value]
            elif op == "<=":
                rows = [r for r in rows if r.get(field) is not None and r.get(field) <= value]
            elif op == "array-contains":
                rows = [r for r in rows if isinstance(r.get(field), list) and value in r.get(field)]
        if order_by:
            desc = order_by.startswith("-")
            key = order_by[1:] if desc else order_by
            rows.sort(key=lambda r: r.get(key) or "", reverse=desc)
        sliced = rows[offset : offset + limit]
        return [copy.deepcopy(r) for r in sliced]

    def next_counter(self, collection: str, key: str) -> int:
        with self._lock:
            counter_key = f"{collection}:{key}"
            self._counters[counter_key] = self._counters.get(counter_key, 0) + 1
            return self._counters[counter_key]

    def clear(self) -> None:
        self._data.clear()
        self._counters.clear()


_STORE: DocumentStore | None = None


def get_store() -> DocumentStore:
    global _STORE
    if _STORE is None:
        from app.core.config import get_settings

        settings = get_settings()
        if settings.athena_store == "firestore":
            from app.core.firestore_store import FirestoreStore

            _STORE = FirestoreStore()
        else:
            _STORE = MemoryStore()
    return _STORE


def set_store(store: DocumentStore) -> None:
    global _STORE
    _STORE = store
