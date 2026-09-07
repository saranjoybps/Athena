from __future__ import annotations

from typing import Any

from app.core.collections import ACCOUNTING_ENTRIES, CUSTOMERS, EXPENSES, INVOICES, PAYMENTS, PURCHASES
from app.core.repo import list_org
from app.core.store import DocumentStore
from app.engines.units import D, money


def accounts_overview(store: DocumentStore, org_id: str) -> dict[str, Any]:
    invoices = list_org(store, INVOICES, org_id)
    payments = list_org(store, PAYMENTS, org_id)
    expenses = list_org(store, EXPENSES, org_id)
    purchases = list_org(store, PURCHASES, org_id)
    entries = list_org(store, ACCOUNTING_ENTRIES, org_id)

    collections = money(sum(D(p.get("amount") or 0) for p in payments))
    billed = money(sum(D(i.get("total") or i.get("total_amount") or 0) for i in invoices))
    outstanding = money(sum(D(i.get("outstanding") or 0) for i in invoices))
    expense_total = money(sum(D(e.get("amount") or 0) for e in expenses))
    purchase_total = money(sum(D(p.get("total") or 0) for p in purchases))
    costs = money(expense_total + purchase_total)
    net = money(collections - costs)

    open_invoices = [i for i in invoices if D(i.get("outstanding") or 0) > 0]
    open_invoices.sort(key=lambda i: D(i.get("outstanding") or 0), reverse=True)

    customers = {c["id"]: c for c in list_org(store, CUSTOMERS, org_id)}
    receivables = []
    for inv in open_invoices:
        cust = customers.get(str(inv.get("customerId") or ""), {})
        receivables.append(
            {
                "invoiceId": inv.get("id"),
                "number": inv.get("number"),
                "customerId": inv.get("customerId"),
                "customerName": cust.get("name"),
                "projectId": inv.get("projectId"),
                "status": inv.get("status"),
                "total": str(inv.get("total") or inv.get("total_amount") or "0"),
                "outstanding": str(inv.get("outstanding") or "0"),
                "dueDate": inv.get("dueDate"),
                "createdAt": inv.get("createdAt"),
            }
        )

    # Group AR by customer
    by_customer: dict[str, dict[str, Any]] = {}
    for row in receivables:
        cid = str(row.get("customerId") or "unknown")
        bucket = by_customer.setdefault(
            cid,
            {
                "customerId": row.get("customerId"),
                "customerName": row.get("customerName") or "Unknown",
                "outstanding": D(0),
                "invoiceCount": 0,
            },
        )
        bucket["outstanding"] += D(row.get("outstanding") or 0)
        bucket["invoiceCount"] += 1
    customer_balances = [
        {
            **b,
            "outstanding": str(money(b["outstanding"])),
        }
        for b in sorted(by_customer.values(), key=lambda x: D(x["outstanding"]), reverse=True)
    ]

    recent_entries = sorted(entries, key=lambda e: str(e.get("postedAt") or e.get("createdAt") or ""), reverse=True)[:40]
    recent_payments = sorted(payments, key=lambda p: str(p.get("createdAt") or ""), reverse=True)[:20]
    recent_expenses = sorted(expenses, key=lambda e: str(e.get("createdAt") or ""), reverse=True)[:20]

    return {
        "pl": {
            "collections": str(collections),
            "billed": str(billed),
            "outstanding": str(outstanding),
            "expenses": str(expense_total),
            "purchases": str(purchase_total),
            "costs": str(costs),
            "net": str(net),
        },
        "counts": {
            "openInvoices": len(open_invoices),
            "payments": len(payments),
            "expenses": len(expenses),
            "ledgerEntries": len(entries),
        },
        "receivables": receivables,
        "customerBalances": customer_balances,
        "recentPayments": [
            {
                "id": p.get("id"),
                "amount": p.get("amount"),
                "method": p.get("method"),
                "invoiceId": p.get("invoiceId"),
                "customerId": p.get("customerId"),
                "projectId": p.get("projectId"),
                "createdAt": p.get("createdAt"),
            }
            for p in recent_payments
        ],
        "recentExpenses": [
            {
                "id": e.get("id"),
                "amount": e.get("amount"),
                "category": e.get("category"),
                "projectId": e.get("projectId"),
                "description": e.get("description"),
                "createdAt": e.get("createdAt"),
            }
            for e in recent_expenses
        ],
        "ledger": [
            {
                "id": e.get("id"),
                "type": e.get("type"),
                "amount": e.get("amount"),
                "projectId": e.get("projectId"),
                "reference": e.get("reference"),
                "referenceId": e.get("referenceId"),
                "notes": e.get("notes"),
                "postedAt": e.get("postedAt") or e.get("createdAt"),
            }
            for e in recent_entries
        ],
    }
