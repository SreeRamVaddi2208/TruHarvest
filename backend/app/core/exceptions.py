"""Custom exception classes and exception handlers."""

from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str = "An unexpected error occurred",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class OdooConnectionError(AppException):
    """Raised when Odoo connection fails."""

    def __init__(self, message: str = "Failed to connect to Odoo", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=503, details=details)


class OdooAuthenticationError(AppException):
    """Raised when Odoo authentication fails."""

    def __init__(self, message: str = "Odoo authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=401, details=details)


class OdooOperationError(AppException):
    """Raised when an Odoo operation fails."""

    def __init__(self, message: str = "Odoo operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=500, details=details)


class NotFoundError(AppException):
    """Raised when a resource is not found."""

    def __init__(self, resource: str = "Resource", resource_id: Any = None):
        message = f"{resource} not found"
        if resource_id is not None:
            message = f"{resource} with id '{resource_id}' not found"
        super().__init__(message=message, status_code=404)


class ValidationError(AppException):
    """Raised for validation errors."""

    def __init__(self, message: str = "Validation error", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=422, details=details)


class RateLimitError(AppException):
    """Raised when rate limit is exceeded."""

    def __init__(self):
        super().__init__(message="Rate limit exceeded. Please try again later.", status_code=429)


# --- Exception Handlers ---

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "details": exc.details,
                "type": type(exc).__name__,
            },
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.detail,
                "type": "HTTPException",
            },
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions."""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "message": "An internal server error occurred",
                "type": "InternalServerError",
            },
        },
    )
