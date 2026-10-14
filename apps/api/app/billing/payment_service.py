"""Payment edits, reversals and the project completion rules they drive."""

from __future__ import annotations

from typing import Any

from app.core.collections import ACCOUNTING_ENTRIES, CUSTOMERS, INVOICES, PAYMENT_ALLOCATIONS, PROJECTS
from app.core.repo import now_iso
from app.core.store import DocumentStore
from app.engines.units import D, money

PAYMENT_METHODS = {"upi", "cash", "bank", "cheque", "card"}
_COMPLETION_MARKERS = ("completedAt", "completedBy", "completedByPaymentId", "previousStatus")


def _live(rows: list[dict]) -> list[dict]:
    return [r for r in rows if not r.get("deletedAt")]


def _owned(store: DocumentStore, collection: str, doc_id: Any, org_id: str) -> dict | None:
    if not doc_id:
        return None
    doc = store.get(collection, str(doc_id))
    if not doc or doc.get("orgId") != org_id:
        return None
    return doc


def enrich_payments(store: DocumentStore, org_id: str, rows: list[dict]) -> list[dict]:
    """Attach customer, project and invoice labels so lists don't show raw ids."""
    cache: dict[tuple[str, str], dict | None] = {}

    def get(collection: str, doc_id: Any) -> dict | None:
        key = (collection, str(doc_id or ""))
        if key not in cache:
            cache[key] = _owned(store, collection, doc_id, org_id)
        return cache[key]

    out = []
    for row in rows:
        invoice = get(INVOICES, row.get("invoiceId")) or {}
        customer = get(CUSTOMERS, row.get("customerId") or invoice.get("customerId")) or {}
        project = get(PROJECTS, row.get("projectId") or invoice.get("projectId")) or {}
        out.append(
            {
                **row,
                "customerName": customer.get("name"),
                "customerPhone": customer.get("phone"),
                "projectName": project.get("name") or project.get("number"),
                "projectStatus": project.get("status"),
                "invoiceNumber": invoice.get("number"),
                "invoiceStatus": invoice.get("status"),
                "invoiceTotal": invoice.get("total"),
                "invoiceOutstanding": invoice.get("outstanding"),
            }
        )
    return out


def apply_to_invoice(store: DocumentStore, invoice: dict, delta: Any) -> dict:
    """Add (or with a negative delta, remove) a paid amount and recompute balance and status."""
    paid = money(max(D(0), D(invoice.get("paid") or 0) + D(delta)))
    invoice["paid"] = str(paid)
    if invoice.get("status") != "void":
        total = D(invoice.get("total") or 0)
        invoice["outstanding"] = str(money(max(D(0), total - paid)))
        if paid <= 0:
            invoice["status"] = "sent"
        elif paid < total:
            invoice["status"] = "partially_paid"
        else:
            invoice["status"] = "paid"
    invoice["updatedAt"] = now_iso()
    return store.set(INVOICES, str(invoice["id"]), invoice)


def _project_invoices(store: DocumentStore, org_id: str, project_id: str) -> list[dict]:
    rows = store.query(INVOICES, filters=[("orgId", "==", org_id), ("projectId", "==", project_id)], limit=500)
    return [r for r in _live(rows) if r.get("status") != "void"]


def complete_project_if_settled(store: DocumentStore, org_id: str, project_id: str | None, payment_id: str) -> None:
    """A project completes once its final invoice and every other invoice are fully paid."""
    project = _owned(store, PROJECTS, project_id, org_id)
    if not project or project.get("deletedAt") or project.get("status") == "completed":
        return
    invoices = _project_invoices(store, org_id, str(project_id))
    if not invoices or not any(i.get("kind") == "final" for i in invoices):
        return
    if not all(i.get("status") == "paid" for i in invoices):
        return
    project["previousStatus"] = project.get("status") or "active"
    project["status"] = "completed"
    project["completedAt"] = now_iso()
    project["completedBy"] = "payment"
    project["completedByPaymentId"] = payment_id
    project["updatedAt"] = now_iso()
    store.set(PROJECTS, str(project_id), project)


def reopen_project_if_unsettled(store: DocumentStore, org_id: str, project_id: str | None) -> bool:
    """After a payment is removed or reduced, a completed project goes back to the status it had before."""
    project = _owned(store, PROJECTS, project_id, org_id)
    if not project or project.get("deletedAt") or project.get("status") != "completed" or project.get("closedAt"):
        return False
    invoices = _project_invoices(store, org_id, str(project_id))
    if invoices and all(i.get("status") == "paid" for i in invoices):
        return False
    previous = str(project.get("previousStatus") or "")
    project["status"] = previous if previous and previous != "completed" else "active"
    for key in _COMPLETION_MARKERS:
        project.pop(key, None)
    project["updatedAt"] = now_iso()
    store.set(PROJECTS, str(project_id), project)
    return True


def _rows_for_payment(store: DocumentStore, collection: str, org_id: str, field: str, payment_id: str) -> list[dict]:
    return _live(store.query(collection, filters=[("orgId", "==", org_id), (field, "==", payment_id)], limit=20))


def update_payment_ledger(store: DocumentStore, org_id: str, payment_id: str, amount: str, outstanding: str) -> None:
    for entry in _rows_for_payment(store, ACCOUNTING_ENTRIES, org_id, "referenceId", payment_id):
        if entry.get("reference") == "payment":
            entry.update({"amount": amount, "updatedAt": now_iso()})
            store.set(ACCOUNTING_ENTRIES, str(entry["id"]), entry)
    for alloc in _rows_for_payment(store, PAYMENT_ALLOCATIONS, org_id, "paymentId", payment_id):
        alloc.update({"allocated": amount, "outstanding": outstanding, "updatedAt": now_iso()})
        store.set(PAYMENT_ALLOCATIONS, str(alloc["id"]), alloc)


def remove_payment_ledger(store: DocumentStore, org_id: str, payment_id: str) -> None:
    stamp = now_iso()
    for collection, field in ((ACCOUNTING_ENTRIES, "referenceId"), (PAYMENT_ALLOCATIONS, "paymentId")):
        for row in _rows_for_payment(store, collection, org_id, field, payment_id):
            if collection == ACCOUNTING_ENTRIES and row.get("reference") != "payment":
                continue
            row.update({"deletedAt": stamp, "updatedAt": stamp})
            store.set(collection, str(row["id"]), row)
