from pydantic import BaseModel, Field


class ProjectFromQuoteIn(BaseModel):
    quoteId: str
    name: str | None = None
    startDate: str | None = None
    expectedCompletion: str | None = None
    projectManagerId: str | None = None
    supervisorId: str | None = None


class AdvanceIn(BaseModel):
    projectId: str
    amount: str
    method: str = "upi"
    reference: str | None = None
    kind: str = "fixed"  # fixed | percentage
    percentage: str | None = None


class InvoiceIn(BaseModel):
    projectId: str
    kind: str = "progress"  # progress | milestone | final | quantity | tnm
    items: list[dict]
    taxRate: str = "0"
    placeOfSupply: str | None = None
    supplierState: str | None = None
    registeredCustomer: bool = False
    overrideCap: bool = False
    dueDate: str | None = None


class PaymentIn(BaseModel):
    invoiceId: str
    amount: str
    method: str
    reference: str | None = None
    notes: str | None = None


class PaymentUpdateIn(BaseModel):
    amount: str | None = None
    method: str | None = None
    reference: str | None = None
    notes: str | None = None


class ExpenseIn(BaseModel):
    projectId: str
    category: str
    amount: str
    paidBy: str = "cash"
    description: str | None = None
    receiptUrl: str | None = None
    clientIdempotencyKey: str | None = None
    billableToCustomer: bool = False
    budgetLineId: str | None = None


class ChangeOrderIn(BaseModel):
    projectId: str
    reason: str
    additionalScope: str | None = None
    additionalCost: str
    sellingPrice: str
    photos: list[str] = Field(default_factory=list)


class SnagIn(BaseModel):
    projectId: str
    location: str | None = None
    description: str
    photoUrl: str | None = None
    assignedUserId: str | None = None
    dueDate: str | None = None


class AttendanceIn(BaseModel):
    projectId: str
    workerId: str | None = None
    crewId: str | None = None
    date: str | None = None
    status: str  # present | half_day | absent | overtime | leave
    overtimeHours: str = "0"
    photoUrl: str | None = None
    lat: float | None = None
    lng: float | None = None
    clientIdempotencyKey: str | None = None


class AttendanceUpdateIn(BaseModel):
    status: str
    overtimeHours: str | None = None


class DailyReportIn(BaseModel):
    projectId: str
    workCompleted: str | None = None
    quantityCompleted: str | None = None
    materialsConsumed: list[dict] = Field(default_factory=list)
    expenses: list[dict] = Field(default_factory=list)
    problems: str | None = None
    delays: str | None = None
    weather: str | None = None
    photos: list[str] = Field(default_factory=list)
    progressPercent: str | None = None
    clientIdempotencyKey: str | None = None
