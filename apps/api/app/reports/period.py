"""Monthly / financial-year business report: P&L, GST, receivables, attendance and ledger for one period."""

from __future__ import annotations

import calendar
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from app.attendance.service import latest_marks
from app.core.collections import (
    ACCOUNTING_ENTRIES,
    ATTENDANCE,
    CUSTOMERS,
    EXPENSES,
    INVOICES,
    PAYMENTS,
    PROJECTS,
    PURCHASES,
)
from app.core.concurrency import run_parallel
from app.core.errors import AppError
from app.core.repo import list_org
from app.core.store import DocumentStore
from app.engines.units import D, money

# Business dates are reported in Indian Standard Time; stored timestamps are UTC.
IST = timezone(timedelta(hours=5, minutes=30))
_MAX_ROWS = 2000
# Attendance can be marked for past days, so look back further than the period start.
_ATTENDANCE_LEAD_DAYS = 62


def period_bounds(mode: str, year: int, month: int | None) -> tuple[date, date, str]:
    if year < 2000 or year > 2100:
        raise AppError(400, "invalid_period", "Choose a valid year.")
    if mode == "month":
        if month is None or not 1 <= month <= 12:
            raise AppError(400, "invalid_period", "Choose a month between 1 and 12.")
        start = date(year, month, 1)
        end = date(year, month, calendar.monthrange(year, month)[1])
        return start, end, f"{calendar.month_name[month]} {year}"
    if mode == "year":
        # Indian financial year: 1 April to 31 March.
        return date(year, 4, 1), date(year + 1, 3, 31), f"FY {year}-{str(year + 1)[-2:]}"
    raise AppError(400, "invalid_period", "Period must be 'month' or 'year'.")


def _local_day(row: dict[str, Any], *fields: str) -> date | None:
    for field in fields:
        raw = row.get(field)
        if not raw:
            continue
        text = str(raw)
        try:
            if len(text) == 10:
                return date.fromisoformat(text)
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            continue
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(IST).date()
    return None


def _created_between(store: DocumentStore, collection: str, org_id: str, start: date, end: date, lead_days: int = 1):
    lo = datetime.combine(start - timedelta(days=lead_days), time.min, tzinfo=timezone.utc).isoformat()
    hi = datetime.combine(end + timedelta(days=1), time.max, tzinfo=timezone.utc).isoformat()
    filters = [("orgId", "==", org_id), ("createdAt", ">=", lo), ("createdAt", "<=", hi)]
    try:
        rows = store.query(collection, filters=filters, order_by="-createdAt", limit=_MAX_ROWS)
    except Exception:  # noqa: BLE001 — missing range index: fall back to the newest rows
        rows = list_org(store, collection, org_id, limit=_MAX_ROWS)
    return [r for r in rows if not r.get("deletedAt")]


def _in_period(rows: list[dict[str, Any]], start: date, end: date, *fields: str) -> list[tuple[date, dict[str, Any]]]:
    out = []
    for row in rows:
        day = _local_day(row, *fields)
        if day and start <= day <= end:
            out.append((day, row))
    out.sort(key=lambda pair: (pair[0], str(pair[1].get("createdAt") or "")), reverse=True)
    return out


def _buckets(mode: str, start: date, end: date) -> list[dict[str, Any]]:
    if mode == "year":
        buckets = []
        cursor = start
        while cursor <= end:
            last = date(cursor.year, cursor.month, calendar.monthrange(cursor.year, cursor.month)[1])
            buckets.append(
                {
                    "key": f"{cursor.year}-{cursor.month:02d}",
                    "label": f"{calendar.month_abbr[cursor.month]} {str(cursor.year)[-2:]}",
                    "year": cursor.year,
                    "month": cursor.month,
                    "start": cursor,
                    "end": last,
                }
            )
            cursor = last + timedelta(days=1)
        return buckets
    buckets = []
    day = 1
    while day <= end.day:
        last = min(day + 6, end.day)
        buckets.append(
            {
                "key": f"w{len(buckets) + 1}",
                "label": f"{day}-{last} {calendar.month_abbr[start.month]}",
                "start": date(start.year, start.month, day),
                "end": date(start.year, start.month, last),
            }
        )
        day = last + 1
    return buckets


def _bucket_for(buckets: list[dict[str, Any]], day: date) -> dict[str, Any] | None:
    for bucket in buckets:
        if bucket["start"] <= day <= bucket["end"]:
            return bucket
    return None


def _tax(doc: dict[str, Any]) -> dict[str, Any]:
    return doc.get("tax") or {}


def period_report(store: DocumentStore, org_id: str, mode: str, year: int, month: int | None) -> dict[str, Any]:
    start, end, label = period_bounds(mode, year, month)

    invoices_all, payments_raw, expenses_raw, purchases_raw, attendance_raw, entries_raw, customers, projects = run_parallel(
        lambda: list_org(store, INVOICES, org_id, limit=_MAX_ROWS),
        lambda: _created_between(store, PAYMENTS, org_id, start, end),
        lambda: _created_between(store, EXPENSES, org_id, start, end),
        lambda: _created_between(store, PURCHASES, org_id, start, end),
        lambda: _created_between(store, ATTENDANCE, org_id, start, end, lead_days=_ATTENDANCE_LEAD_DAYS),
        lambda: _created_between(store, ACCOUNTING_ENTRIES, org_id, start, end),
        lambda: list_org(store, CUSTOMERS, org_id, limit=_MAX_ROWS),
        lambda: list_org(store, PROJECTS, org_id, limit=_MAX_ROWS),
    )
    customer_names = {str(c["id"]): c.get("name") for c in customers}
    customer_gstin = {str(c["id"]): c.get("gstin") for c in customers}
    project_names = {str(p["id"]): p.get("name") or p.get("title") for p in projects}
    invoices_by_id = {str(i["id"]): i for i in invoices_all}

    invoices = [
        (day, inv)
        for day, inv in _in_period(invoices_all, start, end, "invoiceDate", "issueDate", "createdAt")
        if inv.get("status") != "void"
    ]
    payments = _in_period(payments_raw, start, end, "date", "paidAt", "createdAt")
    expenses = _in_period(expenses_raw, start, end, "date", "createdAt")
    purchases = _in_period(purchases_raw, start, end, "date", "createdAt")
    attendance = _in_period(attendance_raw, start, end, "date", "createdAt")
    entries = _in_period(entries_raw, start, end, "postedAt", "createdAt")

    buckets = _buckets(mode, start, end)
    for bucket in buckets:
        bucket.update(billed=D(0), collected=D(0), costs=D(0))

    def add(day: date, key: str, amount) -> None:
        bucket = _bucket_for(buckets, day)
        if bucket is not None:
            bucket[key] += amount

    billed = D(0)
    invoice_rows = []
    by_customer: dict[str, dict[str, Any]] = {}
    for day, inv in invoices:
        total = D(inv.get("total") or inv.get("total_amount") or 0)
        billed += total
        add(day, "billed", total)
        cid = str(inv.get("customerId") or "")
        bucket = by_customer.setdefault(
            cid, {"customerId": cid or None, "customerName": customer_names.get(cid) or "Customer", "billed": D(0), "collected": D(0)}
        )
        bucket["billed"] += total
        invoice_rows.append(
            {
                "id": inv.get("id"),
                "number": inv.get("number"),
                "date": day.isoformat(),
                "customerName": customer_names.get(cid) or inv.get("customerName"),
                "projectName": project_names.get(str(inv.get("projectId") or "")),
                "status": inv.get("status"),
                "total": str(money(total)),
                "outstanding": str(inv.get("outstanding") or "0"),
                "taxTotal": str(_tax(inv).get("taxTotal") or "0"),
            }
        )

    collected = D(0)
    payment_rows = []
    for day, pay in payments:
        amount = D(pay.get("amount") or 0)
        collected += amount
        add(day, "collected", amount)
        cid = str(pay.get("customerId") or "")
        bucket = by_customer.setdefault(
            cid, {"customerId": cid or None, "customerName": customer_names.get(cid) or "Customer", "billed": D(0), "collected": D(0)}
        )
        bucket["collected"] += amount
        invoice = invoices_by_id.get(str(pay.get("invoiceId") or "")) or {}
        payment_rows.append(
            {
                "id": pay.get("id"),
                "number": pay.get("number"),
                "date": day.isoformat(),
                "amount": str(money(amount)),
                "method": pay.get("method"),
                "invoiceId": pay.get("invoiceId"),
                "invoiceNumber": invoice.get("number"),
                "customerName": customer_names.get(cid),
            }
        )

    expense_total = D(0)
    billable_total = D(0)
    expense_rows = []
    by_category: dict[str, dict[str, Any]] = {}
    for day, exp in expenses:
        amount = D(exp.get("amount") or 0)
        expense_total += amount
        if exp.get("billableToCustomer") is True:
            billable_total += amount
        add(day, "costs", amount)
        category = str(exp.get("category") or "other")
        cat = by_category.setdefault(category, {"category": category, "amount": D(0), "count": 0})
        cat["amount"] += amount
        cat["count"] += 1
        expense_rows.append(
            {
                "id": exp.get("id"),
                "date": day.isoformat(),
                "category": category,
                "amount": str(money(amount)),
                "description": exp.get("description") or exp.get("notes"),
                "projectName": project_names.get(str(exp.get("projectId") or "")),
                "billable": exp.get("billableToCustomer") is True,
            }
        )

    purchase_total = D(0)
    purchase_rows = []
    for day, pur in purchases:
        total = D(pur.get("total") or 0)
        purchase_total += total
        add(day, "costs", total)
        purchase_rows.append(
            {
                "id": pur.get("id"),
                "date": day.isoformat(),
                "supplier": pur.get("supplier") or pur.get("supplierName"),
                "invoiceNumber": pur.get("invoiceNumber") or pur.get("number"),
                "total": str(money(total)),
                "taxTotal": str(_tax(pur).get("taxTotal") or "0"),
                "projectName": project_names.get(str(pur.get("projectId") or "")),
            }
        )

    def gst_totals(docs: list[dict[str, Any]]) -> dict[str, str]:
        keys = ("taxableAmount", "cgst", "sgst", "igst", "taxTotal")
        sums = {k: D(0) for k in keys}
        for doc in docs:
            tax = _tax(doc)
            for k in keys:
                if k == "taxableAmount":
                    sums[k] += D(tax.get(k) or doc.get("subtotal") or doc.get("total") or 0)
                else:
                    sums[k] += D(tax.get(k) or 0)
        return {k: str(money(v)) for k, v in sums.items()}

    outward_docs = [inv for _, inv in invoices if inv.get("status") != "draft"]
    inward_docs = [pur for _, pur in purchases]
    outward = gst_totals(outward_docs)
    inward = gst_totals(inward_docs)
    outward_rows = [
        {
            "id": inv.get("id"),
            "number": inv.get("number"),
            "date": day.isoformat(),
            "party": customer_names.get(str(inv.get("customerId") or "")) or inv.get("customerName"),
            "gstin": customer_gstin.get(str(inv.get("customerId") or "")),
            "taxableAmount": str(_tax(inv).get("taxableAmount") or inv.get("subtotal") or inv.get("total") or "0"),
            "taxTotal": str(_tax(inv).get("taxTotal") or "0"),
            "total": str(inv.get("total") or "0"),
        }
        for day, inv in invoices
        if inv.get("status") != "draft"
    ]
    inward_rows = [
        {
            "id": pur.get("id"),
            "number": pur.get("invoiceNumber") or pur.get("number"),
            "date": day.isoformat(),
            "party": pur.get("supplier") or pur.get("supplierName"),
            "gstin": pur.get("supplierGstin"),
            "taxableAmount": str(_tax(pur).get("taxableAmount") or pur.get("subtotal") or pur.get("total") or "0"),
            "taxTotal": str(_tax(pur).get("taxTotal") or "0"),
            "total": str(pur.get("total") or "0"),
        }
        for day, pur in purchases
    ]

    status_counts = {"present": 0, "half_day": 0, "absent": 0, "leave": 0, "overtime": 0}
    workers: set[str] = set()
    attendance_marks = latest_marks([row for _, row in attendance])
    for row in attendance_marks:
        status = str(row.get("status") or "")
        if status in status_counts:
            status_counts[status] += 1
        if row.get("workerId"):
            workers.add(str(row["workerId"]))
    worker_days = status_counts["present"] + status_counts["overtime"] + status_counts["half_day"] / 2

    open_invoices = [
        inv for inv in invoices_all if inv.get("status") not in ("void", "draft") and D(inv.get("outstanding") or 0) > 0
    ]
    open_invoices.sort(key=lambda i: D(i.get("outstanding") or 0), reverse=True)
    balances: dict[str, dict[str, Any]] = {}
    for inv in open_invoices:
        cid = str(inv.get("customerId") or "")
        bal = balances.setdefault(
            cid, {"customerId": cid or None, "customerName": customer_names.get(cid) or "Customer", "outstanding": D(0), "invoiceCount": 0}
        )
        bal["outstanding"] += D(inv.get("outstanding") or 0)
        bal["invoiceCount"] += 1
    outstanding_now = money(sum((D(i.get("outstanding") or 0) for i in open_invoices), D(0)))

    costs = money(expense_total + purchase_total)
    net = money(collected - costs)
    return {
        "period": {"mode": mode, "year": year, "month": month, "label": label, "from": start.isoformat(), "to": end.isoformat()},
        "summary": {
            "billed": str(money(billed)),
            "invoiceCount": len(invoice_rows),
            "collected": str(money(collected)),
            "paymentCount": len(payment_rows),
            "expenses": str(money(expense_total)),
            "billableExpenses": str(money(billable_total)),
            "internalExpenses": str(money(expense_total - billable_total)),
            "expenseCount": len(expense_rows),
            "purchases": str(money(purchase_total)),
            "purchaseCount": len(purchase_rows),
            "costs": str(costs),
            "net": str(net),
            "margin": str(money(net / collected * 100)) if collected > 0 else None,
            "outputTax": outward["taxTotal"],
            "inputTax": inward["taxTotal"],
            "netTax": str(money(D(outward["taxTotal"]) - D(inward["taxTotal"]))),
            "outstandingNow": str(outstanding_now),
            "openInvoiceCount": len(open_invoices),
        },
        "trend": [
            {
                "key": b["key"],
                "label": b["label"],
                "year": b.get("year"),
                "month": b.get("month"),
                "billed": str(money(b["billed"])),
                "collected": str(money(b["collected"])),
                "costs": str(money(b["costs"])),
                "net": str(money(b["collected"] - b["costs"])),
            }
            for b in buckets
        ],
        "expenseByCategory": [
            {**c, "amount": str(money(c["amount"]))}
            for c in sorted(by_category.values(), key=lambda c: c["amount"], reverse=True)
        ],
        "topCustomers": [
            {**c, "billed": str(money(c["billed"])), "collected": str(money(c["collected"]))}
            for c in sorted(by_customer.values(), key=lambda c: (c["billed"], c["collected"]), reverse=True)[:5]
        ],
        "invoices": invoice_rows,
        "payments": payment_rows,
        "expenses": expense_rows,
        "purchases": purchase_rows,
        "gst": {"outward": outward, "inward": inward, "outwardRows": outward_rows, "inwardRows": inward_rows},
        "attendance": {
            "records": len(attendance_marks),
            "present": status_counts["present"],
            "halfDay": status_counts["half_day"],
            "absent": status_counts["absent"],
            "leave": status_counts["leave"],
            "overtime": status_counts["overtime"],
            "workers": len(workers),
            "workerDays": f"{worker_days:g}",
        },
        "receivables": {
            "customers": [
                {**b, "outstanding": str(money(b["outstanding"]))}
                for b in sorted(balances.values(), key=lambda b: b["outstanding"], reverse=True)
            ],
            "invoices": [
                {
                    "id": inv.get("id"),
                    "number": inv.get("number"),
                    "customerName": customer_names.get(str(inv.get("customerId") or "")),
                    "status": inv.get("status"),
                    "total": str(inv.get("total") or "0"),
                    "outstanding": str(inv.get("outstanding") or "0"),
                    "dueDate": inv.get("dueDate"),
                }
                for inv in open_invoices[:100]
            ],
        },
        "ledger": [
            {
                "id": e.get("id"),
                "date": day.isoformat(),
                "type": e.get("type"),
                "amount": str(e.get("amount") or "0"),
                "reference": e.get("reference"),
                "notes": e.get("notes"),
            }
            for day, e in entries
        ],
    }
