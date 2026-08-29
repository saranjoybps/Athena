from pydantic import BaseModel, Field


class QuoteCreateIn(BaseModel):
    estimateId: str
    validityDays: int = 15
    notes: str | None = None


class QuoteDecisionIn(BaseModel):
    comment: str | None = None
    signature: str | None = None
