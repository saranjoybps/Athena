from pydantic import BaseModel, Field


class CustomerIn(BaseModel):
    type: str = "individual"
    name: str
    company: str | None = None
    phone: str
    alternatePhone: str | None = None
    email: str | None = None
    address: str | None = None
    gstin: str | None = None
    pan: str | None = None
    billingAddress: str | None = None
    notes: str | None = None
    documents: list[str] = Field(default_factory=list)
