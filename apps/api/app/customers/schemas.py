import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

_PHONE = re.compile(r"^\+?\d{10,13}$")
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
_GSTIN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_PAN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

CustomerType = Literal["individual", "company"]
CustomerSource = Literal["referral", "walk_in", "phone", "website", "social", "repeat", "other"]


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _phone(value: str | None) -> str | None:
    value = _clean(value)
    if value is None:
        return None
    compact = re.sub(r"[\s-]", "", value)
    if not _PHONE.match(compact):
        raise ValueError("Enter a valid phone number (10 to 13 digits).")
    return compact


class _CustomerFields(BaseModel):
    @field_validator("name", check_fields=False)
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if _clean(v) is None:
            raise ValueError("Customer name is required.")
        return _clean(v)

    @field_validator("company", "address", "billingAddress", "notes", check_fields=False)
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return _clean(v)

    @field_validator("alternatePhone", check_fields=False)
    @classmethod
    def _alt_phone(cls, v: str | None) -> str | None:
        return _phone(v)

    @field_validator("email", check_fields=False)
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        v = _clean(v)
        if v is not None:
            v = v.lower()
            if not _EMAIL.match(v):
                raise ValueError("Enter a valid email address.")
        return v

    @field_validator("gstin", check_fields=False)
    @classmethod
    def _gstin(cls, v: str | None) -> str | None:
        v = _clean(v)
        if v is not None:
            v = v.upper()
            if not _GSTIN.match(v):
                raise ValueError("Enter a valid 15-character GSTIN.")
        return v

    @field_validator("pan", check_fields=False)
    @classmethod
    def _pan(cls, v: str | None) -> str | None:
        v = _clean(v)
        if v is not None:
            v = v.upper()
            if not _PAN.match(v):
                raise ValueError("Enter a valid PAN (e.g. ABCDE1234F).")
        return v


class CustomerIn(_CustomerFields):
    type: CustomerType = "individual"
    name: str
    company: str | None = None
    phone: str
    alternatePhone: str | None = None
    email: str | None = None
    address: str | None = None
    gstin: str | None = None
    pan: str | None = None
    billingAddress: str | None = None
    source: CustomerSource | None = None
    notes: str | None = None
    documents: list[str] = Field(default_factory=list)

    @field_validator("phone")
    @classmethod
    def _main_phone(cls, v: str) -> str:
        cleaned = _phone(v)
        if cleaned is None:
            raise ValueError("Phone number is required.")
        return cleaned


class CustomerUpdateIn(_CustomerFields):
    """Partial update: only the fields the client sends are changed."""

    type: CustomerType | None = None
    name: str | None = None
    company: str | None = None
    phone: str | None = None
    alternatePhone: str | None = None
    email: str | None = None
    address: str | None = None
    gstin: str | None = None
    pan: str | None = None
    billingAddress: str | None = None
    source: CustomerSource | None = None
    notes: str | None = None

    @field_validator("phone")
    @classmethod
    def _main_phone(cls, v: str | None) -> str | None:
        cleaned = _phone(v)
        if cleaned is None:
            raise ValueError("Phone number is required.")
        return cleaned
