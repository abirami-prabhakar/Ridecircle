from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://ridecircle:ridecircle-local-only@localhost:54329/ridecircle"
    jwt_secret: str = "local-development-secret-change-before-deploying"
    cookie_secure: bool = False
    ai_mode: Literal["rules", "ollama"] = "rules"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"
    ors_api_key: str = ""
    routing_provider: Literal["osrm", "ors", "disabled"] = "osrm"
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000"]


settings = Settings()
