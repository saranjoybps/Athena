"""Resolve Firebase / GCP service-account credentials from env (preferred) or file."""

from __future__ import annotations

import base64
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


def _parse_json_blob(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if not text:
        return None
    # Allow base64-wrapped JSON (handy on hosts that mangle newlines).
    if not text.startswith("{"):
        try:
            decoded = base64.b64decode(text).decode("utf-8")
            text = decoded.strip()
        except Exception:
            return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or not data.get("private_key"):
        return None
    # Env paste often keeps literal \n instead of real newlines.
    pk = data.get("private_key")
    if isinstance(pk, str) and "\\n" in pk and "\n" not in pk:
        data["private_key"] = pk.replace("\\n", "\n")
    return data


def _load_from_file(path_raw: str) -> dict[str, Any] | None:
    raw = (path_raw or "").strip()
    if not raw or raw.startswith("{"):
        return None
    path = Path(raw)
    if not path.is_absolute():
        here = Path(__file__).resolve()
        api_dir = here.parents[2]  # apps/api
        repo_root = here.parents[4]  # Athena
        for candidate in (
            (repo_root / raw).resolve(),
            (api_dir / raw).resolve(),
            (Path.cwd() / raw).resolve(),
        ):
            if candidate.is_file():
                path = candidate
                break
        else:
            path = (repo_root / raw).resolve()
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) and data.get("private_key") else None


@lru_cache
def get_service_account_info() -> dict[str, Any] | None:
    """Prefer inline env JSON; fall back to GOOGLE_APPLICATION_CREDENTIALS file path."""
    from app.core.config import get_settings

    settings = get_settings()
    # 1) Dedicated deploy env (full SA JSON or base64)
    info = _parse_json_blob(getattr(settings, "firebase_credentials_json", "") or "")
    if info:
        return info
    # 2) Same content stuffed into GOOGLE_APPLICATION_CREDENTIALS (starts with '{')
    gac = (settings.google_application_credentials or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
    if gac.startswith("{"):
        info = _parse_json_blob(gac)
        if info:
            return info
    # 3) Local file path (dev fallback)
    return _load_from_file(gac)


def get_google_credentials():
    """google.oauth2 service-account credentials for Firestore / GCS clients."""
    info = get_service_account_info()
    if not info:
        return None
    from google.oauth2 import service_account

    return service_account.Credentials.from_service_account_info(info)
