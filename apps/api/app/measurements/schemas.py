from typing import Any

from pydantic import BaseModel, Field


class MeasurementIn(BaseModel):
    surveyId: str | None = None
    siteId: str
    customerId: str
    title: str | None = None
    formulaKind: str = "painting"
    inputs: dict[str, Any]
    originalUnit: str = "sqft"
    notes: str | None = None
    clientIdempotencyKey: str | None = None
    formulaConfig: dict[str, Any] = Field(default_factory=dict)
    billBySqft: bool = False
    perSqftRate: str | None = None
    photos: list[dict[str, Any]] = Field(default_factory=list)
