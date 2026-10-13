from typing import Any

from app.core.config import get_settings


class FirestoreStore:
    def __init__(self) -> None:
        from google.cloud import firestore

        from app.core.firebase_credentials import get_google_credentials

        settings = get_settings()
        creds = get_google_credentials()
        self._db = firestore.Client(
            project=settings.firebase_project_id or None,
            credentials=creds,
        )

    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        snap = self._db.collection(collection).document(doc_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data["id"] = snap.id
        return data

    def set(self, collection: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
        payload = {k: v for k, v in data.items() if k != "id"}
        self._db.collection(collection).document(doc_id).set(payload)
        payload["id"] = doc_id
        return payload

    def create(self, collection: str, data: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
        payload = {k: v for k, v in data.items() if k != "id"}
        if doc_id:
            self._db.collection(collection).document(doc_id).set(payload)
            payload["id"] = doc_id
            return payload
        _, ref = self._db.collection(collection).add(payload)
        payload["id"] = ref.id
        return payload

    def delete(self, collection: str, doc_id: str) -> None:
        self._db.collection(collection).document(doc_id).delete()

    def query(
        self,
        collection: str,
        filters: list[tuple[str, str, Any]] | None = None,
        order_by: str | None = None,
        limit: int = 50,
        offset: int = 0,
        fields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Query Firestore. Equality filters + order_by need composite indexes;
        if the index is missing, fall back to filter-only + in-memory sort
        so local/dev keeps working without clicking Firebase index links.

        ``fields`` projects the returned documents to those fields (plus ``id``).
        """
        try:
            return self._run_query(collection, filters, order_by, limit, offset, fields)
        except Exception as exc:  # noqa: BLE001 — narrow to FailedPrecondition below
            from google.api_core.exceptions import FailedPrecondition

            needs_index = isinstance(exc, FailedPrecondition) or "requires an index" in str(exc)
            if order_by and filters and needs_index:
                # Do NOT over-fetch (that burned free-tier quota). Sort the same page size in memory.
                desc = order_by.startswith("-")
                key = order_by[1:] if desc else order_by
                fallback_fields = None if fields is None else list({*fields, key})
                rows = self._run_query(collection, filters, None, max(limit + offset, limit), 0, fallback_fields)
                rows.sort(key=lambda r: str(r.get(key) or ""), reverse=desc)
                return rows[offset : offset + limit]
            raise

    def _run_query(
        self,
        collection: str,
        filters: list[tuple[str, str, Any]] | None,
        order_by: str | None,
        limit: int,
        offset: int,
        fields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        q = self._db.collection(collection)
        if fields is not None:
            q = q.select(fields)
        for field, op, value in filters or []:
            q = q.where(field, op, value)
        if order_by:
            desc = order_by.startswith("-")
            key = order_by[1:] if desc else order_by
            direction = "DESCENDING" if desc else "ASCENDING"
            q = q.order_by(key, direction=direction)
        if offset:
            q = q.offset(offset)
        q = q.limit(limit)
        rows = []
        for snap in q.stream():
            data = snap.to_dict() or {}
            data["id"] = snap.id
            rows.append(data)
        return rows

    def next_counter(self, collection: str, key: str) -> int:
        from google.cloud import firestore

        ref = self._db.collection(collection).document(key)

        @firestore.transactional
        def bump(transaction) -> int:
            snap = ref.get(transaction=transaction)
            current = int((snap.to_dict() or {}).get("value", 0)) + 1
            transaction.set(ref, {"value": current})
            return current

        return bump(self._db.transaction())
