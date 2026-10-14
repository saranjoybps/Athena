import re

from pydantic import BaseModel, Field, field_validator

_PIN = re.compile(r"^[1-9][0-9]{5}$")


class SiteIn(BaseModel):
    customerId: str
    name: str
    address: str
    pinCode: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    mapsUrl: str | None = None
    locationSource: str | None = None
    contactName: str | None = None
    phone: str | None = None
    siteType: str | None = None
    accessInstructions: str | None = None
    workingHours: str | None = None
    parking: str | None = None
    deliveryInstructions: str | None = None
    photos: list[str] = Field(default_factory=list)
    documents: list[str] = Field(default_factory=list)

    @field_validator("name", "address")
    @classmethod
    def _required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("This field is required.")
        return v

    @field_validator("pinCode")
    @classmethod
    def _pin(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if not v:
            return None
        if not _PIN.match(v):
            raise ValueError("Enter a valid 6-digit PIN code.")
        return v
