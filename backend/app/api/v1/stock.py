"""Stock/Inventory API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query

from app.core.roles import require_controller_role
from app.models.stock import (
    StockAdjustment,
    StockMovementListResponse,
    StockMoveCreate,
    StockPickingCreate,
    StockPickingResponse,
)
from app.models.common import APIResponse
from app.services.stock_service import get_stock_service

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.get("/movements", response_model=StockMovementListResponse)
def list_stock_movements(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    product_id: Optional[int] = Query(None, description="Filter by product"),
    state: Optional[str] = Query(None, description="Filter by state"),
    date_from: Optional[str] = Query(None, description="From date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="To date (YYYY-MM-DD)"),
):
    """Get stock movement history."""
    service = get_stock_service()
    moves, total = service.get_stock_movements(
        offset=offset,
        limit=limit,
        product_id=product_id,
        state=state,
        date_from=date_from,
        date_to=date_to,
    )
    return StockMovementListResponse(
        data=moves,
        total=total,
        offset=offset,
        limit=limit,
        has_more=(offset + limit) < total,
    )


@router.post("/incoming", response_model=APIResponse)
def create_incoming_shipment(data: StockPickingCreate):
    """Record an incoming shipment (receipt)."""
    service = get_stock_service()
    picking = service.create_incoming_shipment(data)
    return APIResponse(data=picking, message="Incoming shipment created successfully")


@router.post("/outgoing", response_model=APIResponse)
def create_outgoing_delivery(data: StockPickingCreate):
    """Record an outgoing delivery."""
    service = get_stock_service()
    picking = service.create_outgoing_delivery(data)
    return APIResponse(data=picking, message="Outgoing delivery created successfully")


@router.post("/adjust", response_model=APIResponse)
def adjust_stock(data: StockAdjustment):
    """Manual stock adjustment."""
    service = get_stock_service()
    result = service.adjust_stock(data)
    return APIResponse(data=result, message="Stock adjusted successfully")


@router.get("/locations")
def get_locations():
    """Get all stock locations."""
    service = get_stock_service()
    locations = service.get_locations()
    return {"success": True, "data": locations}


@router.get("/warehouses")
def get_warehouses():
    """Get all warehouses."""
    service = get_stock_service()
    warehouses = service.get_warehouses()
    return {"success": True, "data": warehouses}


@router.post("/setup-warehouse", response_model=APIResponse)
def setup_markwave_warehouse():
    """Create Markwave warehouse in Odoo if it does not exist (controller/admin only).
    This creates the warehouse and its locations so incoming/outgoing shipments work.
    """
    require_controller_role()
    service = get_stock_service()
    result = service.setup_markwave_warehouse()
    return APIResponse(
        data=result,
        message=result.get("message", "Warehouse setup complete"),
    )


@router.post("/pickings/{picking_id}/confirm", response_model=APIResponse)
def confirm_picking(picking_id: int):
    """Confirm a draft picking (controller or admin role required)."""
    require_controller_role()
    service = get_stock_service()
    picking = service.confirm_picking(picking_id)
    return APIResponse(data=picking, message="Picking confirmed successfully")


@router.post("/pickings/{picking_id}/validate", response_model=APIResponse)
def validate_picking(picking_id: int):
    """Validate a picking (set to done, update stock) (controller or admin role required)."""
    require_controller_role()
    service = get_stock_service()
    picking = service.validate_picking(picking_id)
    return APIResponse(data=picking, message="Picking validated successfully")


@router.get("/pickings")
def list_pickings(
    picking_type: Optional[str] = Query(None, description="Filter: incoming, outgoing, internal"),
    state: Optional[str] = Query(None, description="Filter by state"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Get stock pickings (shipments/deliveries)."""
    service = get_stock_service()
    pickings, total = service.get_pickings(
        picking_type=picking_type,
        state=state,
        offset=offset,
        limit=limit,
    )
    return {
        "success": True,
        "data": pickings,
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": (offset + limit) < total,
    }
