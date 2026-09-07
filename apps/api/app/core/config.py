from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "Athena API"
    api_prefix: str = "/api/v1"
    athena_store: str = "memory"  # memory | firestore
    athena_auth: str = "dev"  # dev | firebase
    api_cors_origins: str = "http://localhost:3000"
    firebase_project_id: str = ""
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    rate_limit: str = "120/minute"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
