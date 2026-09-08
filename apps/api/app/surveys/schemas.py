from pydantic import BaseModel, Field


class SurveyIn(BaseModel):
    customerId: str
    siteId: str
    projectType: str = ""
    surveyorId: str | None = None
    date: str | None = None
    photos: list[str] = Field(default_factory=list)
    videos: list[str] = Field(default_factory=list)
    voiceNotes: list[str] = Field(default_factory=list)
    drawings: list[str] = Field(default_factory=list)
    existingConditions: str | None = None
    clientRequirements: str | None = None
    scope: str | None = None
    exclusions: str | None = None
    assumptions: str | None = None
    notes: str | None = None
    clientIdempotencyKey: str | None = None
