"""Stock/Inventory service - business logic for stock operations."""

from typing import Any, Dict, List, Optional, Tuple

from app.core.exceptions import NotFoundError, OdooOperationError, ValidationError
from app.core.logging import get_logger
from app.models.stock import (
    StockAdjustment,
    StockLocationResponse,
    StockMoveCreate,
    StockMoveResponse,
    StockPickingCreate,
    StockPickingResponse,
    StockWarehouseResponse,
)
from app.services.odoo_client import get_odoo_client

logger = get_logger(__name__)

MOVE_FIELDS = [
    "id", "product_id", "product_uom_qty", "product_uom", "location_id",
    "location_dest_id", "date", "reference", "state", "origin", "name",
]

PICKING_FIELDS = [
    "id", "name", "partner_id", "picking_type_id", "scheduled_date",
    "date_done", "state", "origin", "move_ids_without_package",
]


class StockService:
    """Service layer for stock operations."""

    def __init__(self):
        self.client = get_odoo_client()

    def get_stock_movements(
        self,
        offset: int = 0,
        limit: int = 50,
        product_id: Optional[int] = None,
        state: Optional[str] = None,
        move_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Tuple[List[StockMoveResponse], int]:
        """Get stock movements with filters."""
        domain: List[Any] = []

        if product_id:
            domain.append(("product_id", "=", product_id))
        if state:
            domain.append(("state", "=", state))
        if date_from:
            domain.append(("date", ">=", date_from))
        if date_to:
            domain.append(("date", "<=", date_to))

        total = self.client.search_count("stock.move", domain)
        records = self.client.search_read(
            "stock.move", domain,
            fields=MOVE_FIELDS,
            offset=offset,
            limit=limit,
            order="date desc",
        )

        moves = [StockMoveResponse.from_odoo(r) for r in records]
        return moves, total

    def create_incoming_shipment(self, data: StockPickingCreate) -> StockPickingResponse:
        """Record an incoming shipment (receipt)."""
        # Get the receipts picking type
        picking_types = self.client.search_read(
            "stock.picking.type",
            [("code", "=", "incoming")],
            fields=["id", "name", "default_location_src_id", "default_location_dest_id"],
            limit=1,
        )

        if not picking_types:
            raise OdooOperationError("No incoming picking type configured in Odoo")

        picking_type = picking_types[0]

        # Create the picking
        picking_vals = {
            "picking_type_id": picking_type["id"],
            "location_id": picking_type.get("default_location_src_id", [False])[0] if isinstance(picking_type.get("default_location_src_id"), (list, tuple)) else 8,  # Supplier location
            "location_dest_id": picking_type.get("default_location_dest_id", [False])[0] if isinstance(picking_type.get("default_location_dest_id"), (list, tuple)) else 12,  # Stock location
        }

        if data.partner_id:
            picking_vals["partner_id"] = data.partner_id
        if data.scheduled_date:
            picking_vals["scheduled_date"] = data.scheduled_date
        if data.origin:
            picking_vals["origin"] = data.origin

        picking_id = self.client.create("stock.picking", picking_vals)

        # Create move lines
        for line in data.lines:
            move_vals = {
                "name": f"Incoming: {line.reference or 'N/A'}",
                "product_id": line.product_id,
                "product_uom_qty": line.quantity,
                "picking_id": picking_id,
                "location_id": picking_vals["location_id"],
                "location_dest_id": picking_vals["location_dest_id"],
            }
            self.client.create("stock.move", move_vals)

        # Confirm and validate
        try:
            self.client.execute_kw("stock.picking", "action_confirm", [[picking_id]])
            self.client.execute_kw("stock.picking", "action_assign", [[picking_id]])
        except Exception as e:
            logger.warning("Could not auto-confirm picking", picking_id=picking_id, error=str(e))

        return self._get_picking(picking_id)

    def create_outgoing_delivery(self, data: StockPickingCreate) -> StockPickingResponse:
        """Record an outgoing delivery."""
        picking_types = self.client.search_read(
            "stock.picking.type",
            [("code", "=", "outgoing")],
            fields=["id", "name", "default_location_src_id", "default_location_dest_id"],
            limit=1,
        )

        if not picking_types:
            raise OdooOperationError("No outgoing picking type configured in Odoo")

        picking_type = picking_types[0]

        picking_vals = {
            "picking_type_id": picking_type["id"],
            "location_id": picking_type.get("default_location_src_id", [False])[0] if isinstance(picking_type.get("default_location_src_id"), (list, tuple)) else 12,
            "location_dest_id": picking_type.get("default_location_dest_id", [False])[0] if isinstance(picking_type.get("default_location_dest_id"), (list, tuple)) else 5,  # Customer location
        }

        if data.partner_id:
            picking_vals["partner_id"] = data.partner_id
        if data.scheduled_date:
            picking_vals["scheduled_date"] = data.scheduled_date
        if data.origin:
            picking_vals["origin"] = data.origin

        picking_id = self.client.create("stock.picking", picking_vals)

        for line in data.lines:
            move_vals = {
                "name": f"Outgoing: {line.reference or 'N/A'}",
                "product_id": line.product_id,
                "product_uom_qty": line.quantity,
                "picking_id": picking_id,
                "location_id": picking_vals["location_id"],
                "location_dest_id": picking_vals["location_dest_id"],
            }
            self.client.create("stock.move", move_vals)

        try:
            self.client.execute_kw("stock.picking", "action_confirm", [[picking_id]])
            self.client.execute_kw("stock.picking", "action_assign", [[picking_id]])
        except Exception as e:
            logger.warning("Could not auto-confirm picking", picking_id=picking_id, error=str(e))

        return self._get_picking(picking_id)

    def adjust_stock(self, data: StockAdjustment) -> Dict[str, Any]:
        """Manual stock adjustment / inventory update."""
        # Use stock.quant for stock adjustment in Odoo 16+
        location_id = data.location_id

        if not location_id:
            # Get main stock location
            warehouses = self.client.search_read(
                "stock.warehouse", [],
                fields=["lot_stock_id"],
                limit=1,
            )
            if warehouses:
                lot = warehouses[0].get("lot_stock_id")
                location_id = lot[0] if isinstance(lot, (list, tuple)) and lot else None

        if not location_id:
            raise ValidationError("Could not determine stock location for adjustment")

        # Check if a quant exists
        quants = self.client.search_read(
            "stock.quant",
            [("product_id", "=", data.product_id), ("location_id", "=", location_id)],
            fields=["id", "quantity"],
            limit=1,
        )

        try:
            if quants:
                # Update existing quant
                self.client.write("stock.quant", [quants[0]["id"]], {
                    "inventory_quantity": data.new_quantity,
                })
                # Apply the inventory adjustment
                self.client.execute_kw("stock.quant", "action_apply_inventory", [[quants[0]["id"]]])
            else:
                # Create new quant
                quant_id = self.client.create("stock.quant", {
                    "product_id": data.product_id,
                    "location_id": location_id,
                    "inventory_quantity": data.new_quantity,
                })
                self.client.execute_kw("stock.quant", "action_apply_inventory", [[quant_id]])

            return {
                "success": True,
                "product_id": data.product_id,
                "new_quantity": data.new_quantity,
                "location_id": location_id,
                "message": "Stock adjustment applied successfully",
            }
        except Exception as e:
            logger.error("Stock adjustment failed", error=str(e))
            raise OdooOperationError(
                message=f"Stock adjustment failed: {str(e)}",
                details={"product_id": data.product_id},
            )

    def get_locations(self) -> List[StockLocationResponse]:
        """Get all stock locations."""
        records = self.client.search_read(
            "stock.location",
            [("usage", "in", ["internal", "transit"])],
            fields=["id", "name", "complete_name", "usage", "active"],
            order="complete_name asc",
        )
        return [
            StockLocationResponse(
                id=r["id"],
                name=r["name"],
                complete_name=r.get("complete_name"),
                usage=r.get("usage"),
                active=r.get("active", True),
            )
            for r in records
        ]

    def get_warehouses(self) -> List[StockWarehouseResponse]:
        """Get all warehouses."""
        records = self.client.search_read(
            "stock.warehouse", [],
            fields=["id", "name", "code", "partner_id"],
            order="name asc",
        )
        return [
            StockWarehouseResponse(
                id=r["id"],
                name=r["name"],
                code=r.get("code"),
                partner_id=r.get("partner_id"),
            )
            for r in records
        ]

    def _get_picking(self, picking_id: int) -> StockPickingResponse:
        """Get a single picking with its moves."""
        records = self.client.read("stock.picking", [picking_id], fields=PICKING_FIELDS)
        if not records:
            raise NotFoundError("Stock Picking", picking_id)

        picking = records[0]
        move_ids = picking.get("move_ids_without_package", [])

        moves = []
        if move_ids:
            moves = self.client.read("stock.move", move_ids, fields=MOVE_FIELDS)

        return StockPickingResponse.from_odoo(picking, moves)

    def get_pickings(
        self,
        picking_type: Optional[str] = None,
        state: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> Tuple[List[StockPickingResponse], int]:
        """Get stock pickings with filters."""
        domain: List[Any] = []

        if picking_type:
            domain.append(("picking_type_id.code", "=", picking_type))
        if state:
            domain.append(("state", "=", state))

        total = self.client.search_count("stock.picking", domain)
        records = self.client.search_read(
            "stock.picking", domain,
            fields=PICKING_FIELDS,
            offset=offset,
            limit=limit,
            order="scheduled_date desc",
        )

        pickings = []
        for r in records:
            move_ids = r.get("move_ids_without_package", [])
            moves = []
            if move_ids:
                moves = self.client.read("stock.move", move_ids, fields=MOVE_FIELDS)
            pickings.append(StockPickingResponse.from_odoo(r, moves))

        return pickings, total


def get_stock_service() -> StockService:
    return StockService()
