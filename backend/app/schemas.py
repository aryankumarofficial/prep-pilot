from datetime import date
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Register(Input):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=2, max_length=80)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("Enter your name")
        return value.strip()


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class Profile(Input):
    full_name: str = Field(min_length=2, max_length=80)
    target_role: Literal["Java Developer"] = "Java Developer"
    target_date: date
    daily_minutes: int = Field(ge=15, le=480)
    timezone: str = "Asia/Kolkata"

    @field_validator("timezone")
    @classmethod
    def valid_zone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("Use an IANA timezone such as Asia/Kolkata") from error
        return value


class StartAttempt(Input):
    request_key: UUID


class SaveAnswer(Input):
    question_id: UUID
    selected_option: Literal["a", "b", "c", "d"] | None


class Recalculate(Input):
    request_key: UUID


class CompleteTask(Input):
    completed: bool


class JobInput(Input):
    title: str = Field(min_length=3, max_length=160)
    raw_text: str = Field(min_length=40, max_length=12000)
    resume_id: UUID | None = None


class InterviewInput(Input):
    job_description_id: UUID | None = None


class InterviewAnswer(Input):
    turn_id: UUID
    answer: str = Field(min_length=3, max_length=6000)


class EvidenceMatch(Input):
    skill_id: str = Field(max_length=50)
    evidence: str = Field(min_length=2, max_length=500)


class SkillExtraction(Input):
    required_skills: list[EvidenceMatch] = Field(max_length=30)
    resume_skills: list[EvidenceMatch] = Field(max_length=30)


class InterviewFeedback(Input):
    correctness: int = Field(ge=0, le=4)
    clarity: int = Field(ge=0, le=4)
    completeness: int = Field(ge=0, le=4)
    examples: int = Field(ge=0, le=4)
    strengths: list[str] = Field(min_length=1, max_length=4)
    improvements: list[str] = Field(min_length=1, max_length=4)
    follow_up: str | None = Field(max_length=400)
