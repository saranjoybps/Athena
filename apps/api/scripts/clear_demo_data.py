#!/usr/bin/env python3
"""Safely clear Athena demo / orphaned seed data from Firestore.

Default is dry-run (prints what would be deleted). Pass --yes to delete.

Targets:
  - userId == local-owner
  - email == demo@athena.local
  - organizations named like Athena Demo Contractors
  - memberships / child org docs for those orgs

Usage (from apps/api with venv active):
  set FIREBASE_CREDENTIALS_JSON=...   # preferred (full SA JSON or base64)
  set FIREBASE_PROJECT_ID=athena-35028
  set ATHENA_STORE=firestore
  python scripts/clear_demo_data.py
  python scripts/clear_demo_data.py --yes
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Allow `python scripts/clear_demo_data.py` from apps/api
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DEMO_USER_IDS = {"local-owner"}
DEMO_EMAILS = {"demo@athena.local"}
DEMO_ORG_NAMES = {"athena demo contractors"}


def _store():
    os.environ.setdefault("ATHENA_STORE", "firestore")
    # Ensure Settings/.env is applied (loads FIREBASE_CREDENTIALS_JSON)
    from app.core.config import get_settings

    get_settings()
    from app.core.store import get_store

    return get_store()


def _all_docs(store, collection: str, page: int = 200):
    """Best-effort scan. FirestoreStore.query supports limit/offset."""
    offset = 0
    while True:
        batch = store.query(collection, limit=page, offset=offset)
        if not batch:
            break
        yield from batch
        if len(batch) < page:
            break
        offset += page


def main() -> int:
    parser = argparse.ArgumentParser(description="Clear Athena demo data from Firestore")
    parser.add_argument("--yes", action="store_true", help="Actually delete (default: dry-run)")
    args = parser.parse_args()

    from app.core import collections as C

    store = _store()
    to_delete: list[tuple[str, str, str]] = []  # collection, id, reason

    # Users
    for doc in _all_docs(store, C.USERS):
        uid = str(doc.get("id") or "")
        email = str(doc.get("email") or "").lower()
        if uid in DEMO_USER_IDS or email in DEMO_EMAILS:
            to_delete.append((C.USERS, uid, f"demo user {email or uid}"))

    # Orgs
    demo_org_ids: set[str] = set()
    for doc in _all_docs(store, C.ORGANIZATIONS):
        oid = str(doc.get("id") or "")
        name = str(doc.get("name") or "").strip().lower()
        email = str(doc.get("email") or "").lower()
        if name in DEMO_ORG_NAMES or email in DEMO_EMAILS:
            demo_org_ids.add(oid)
            to_delete.append((C.ORGANIZATIONS, oid, f"demo org {doc.get('name')}"))

    # Memberships for demo users / orgs
    for doc in _all_docs(store, C.MEMBERSHIPS):
        mid = str(doc.get("id") or "")
        uid = str(doc.get("userId") or "")
        oid = str(doc.get("orgId") or "")
        if uid in DEMO_USER_IDS or oid in demo_org_ids:
            to_delete.append((C.MEMBERSHIPS, mid, f"membership {uid}@{oid}"))
            if oid:
                demo_org_ids.add(oid)

    # Org-scoped collections
    org_collections = [
        getattr(C, name)
        for name in dir(C)
        if name.isupper()
        and name
        not in {
            "ORGANIZATIONS",
            "USERS",
            "MEMBERSHIPS",
            "ROLES",
            "PERMISSIONS",
            "PLANS",
            "FINANCIAL_WRITE_DENIED_CLIENT",
        }
        and isinstance(getattr(C, name), str)
    ]

    for coll in org_collections:
        for doc in _all_docs(store, coll):
            oid = str(doc.get("orgId") or "")
            if oid and oid in demo_org_ids:
                to_delete.append((coll, str(doc["id"]), f"org-scoped {coll}"))

    # De-dupe
    seen: set[tuple[str, str]] = set()
    unique: list[tuple[str, str, str]] = []
    for coll, doc_id, reason in to_delete:
        key = (coll, doc_id)
        if key in seen or not doc_id:
            continue
        seen.add(key)
        unique.append((coll, doc_id, reason))

    print(f"Found {len(unique)} document(s) to remove.")
    for coll, doc_id, reason in unique[:50]:
        print(f"  - {coll}/{doc_id} ({reason})")
    if len(unique) > 50:
        print(f"  … and {len(unique) - 50} more")

    if not unique:
        print("Nothing to clear. Firestore has no demo markers.")
        return 0

    if not args.yes:
        print("\nDry-run only. Re-run with --yes to delete.")
        return 0

    for coll, doc_id, _ in unique:
        store.delete(coll, doc_id)
    print(f"Deleted {len(unique)} document(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
