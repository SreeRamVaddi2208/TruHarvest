"""Stock/Inventory service - business logic for stock operations."""

from typing import Any, Dict, List, Optional, Tuple

from app.core.config import get_settings
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

    def _get_company_location_ids(self, company_id: int) -> Dict[str, int]:
        """Get location IDs for the given company (supplier, internal/stock, customer).
        Use these to avoid 'Incompatible companies' when picking type defaults point to another company.
        """
        # Locations must belong to this company or be shared (company_id = False)
        locs = self.client.search_read(
            "stock.location",
            [
                ("company_id", "in", [False, company_id]),
                ("usage", "in", ["supplier", "internal", "customer"]),
            ],
            fields=["id", "usage", "company_id"],
            limit=20,
        )
        by_usage: Dict[str, int] = {}
        for loc in locs:
            u = (loc.get("usage") or "").strip()
            cid = loc.get("company_id")
            # Prefer location that belongs to this company; accept shared (False)
            if u and (cid == company_id or cid is False or cid is None):
                if u not in by_usage:
                    by_usage[u] = loc["id"]
        return by_usage

    def _resolve_picking_locations(
        self,
        company_id: int,
        picking_type: Dict[str, Any],
        direction: str,
    ) -> Tuple[int, int]:
        """Resolve (location_id, location_dest_id) for the company. Use picking type defaults
        only if they belong to the same company; otherwise use company locations.
        direction: 'incoming' | 'outgoing'
        """
        src_raw = picking_type.get("default_location_src_id")
        dest_raw = picking_type.get("default_location_dest_id")
        src_id = src_raw[0] if isinstance(src_raw, (list, tuple)) and src_raw else (src_raw if isinstance(src_raw, int) else None)
        dest_id = dest_raw[0] if isinstance(dest_raw, (list, tuple)) and dest_raw else (dest_raw if isinstance(dest_raw, int) else None)

        # Read locations to check company_id
        use_type_defaults = True
        if src_id or dest_id:
            ids = [x for x in [src_id, dest_id] if x]
            recs = self.client.read("stock.location", ids, fields=["company_id"]) if ids else []
            for r in recs:
                cid = r.get("company_id")
                if cid is not None and cid is not False and cid != company_id:
                    use_type_defaults = False
                    break

        if use_type_defaults and src_id and dest_id:
            return src_id, dest_id

        # Fallback: company locations by usage (must belong to this company or be shared)
        by_usage = self._get_company_location_ids(company_id)
        if direction == "incoming":
            loc_id = by_usage.get("supplier")
            loc_dest_id = by_usage.get("internal")
        else:
            loc_id = by_usage.get("internal")
            loc_dest_id = by_usage.get("customer")

        if not loc_id or not loc_dest_id:
            raise OdooOperationError(
                "No stock locations found for company_id=%s (Markwave). "
                "For %s: need %s. Create a warehouse and locations for this company in Odoo."
                % (
                    company_id,
                    direction,
                    "supplier and internal" if direction == "incoming" else "internal and customer",
                )
            )
        return loc_id, loc_dest_id

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
        """Record an incoming shipment (receipt) in the Markwave company so it appears on the dashboard."""
        company_id = get_settings().ODOO_MARKWAVE_COMPANY_ID
        # Get the Markwave company's incoming picking type so the picking is in the right company
        picking_types = self.client.search_read(
            "stock.picking.type",
            [("code", "=", "incoming"), ("company_id", "=", company_id)],
            fields=["id", "name", "default_location_src_id", "default_location_dest_id"],
            limit=1,
        )

        if not picking_types:
            raise OdooOperationError(
                "No incoming picking type configured in Odoo for company_id=%s (Markwave)" % company_id
            )

        picking_type = picking_types[0]
        location_id, location_dest_id = self._resolve_picking_locations(
            company_id, picking_type, "incoming"
        )

        # Create the picking in Markwave company so it shows on the dashboard
        picking_vals = {
            "picking_type_id": picking_type["id"],
            "company_id": company_id,
            "location_id": location_id,
            "location_dest_id": location_dest_id,
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
        """Record an outgoing delivery in the Markwave company so it appears on the dashboard."""
        company_id = get_settings().ODOO_MARKWAVE_COMPANY_ID
        picking_types = self.client.search_read(
            "stock.picking.type",
            [("code", "=", "outgoing"), ("company_id", "=", company_id)],
            fields=["id", "name", "default_location_src_id", "default_location_dest_id"],
            limit=1,
        )

        if not picking_types:
            raise OdooOperationError(
                "No outgoing picking type configured in Odoo for company_id=%s (Markwave)" % company_id
            )

        picking_type = picking_types[0]
        location_id, location_dest_id = self._resolve_picking_locations(
            company_id, picking_type, "outgoing"
        )

        picking_vals = {
            "picking_type_id": picking_type["id"],
            "company_id": company_id,
            "location_id": location_id,
            "location_dest_id": location_dest_id,
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

    def setup_markwave_warehouse(self) -> Dict[str, Any]:
        """Create a warehouse for the Markwave company in Odoo if none exists.
        Odoo creates the default locations (supplier, internal, customer) when a warehouse is created.
        Returns dict with created (bool), warehouse_id (int), message (str).
        """
        company_id = get_settings().ODOO_MARKWAVE_COMPANY_ID
        existing = self.client.search_read(
            "stock.warehouse",
            [("company_id", "=", company_id)],
            fields=["id", "name"],
            limit=1,
        )
        if existing:
            return {
                "created": False,
                "warehouse_id": existing[0]["id"],
                "message": "Markwave warehouse already exists in Odoo.",
            }
        try:
            warehouse_id = self.client.create(
                "stock.warehouse",
                {
                    "name": "Markwave",
                    "code": "MARKW",
                    "company_id": company_id,
                },
            )
            logger.info(
                "markwave_warehouse_created",
                warehouse_id=warehouse_id,
                company_id=company_id,
            )
            return {
                "created": True,
                "warehouse_id": warehouse_id,
                "message": "Markwave warehouse created in Odoo. Incoming and outgoing shipments can now use it.",
            }
        except Exception as e:
            logger.error(
                "markwave_warehouse_create_failed",
                company_id=company_id,
                error=str(e),
            )
            raise OdooOperationError(
                "Failed to create Markwave warehouse in Odoo: %s. "
                "Ensure the Odoo user has rights to create warehouses." % (e,)
            )

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
        """Get stock pickings with filters (Markwave company only, so they match the dashboard)."""
        company_id = get_settings().ODOO_MARKWAVE_COMPANY_ID
        domain: List[Any] = [("company_id", "=", company_id)]

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

    def _ensure_picking_locations_same_company(self, picking_id: int) -> None:
        """If the picking's locations belong to another company, update picking and moves
        to use the correct company locations so action_confirm does not fail.
        """
        company_id = get_settings().ODOO_MARKWAVE_COMPANY_ID
        records = self.client.read(
            "stock.picking",
            [picking_id],
            fields=["company_id", "location_id", "location_dest_id", "picking_type_id", "move_ids_without_package"],
        )
        if not records:
            return
        picking = records[0]
        pick_company = picking.get("company_id")
        if isinstance(pick_company, (list, tuple)):
            pick_company = pick_company[0] if pick_company else None
        if pick_company and pick_company != company_id:
            return  # Picking belongs to another company; don't change it
        loc_src = picking.get("location_id")
        loc_dest = picking.get("location_dest_id")
        src_id = loc_src[0] if isinstance(loc_src, (list, tuple)) and loc_src else (loc_src if isinstance(loc_src, int) else None)
        dest_id = loc_dest[0] if isinstance(loc_dest, (list, tuple)) and loc_dest else (loc_dest if isinstance(loc_dest, int) else None)
        if not src_id and not dest_id:
            return
        # Check if these locations belong to the picking's company (or shared)
        loc_ids = [x for x in [src_id, dest_id] if x]
        loc_recs = self.client.read("stock.location", loc_ids, fields=["company_id"]) if loc_ids else []
        same_company = True
        for r in loc_recs:
            cid = r.get("company_id")
            if cid is not None and cid is not False and cid != (pick_company or company_id):
                same_company = False
                break
        if same_company:
            return
        # Resolve correct locations for this picking type (incoming/outgoing)
        pt_id = picking.get("picking_type_id")
        pt_id = pt_id[0] if isinstance(pt_id, (list, tuple)) and pt_id else pt_id
        if not pt_id:
            return
        pt_recs = self.client.read(
            "stock.picking.type",
            [pt_id],
            fields=["code", "default_location_src_id", "default_location_dest_id"],
        )
        if not pt_recs:
            return
        direction = "incoming" if (pt_recs[0].get("code") or "").strip().lower() == "incoming" else "outgoing"
        new_src, new_dest = self._resolve_picking_locations(company_id, pt_recs[0], direction)
        self.client.write("stock.picking", [picking_id], {"location_id": new_src, "location_dest_id": new_dest})
        move_ids = picking.get("move_ids_without_package") or []
        if move_ids:
            self.client.write("stock.move", move_ids, {"location_id": new_src, "location_dest_id": new_dest})
        logger.info(
            "fixed_picking_locations_for_company",
            picking_id=picking_id,
            company_id=company_id,
            new_location_id=new_src,
            new_location_dest_id=new_dest,
        )

    def confirm_picking(self, picking_id: int) -> StockPickingResponse:
        """Confirm a draft picking (controller/admin only).
        If the picking has locations from another company, they are corrected before confirm.
        """
        records = self.client.read("stock.picking", [picking_id], fields=["state"])
        if not records:
            raise NotFoundError("Stock Picking", picking_id)
        state = (records[0].get("state") or "").strip().lower()
        if state not in ("draft",):
            raise ValidationError(
                "Picking can only be confirmed from draft state (current: %s)" % (state or "unknown")
            )
        self._ensure_picking_locations_same_company(picking_id)
        self.client.execute_kw("stock.picking", "action_confirm", [[picking_id]])
        try:
            self.client.execute_kw("stock.picking", "action_assign", [[picking_id]])
        except Exception as e:
            logger.warning("action_assign failed after confirm", picking_id=picking_id, error=str(e))
        return self._get_picking(picking_id)

    def validate_picking(self, picking_id: int) -> StockPickingResponse:
        """Validate a picking (set to done) so stock is updated (controller/admin only)."""
        records = self.client.read("stock.picking", [picking_id], fields=["state"])
        if not records:
            raise NotFoundError("Stock Picking", picking_id)
        state = (records[0].get("state") or "").strip().lower()
        if state == "done":
            return self._get_picking(picking_id)
        if state not in ("assigned", "confirmed", "waiting", "wait"):
            raise ValidationError(
                "Picking must be confirmed/assigned before validation (current: %s)" % (state or "unknown")
            )
        # Odoo 16: button_validate on stock.picking
        self.client.execute_kw("stock.picking", "button_validate", [[picking_id]])
        return self._get_picking(picking_id)


def get_stock_service() -> StockService:
    return StockService()
