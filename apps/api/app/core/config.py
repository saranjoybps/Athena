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
    # Preferred for deploy: full service-account JSON (or base64 of that JSON).
    firebase_credentials_json: str = ""
    # Legacy/local: path to SA JSON file, or (rarely) inline JSON starting with '{'.
    google_application_credentials: str = ""
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    cloudinary_folder: str = "athena"
    cloudinary_upload_preset: str = "Athena"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    rate_limit: str = "120/minute"
    platform_admin_uids: str = ""
    trial_duration_days: int = 15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",") if o.strip()]

    @property
    def platform_admin_uid_set(self) -> set[str]:
        return {u.strip() for u in self.platform_admin_uids.split(",") if u.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
