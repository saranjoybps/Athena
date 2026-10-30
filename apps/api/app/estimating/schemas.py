from typing import Literal

from pydantic import BaseModel

EstimateLineKind = Literal["work", "material", "tool", "other"]
EstimateCategory = Literal["labour", "materials", "tools", "other"]
BillingMethod = Literal["area", "quantity", "length", "time", "fixed"]


class EstimateItemIn(BaseModel):
    """One BOQ line. Customer amount = quantity × rate; the cost fields are internal only.

    - work: measured job item (e.g. wall painting, sqft) priced at a rate per unit
    - material: catalog material supplied to the customer, quantity in the material's own unit
    - tool: tool / equipment hire, quantity = units × days, rate per unit per day
    """

    kind: EstimateLineKind = "work"
    category: EstimateCategory | None = None
    billingMethod: BillingMethod | None = None
    # Fixed-scope lines bill the agreed amount unless this is set.
    priceByQuantity: bool = False
    description: str
    quantity: str
    unit: str
    materialCost: str = "0"
    labourCost: str = "0"
    equipmentCost: str = "0"
    otherCost: str = "0"
    rate: str | None = None
    measurementId: str | None = None
    measurementItemId: str | None = None
    catalogMaterialId: str | None = None
    toolId: str | None = None
    toolUnits: str | None = None
    days: str | None = None


class EstimateIn(BaseModel):
    customerId: str
    siteId: str
    surveyId: str | None = None
    measurementId: str | None = None
    workType: str | None = None
    title: str
    items: list[EstimateItemIn]
    equipmentCost: str = "0"
    transportCost: str = "0"
    subcontractorCost: str = "0"
    otherCost: str = "0"
    markupRate: str | None = None
    marginRate: str | None = None
    discount: str = "0"
    taxRate: str = "0"
    supplierState: str | None = None
    placeOfSupply: str | None = None
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
    validUntil: str | None = None
