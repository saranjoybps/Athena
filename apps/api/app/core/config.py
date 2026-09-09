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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Expose SA path for google-cloud / firebase-admin ADC
    if settings.google_application_credentials:
        import os
        from pathlib import Path

        raw = settings.google_application_credentials.strip()
        cred = Path(raw)
        if not cred.is_absolute():
            # config.py lives at apps/api/app/core/config.py → repo root is parents[4]
            # Prefer monorepo root so `firebase-credentials.json` resolves from Athena/
            here = Path(__file__).resolve()
            api_dir = here.parents[2]  # apps/api
            repo_root = here.parents[4]  # Athena
            for candidate in (
                (repo_root / raw).resolve(),
                (api_dir / raw).resolve(),
                (Path.cwd() / raw).resolve(),
            ):
                if candidate.is_file():
                    cred = candidate
                    break
            else:
                cred = (repo_root / raw).resolve()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(cred)
    return settings
