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


class InvoiceFromQuoteIn(BaseModel):
    kind: str = "final"
    notes: str | None = None
    dueDate: str | None = None
    overrideCap: bool = False
    projectId: str | None = None
