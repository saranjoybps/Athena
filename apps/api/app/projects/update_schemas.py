from pydantic import BaseModel, Field


class ProjectUpdateIn(BaseModel):
    name: str | None = None
    status: str | None = None  # scheduled | active | on_hold | completed
    startDate: str | None = None
    expectedCompletion: str | None = None
    completionPercent: int | None = None
    projectManagerId: str | None = None
    supervisorId: str | None = None
    internalNotes: str | None = None


class QuoteUpdateIn(BaseModel):
    notes: str | None = None
    validityDays: int | None = None


class InvoiceUpdateIn(BaseModel):
    notes: str | None = None
    dueDate: str | None = None
    kind: str | None = None


class ExpenseUpdateIn(BaseModel):
    category: str | None = None
    amount: str | None = None
    paidBy: str | None = None
    description: str | None = None
    receiptUrl: str | None = None
    billableToCustomer: bool | None = None
