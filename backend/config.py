"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    
    # Database
    database_path: str = str(Path(__file__).parent.parent / "data" / "ceqt.db")
    
    # JWT
    jwt_secret: str = ""  # auto-generated if empty
    jwt_expire_days: int = 7
    
    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_default_model: str = "deepseek-v4-flash"
    deepseek_api_url: str = "https://api.deepseek.com/v1/chat/completions"
    
    # Audit
    audit_dir: str = str(Path(__file__).parent.parent / "data" / "audit")
    
    # Logs
    log_dir: str = str(Path(__file__).parent.parent / "data" / "logs")
    
    # CORS (allow frontend from any origin in dev)
    cors_origins: list[str] = ["*"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
