from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://preppilot:local-dev-only@localhost:5432/preppilot"
    frontend_origins: list[str] = ["http://localhost:5173", "http://localhost:8000"]
    cookie_secure: bool = False
    session_hours: int = Field(default=168, ge=1, le=720)
    upload_dir: Path = Path(".data/uploads")
    max_upload_mb: int = Field(default=5, ge=1, le=10)
    resume_retention_days: int = Field(default=30, ge=1, le=365)
    openrouter_api_key: str = ""
    openrouter_model: str = ""
    openrouter_require_zdr: bool = True
    ai_requests_per_day: int = Field(default=20, ge=1, le=1000)

    @property
    def ai_enabled(self) -> bool:
        return bool(self.openrouter_api_key and self.openrouter_model)

    @model_validator(mode="after")
    def production_rules(self):
        if self.app_env == "production":
            if not self.cookie_secure or not self.database_url.startswith("postgresql"):
                raise ValueError("Production requires PostgreSQL and COOKIE_SECURE=true")
            if not self.frontend_origins or any(not v.startswith("https://") for v in self.frontend_origins):
                raise ValueError("Production requires explicit HTTPS frontend origins")
        return self
