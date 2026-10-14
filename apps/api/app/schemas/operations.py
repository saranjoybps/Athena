from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


def _required_text(value: str, label: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{label} is required.")
    return cleaned


class MaterialIn(BaseModel):
    name: str
    sku: str | None = None
    category: str | None = None
    subcategory: str | None = None
    brand: str | None = None
    unit: str = "pcs"
    purchaseUnit: str | None = None
    consumptionUnit: str | None = None
    packSize: str | None = None
    coverage: str | None = None
    hsn: str | None = None
    gstRate: float = 0.18
    defaultPurchasePrice: str | None = None
    defaultSellingPrice: str | None = None
    supplierId: str | None = None
    minimumStock: str | None = None
    reorderLevel: str | None = None
    active: bool = True

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        return _required_text(value, "Material name")

    @field_validator("unit")
    @classmethod
    def unit_required(cls, value: str) -> str:
        return _required_text(value, "Unit")

    @field_validator("gstRate")
    @classmethod
    def gst_fraction(cls, value: float) -> float:
        # gstRate is stored as a fraction (0.18); tolerate percent input from older clients.
        rate = value / 100 if value > 1 else value
        if rate < 0 or rate > 1:
            raise ValueError("GST rate must be between 0% and 100%.")
        return rate


class SupplierIn(BaseModel):
    name: str
    company: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    gstin: str | None = None
    pan: str | None = None
    paymentTerms: str | None = None
    materials: list[str] = Field(default_factory=list)


class LabourIn(BaseModel):
    name: str
    phone: str | None = None
    trade: str | None = None
    skill: str | None = None
    dailyRate: str | None = None
    hourlyRate: str | None = None
    overtimeRate: str | None = None
    paymentMethod: str | None = None
    workerType: str = "employee"
    active: bool = True

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        return _required_text(value, "Worker name")


class CrewMemberIn(BaseModel):
    """Labour attached to a crew. Accepts legacy workerId from older clients."""

    labourId: str
    name: str | None = None
    role: str | None = None

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_worker_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            lid = data.get("labourId") or data.get("workerId")
            if lid:
                out = {**data, "labourId": str(lid)}
                out.pop("workerId", None)
                return out
        return data


class CrewIn(BaseModel):
    name: str
    trade: str | None = None
    members: list[CrewMemberIn] = Field(default_factory=list)
    dailyCost: str | None = None
    expectedProductivity: str | None = None

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        return _required_text(value, "Crew name")


class InventoryIn(BaseModel):
    """Tools inventory (not material stock)."""

    name: str
    qty: str = "0"
    warehouse: str = "main"
    siteId: str | None = None

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        return _required_text(value, "Tool name")

    @field_validator("qty")
    @classmethod
    def qty_non_negative(cls, value: str) -> str:
        try:
            qty = float(str(value).strip() or "0")
        except ValueError as exc:
            raise ValueError("Quantity must be a number.") from exc
        if qty < 0:
            raise ValueError("Quantity can't be negative.")
        return str(value).strip() or "0"


class InventoryTxnIn(BaseModel):
    toolId: str | None = None
    materialId: str | None = None  # legacy
    qty: str
    type: str  # in | out | issue | return | transfer | adjustment | damage | wastage
    projectId: str | None = None
    warehouse: str = "main"
    notes: str | None = None


class MaterialRequestIn(BaseModel):
    projectId: str
    materialId: str
    qty: str
    notes: str | None = None


class PurchaseOrderIn(BaseModel):
    supplierId: str
    projectId: str | None = None
    items: list[dict] = Field(default_factory=list)
    notes: str | None = None


class PurchaseIn(BaseModel):
    supplierId: str | None = None
    supplier: str | None = None
    projectId: str | None = None
    invoiceNumber: str | None = None
    items: list[dict] = Field(default_factory=list)
    payment: str = "cash"
    total: str | None = None
    tax: dict | None = None


class DeliveryIn(BaseModel):
    purchaseOrderId: str | None = None
    purchaseId: str | None = None
    projectId: str | None = None
    items: list[dict] = Field(default_factory=list)
    receivedBy: str | None = None


class DeliveryChallanIn(BaseModel):
    """Outbound delivery challan (not inbound GRN)."""

    customerId: str
    projectId: str | None = None
    siteId: str | None = None
    date: str | None = None
    vehicleNumber: str | None = None
    receiverName: str | None = None
    receiverSignatureUrl: str | None = None
    notes: str | None = None
    items: list[dict] = Field(default_factory=list)
    status: str = "draft"


class DeliveryChallanUpdate(BaseModel):
    customerId: str | None = None
    projectId: str | None = None
    siteId: str | None = None
    date: str | None = None
    vehicleNumber: str | None = None
    receiverName: str | None = None
    receiverSignatureUrl: str | None = None
    notes: str | None = None
    items: list[dict] | None = None
    status: str | None = None


class PhotoIn(BaseModel):
    projectId: str
    category: str = "progress"
    url: str
    description: str | None = None
    workItemId: str | None = None
    lat: float | None = None
    lng: float | None = None


class DocumentIn(BaseModel):
    projectId: str | None = None
    siteId: str | None = None
    category: str = "other"
    url: str
    name: str
    publicId: str | None = None


class NotificationIn(BaseModel):
    title: str
    body: str | None = None
    userId: str | None = None
    projectId: str | None = None


class VehicleIn(BaseModel):
    type: str
    name: str | None = None
    registration: str | None = None
    driver: str | None = None


class TransportTripIn(BaseModel):
    vehicleId: str
    projectId: str | None = None
    supplierId: str | None = None
    material: str | None = None
    quantity: str | None = None
    cost: str | None = None
    date: str | None = None


class ScheduleIn(BaseModel):
    projectId: str
    workPackageId: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    crewId: str | None = None
    supervisorId: str | None = None
    progress: int = 0
    dayType: str = "full_day"  # full_day | half_day


class ScheduleUpdateIn(BaseModel):
    startDate: str | None = None
    endDate: str | None = None
    crewId: str | None = None


class AssignmentIn(BaseModel):
    projectId: str
    userId: str
    role: str = "supervisor"


class GroupIn(BaseModel):
    name: str
    type: str = "crew"
    memberIds: list[str] = Field(default_factory=list)
