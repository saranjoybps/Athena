from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class EstimateItemIn(BaseModel):
    description: str
    quantity: str
    unit: str
    materialCost: str = "0"
    labourCost: str = "0"
    equipmentCost: str = "0"
    otherCost: str = "0"
    rate: str | None = None


class EstimateIn(BaseModel):
    customerId: str
    siteId: str
    surveyId: str | None = None
    measurementId: str | None = None
    title: str
    items: list[EstimateItemIn]
    equipmentCost: str = "0"
    transportCost: str = "0"
    subcontractorCost: str = "0"
    otherCost: str = "0"
    markupRate: str | None = None
    marginRate: str | None = None
    discount: str = "0"
    taxRate: str = "0.18"
    supplierState: str = "Tamil Nadu"
    placeOfSupply: str = "Tamil Nadu"
    registeredCustomer: bool = False
    included: str | None = None
    excluded: str | None = None
    assumptions: str | None = None
    materialsNotes: str | None = None
    workmanship: str | None = None
    warranty: str | None = None
    timeline: str | None = None
    paymentTerms: str | None = None
    clientResponsibilities: str | None = None
    contractorResponsibilities: str | None = None
    reason: str | None = None
