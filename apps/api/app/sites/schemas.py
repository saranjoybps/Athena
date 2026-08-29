from pydantic import BaseModel, Field


class SiteIn(BaseModel):
    customerId: str
    name: str
    address: str
    pinCode: str | None = None
    lat: float | None = None
    lng: float | None = None
    mapsUrl: str | None = None
    contactName: str | None = None
    phone: str | None = None
    siteType: str | None = None
    accessInstructions: str | None = None
    workingHours: str | None = None
    parking: str | None = None
    deliveryInstructions: str | None = None
    photos: list[str] = Field(default_factory=list)
    documents: list[str] = Field(default_factory=list)
