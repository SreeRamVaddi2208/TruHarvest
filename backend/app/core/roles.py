"""Role checks for state-control operations (draft acceptance, confirm, validate)."""

from fastapi import HTTPException

from app.core.config import get_settings


def can_control_state() -> bool:
    """True if the current app role can work with draft and update state (controller or admin)."""
    role = (get_settings().APP_USER_ROLE or "").strip().lower()
    return role in ("controller", "admin")


def require_controller_role() -> None:
    """Raise 403 if the current role cannot control state (confirm, validate, update)."""
    if not can_control_state():
        raise HTTPException(
            status_code=403,
            detail="This action requires controller or admin role (draft acceptance and state updates).",
        )
