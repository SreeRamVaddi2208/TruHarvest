"""Auth / current user role API."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.models.common import APIResponse

router = APIRouter(tags=["Auth"])


@router.get("/me", response_model=APIResponse)
def get_current_role():
    """Return the current app user role (viewer, controller, admin).
    Used by the frontend to show/hide draft controls and state-update actions.
    """
    role = (get_settings().APP_USER_ROLE or "viewer").strip().lower()
    if role not in ("viewer", "controller", "admin"):
        role = "viewer"
    return APIResponse(data={"role": role})
