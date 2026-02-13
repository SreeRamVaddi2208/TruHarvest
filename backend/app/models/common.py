"""Common/shared Pydantic models."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    odoo_connected: bool
    odoo_version: Optional[str] = None


class SyncStatusResponse(BaseModel):
    """Sync status response."""
    success: bool = True
    last_sync: Optional[str] = None
    products_synced: int = 0
    stock_synced: int = 0
    invoices_synced: int = 0
    sync_in_progress: bool = False
    errors: List[str] = []


class SyncTriggerResponse(BaseModel):
    """Sync trigger response."""
    success: bool = True
    message: str = "Sync triggered successfully"
    task_id: Optional[str] = None


class DashboardStats(BaseModel):
    """Dashboard statistics."""
    total_products: int = 0
    total_stock_value: float = 0.0
    low_stock_count: int = 0
    out_of_stock_count: int = 0
    pending_incoming: int = 0
    pending_outgoing: int = 0
    total_invoices: int = 0
    unpaid_invoices: int = 0
    revenue_this_month: float = 0.0
    top_products: List[Dict[str, Any]] = []
    recent_movements: List[Dict[str, Any]] = []
    stock_by_category: List[Dict[str, Any]] = []
    # Pending transfers so dashboard shows incoming/outgoing as soon as they are added
    pending_incoming_list: List[Dict[str, Any]] = []
    pending_outgoing_list: List[Dict[str, Any]] = []


class PartnerResponse(BaseModel):
    """Partner/customer response."""
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    vat: Optional[str] = None
    is_company: bool = False

    @classmethod
    def from_odoo(cls, data: Dict[str, Any]) -> "PartnerResponse":
        # Odoo returns False for empty fields
        def _s(val: Any) -> Optional[str]:
            return val if isinstance(val, str) else None

        country = data.get("country_id")
        return cls(
            id=data.get("id", 0),
            name=data.get("name") or "",
            email=_s(data.get("email")),
            phone=_s(data.get("phone")),
            street=_s(data.get("street")),
            city=_s(data.get("city")),
            country=country[1] if isinstance(country, (list, tuple)) and len(country) > 1 else None,
            vat=_s(data.get("vat")),
            is_company=bool(data.get("is_company")) if data.get("is_company") is not False else False,
        )


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None
    errors: Optional[List[str]] = None
