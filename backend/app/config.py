import os
from dataclasses import dataclass


def _csv(value: str) -> list[str]:
    # This turns comma-separated environment values into clean lists.
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str
    allowed_origins: list[str]
    api_keys: list[str]
    model: str
    api_base: str | None
    default_system_prompt: str
    enable_failure_simulation: bool

    @classmethod
    def from_env(cls) -> "Settings":
        # All deployment-specific settings come from environment variables.
        database_url = os.getenv("DATABASE_URL", "sqlite:///./app.db")
        if database_url.startswith("sqlite:///"):
            database_path = database_url.removeprefix("sqlite:///")
        else:
            database_path = database_url
        return cls(
            database_url=database_path,
            allowed_origins=_csv(os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")),
            api_keys=_csv(os.getenv("LLM_API_KEYS", "")),
            model=os.getenv("LLM_MODEL", "groq/llama-3.1-8b-instant"),
            api_base=os.getenv("LLM_API_BASE") or None,
            default_system_prompt=os.getenv(
                "DEFAULT_SYSTEM_PROMPT",
                "You are a helpful, concise assistant.",
            ),
            enable_failure_simulation=os.getenv(
                "ENABLE_FAILURE_SIMULATION", "false"
            ).lower()
            == "true",
        )
