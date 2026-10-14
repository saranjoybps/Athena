from pydantic import BaseModel, Field


class DocumentBrandingIn(BaseModel):
    companyName: str | None = None
    companyAddress: str | None = None
    gstNumber: str | None = None
    pan: str | None = None
    phone: str | None = None
    email: str | None = None
    bankName: str | None = None
    bankBranch: str | None = None
    bankAccountHolder: str | None = None
    bankAccountNumber: str | None = None
    bankIfscCode: str | None = None
    upiId: str | None = None
    termsConditions: str | None = None
    logoUrl: str | None = None
    sealUrl: str | None = None
    signatureUrl: str | None = None
    brandColor: str | None = Field(default=None, pattern=r"^(#[0-9A-Fa-f]{6})?$")
    website: str | None = None
    estimateTerms: str | None = None
    state: str | None = Field(default=None, max_length=60)
    defaultGstRate: str | None = Field(default=None, pattern=r"^(\d{1,2}(\.\d{1,2})?)?$")
    estimateValidityDays: str | None = Field(default=None, pattern=r"^(\d{1,3})?$")
    invoiceDueDays: str | None = Field(default=None, pattern=r"^(\d{1,3})?$")
    signatoryName: str | None = Field(default=None, max_length=80)
    signatoryDesignation: str | None = Field(default=None, max_length=60)


class InvoiceFromQuoteIn(BaseModel):
    kind: str = "final"
    notes: str | None = None
    dueDate: str | None = None
    overrideCap: bool = False
    projectId: str | None = None


class QuoteUpdateIn(BaseModel):
    notes: str | None = None
    validityDays: int | None = None
    scope: dict | None = None


class InvoiceLineUpdateIn(BaseModel):
    description: str
    amount: str = "0"
    quantity: str | None = "1"
    unit: str | None = ""
    rate: str | None = None
    labourCost: str | None = None
    gstRate: str | None = None
    hsn: str | None = None
    catalogMaterialId: str | None = None


class InvoiceUpdateIn(BaseModel):
    notes: str | None = None
    dueDate: str | None = None
    kind: str | None = None
    status: str | None = None  # draft | sent | paid | void
    taxRate: str | None = None
    placeOfSupply: str | None = None
    supplierState: str | None = None
    registeredCustomer: bool | None = None
    items: list[InvoiceLineUpdateIn] | None = None
