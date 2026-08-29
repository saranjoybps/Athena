from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class AppError(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or {}


def error_payload(request: Request, exc: Exception) -> tuple[int, dict[str, Any]]:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(exc, AppError):
        return exc.status_code, {
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "requestId": request_id,
            }
        }
    if isinstance(exc, HTTPException):
        return exc.status_code, {
            "error": {
                "code": "http_error",
                "message": str(exc.detail),
                "details": {},
                "requestId": request_id,
            }
        }
    return 500, {
        "error": {
            "code": "internal_error",
            "message": "An unexpected error occurred.",
            "details": {},
            "requestId": request_id,
        }
    }


async def app_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    status, body = error_payload(request, exc)
    return JSONResponse(status_code=status, content=body)
