"""Stock/Inventory-related Pydantic models."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.utils.odoo_helpers import (
    clean_odoo_record, odoo_str, odoo_float, odoo_m2o_id, odoo_m2o_name,
)


class StockMoveCreate(BaseModel):
    """Create a stock movement."""
    product_id: int = Field(..., description="Product ID")
    quantity: float = Field(..., gt=0, description="Quantity to move")
    location_id: Optional[int] = Field(None, description="Source location ID")
    location_dest_id: Optional[int] = Field(None, description="Destination location ID")
    move_type: str = Field(..., description="Movement type: incoming, outgoing, internal")
    reference: Optional[str] = Field(None, description="Reference/note for the movement")
    scheduled_date: Optional[str] = Field(None, description="Scheduled date (ISO format)")


class StockMoveResponse(BaseModel):
    """Stock movement response."""
    id: int
    product_id: int
    product_name: str
    quantity: float
    product_uom: Optional[str] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    location_dest_id: Optional[int] = None
    location_dest_name: Optional[str] = None
    date: Optional[str] = None
    reference: Optional[str] = None
    state: Optional[str] = None
    origin: Optional[str] = None
    picking_type: Optional[str] = None

    @classmethod
    def from_odoo(cls, data: Dict[str, Any]) -> "StockMoveResponse":
        """Create from raw Odoo data."""
        d = clean_odoo_record(data)
        raw_date = d.get("date")
        ref = d.get("reference") or d.get("name")

        return cls(
            id=d.get("id", 0),
            product_id=odoo_m2o_id(data.get("product_id")) or 0,
            product_name=odoo_m2o_name(data.get("product_id")) or "",
            quantity=odoo_float(d.get("product_uom_qty")),
            product_uom=odoo_m2o_name(data.get("product_uom")),
            location_id=odoo_m2o_id(data.get("location_id")),
            location_name=odoo_m2o_name(data.get("location_id")),
            location_dest_id=odoo_m2o_id(data.get("location_dest_id")),
            location_dest_name=odoo_m2o_name(data.get("location_dest_id")),
            date=str(raw_date) if raw_date else None,
            reference=ref if isinstance(ref, str) else None,
            state=odoo_str(d.get("state")),
            origin=odoo_str(d.get("origin")),
            picking_type=None,
        )


class StockAdjustment(BaseModel):
    """Manual stock adjustment."""
    product_id: int = Field(..., description="Product ID")
    new_quantity: float = Field(..., ge=0, description="New quantity on hand")
    location_id: Optional[int] = Field(None, description="Location ID (default: main warehouse)")
    reason: Optional[str] = Field(None, description="Reason for adjustment")


class StockPickingCreate(BaseModel):
    """Create a stock picking (incoming/outgoing shipment)."""
    partner_id: Optional[int] = Field(None, description="Partner/supplier ID")
    picking_type: str = Field(..., description="Type: incoming, outgoing, internal")
    scheduled_date: Optional[str] = Field(None, description="Scheduled date")
    origin: Optional[str] = Field(None, description="Source document reference")
    lines: List[StockMoveCreate] = Field(..., min_length=1, description="Stock move lines")


class StockPickingResponse(BaseModel):
    """Stock picking response."""
    id: int
    name: str
    partner_id: Optional[int] = None
    partner_name: Optional[str] = None
    picking_type: Optional[str] = None
    scheduled_date: Optional[str] = None
    date_done: Optional[str] = None
    state: Optional[str] = None
    origin: Optional[str] = None
    move_lines: List[StockMoveResponse] = []

    @classmethod
    def from_odoo(cls, data: Dict[str, Any], moves: Optional[List[Dict[str, Any]]] = None) -> "StockPickingResponse":
        d = clean_odoo_record(data)
        raw_sched = d.get("scheduled_date")
        raw_done = d.get("date_done")
        return cls(
            id=d.get("id", 0),
            name=d.get("name") or "",
            partner_id=odoo_m2o_id(data.get("partner_id")),
            partner_name=odoo_m2o_name(data.get("partner_id")),
            picking_type=odoo_m2o_name(data.get("picking_type_id")),
            scheduled_date=str(raw_sched) if raw_sched else None,
            date_done=str(raw_done) if raw_done else None,
            state=odoo_str(d.get("state")),
            origin=odoo_str(d.get("origin")),
            move_lines=[StockMoveResponse.from_odoo(m) for m in (moves or [])],
        )


class StockLocationResponse(BaseModel):
    """Stock location info."""
    id: int
    name: str
    complete_name: Optional[str] = None
    usage: Optional[str] = None
    active: bool = True


class StockMovementListResponse(BaseModel):
    """Paginated stock movement list."""
    success: bool = True
    data: List[StockMoveResponse]
    total: int
    offset: int
    limit: int
    has_more: bool


class StockWarehouseResponse(BaseModel):
    """Warehouse info."""
    id: int
    name: str
    code: Optional[str] = None
    partner_id: Optional[Any] = None
