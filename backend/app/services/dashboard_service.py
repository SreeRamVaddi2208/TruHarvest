"""Dashboard service - aggregated statistics and analytics."""

from typing import Any, Dict, List

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.common import DashboardStats
from app.services.odoo_client import get_odoo_client

logger = get_logger(__name__)


def _get_markwave_products_from_rest() -> List[Dict[str, Any]]:
    """Fetch Markwave products from REST API. Returns [] if unavailable."""
    settings = get_settings()
    base = (settings.ODOO_REST_API_URL or "").strip().rstrip("/")
    if not base:
        return []
    try:
        url = f"{base}/products"
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
        if isinstance(data, list):
            return [p for p in data if isinstance(p, dict)]
        if isinstance(data, dict):
            return list(data.get("data", []))
        return []
    except Exception as e:
        logger.warning("dashboard_markwave_products_fetch_failed", error=str(e), url=base)
        return []


def _is_storable_product(p: Dict[str, Any]) -> bool:
    """Only storable products (type=product). Exclude service, consu, and Down Payment by name."""
    ptype = (p.get("type") or "").strip().lower()
    if ptype != "product":
        return False
    name = (p.get("name") or "").lower()
    if "down payment" in name or "downpayment" in name:
        return False
    return True


def _get_markwave_products() -> List[Dict[str, Any]]:
    """Markwave products: from Odoo when PREFER_ODOO_FOR_PRODUCTS else from REST API.
    Only storable products (type=product); excludes Down Payment and services.
    """
    settings = get_settings()
    if settings.PREFER_ODOO_FOR_PRODUCTS:
        try:
            client = get_odoo_client()
            # Only storable products (as in Odoo: display only storable)
            domain = [
                ("company_id", "=", settings.ODOO_MARKWAVE_COMPANY_ID),
                ("active", "=", True),
                ("type", "=", "product"),
            ]
            records = client.search_read(
                "product.product",
                domain,
                fields=["id", "name", "default_code", "qty_available", "standard_price", "product_tmpl_id", "categ_id", "type"],
                limit=5000,
            )
            raw = [dict(r) for r in records]
            return [p for p in raw if _is_storable_product(p)]
        except Exception as e:
            logger.warning("dashboard_odoo_products_fetch_failed", error=str(e))
            return []
    raw = _get_markwave_products_from_rest()
    return [p for p in raw if _is_storable_product(p)]


class DashboardService:
    """Service layer for dashboard analytics. Product stats use Markwave API only."""

    def __init__(self):
        self.client = get_odoo_client()

    def get_stats(self) -> DashboardStats:
        """Get comprehensive dashboard statistics. Product metrics are Markwave-only."""
        try:
            stats = DashboardStats()

            # --- Markwave products only (REST API) ---
            products = _get_markwave_products()

            def _qty(p: Dict[str, Any]) -> float:
                return float(p.get("qty_available") or 0)

            def _price(p: Dict[str, Any]) -> float:
                return float(p.get("standard_price") or 0)

            stats.total_products = len(products)
            stats.total_stock_value = sum(_qty(p) * _price(p) for p in products)
            stats.low_stock_count = sum(1 for p in products if 0 < _qty(p) < 10)
            stats.out_of_stock_count = sum(1 for p in products if _qty(p) <= 0)

            # Top products by quantity (Markwave only)
            sorted_by_qty = sorted(
                [p for p in products if _qty(p) > 0],
                key=lambda p: _qty(p),
                reverse=True,
            )[:10]
            stats.top_products = [
                {
                    "name": p.get("name", ""),
                    "sku": p.get("default_code") if isinstance(p.get("default_code"), str) else "",
                    "qty": _qty(p),
                    "value": round(_qty(p) * _price(p), 2),
                }
                for p in sorted_by_qty
            ]

            # --- Odoo (Markwave only: company_id = 2) ---
            company_id = get_settings().ODOO_MARKWAVE_COMPANY_ID

            # Include draft, wait, waiting, confirmed, assigned so new transfers show immediately
            _pending_states = ["draft", "wait", "waiting", "confirmed", "assigned"]

            incoming_domain = [
                ("company_id", "=", company_id),
                ("picking_type_id.code", "=", "incoming"),
                ("state", "in", _pending_states),
            ]
            stats.pending_incoming = self.client.search_count("stock.picking", incoming_domain)
            incoming_pickings = self.client.search_read(
                "stock.picking",
                incoming_domain,
                fields=["id", "name", "state", "scheduled_date", "origin"],
                limit=10,
                order="id desc",
            )
            stats.pending_incoming_list = [
                {
                    "id": p.get("id"),
                    "name": p.get("name", ""),
                    "state": p.get("state", ""),
                    "scheduled_date": str(p.get("scheduled_date", "")),
                    "origin": p.get("origin") or "",
                }
                for p in incoming_pickings
            ]

            outgoing_domain = [
                ("company_id", "=", company_id),
                ("picking_type_id.code", "=", "outgoing"),
                ("state", "in", _pending_states),
            ]
            stats.pending_outgoing = self.client.search_count("stock.picking", outgoing_domain)
            outgoing_pickings = self.client.search_read(
                "stock.picking",
                outgoing_domain,
                fields=["id", "name", "state", "scheduled_date", "origin"],
                limit=10,
                order="id desc",
            )
            stats.pending_outgoing_list = [
                {
                    "id": p.get("id"),
                    "name": p.get("name", ""),
                    "state": p.get("state", ""),
                    "scheduled_date": str(p.get("scheduled_date", "")),
                    "origin": p.get("origin") or "",
                }
                for p in outgoing_pickings
            ]
            stats.total_invoices = self.client.search_count(
                "account.move",
                [("company_id", "=", company_id), ("move_type", "in", ["out_invoice", "in_invoice"])],
            )
            stats.unpaid_invoices = self.client.search_count(
                "account.move",
                [
                    ("company_id", "=", company_id),
                    ("move_type", "=", "out_invoice"),
                    ("payment_state", "!=", "paid"),
                    ("state", "=", "posted"),
                ],
            )

            # Recent stock movements: only for products in the Markwave products API (excludes Animals etc.)
            markwave_product_ids: List[int] = []
            for p in products:
                pid = p.get("id")
                if isinstance(pid, int):
                    markwave_product_ids.append(pid)
                elif isinstance(pid, str) and pid.isdigit():
                    markwave_product_ids.append(int(pid))

            move_domain = [("company_id", "=", company_id), ("state", "=", "done")]
            if markwave_product_ids:
                move_domain.append(("product_id", "in", markwave_product_ids))
            else:
                # No Markwave product list: show no movements (do not fall back to all moves)
                move_domain.append(("id", "=", -1))
            recent_moves = self.client.search_read(
                "stock.move",
                move_domain,
                fields=["product_id", "product_uom_qty", "date", "reference", "location_id", "location_dest_id"],
                limit=10,
                order="date desc",
            )
            stats.recent_movements = [
                {
                    "product": m["product_id"][1] if isinstance(m.get("product_id"), (list, tuple)) else "",
                    "qty": m.get("product_uom_qty", 0),
                    "date": str(m.get("date", "")),
                    "reference": m.get("reference", ""),
                }
                for m in recent_moves
            ]

            # Stock by category: derive from Markwave products (by product_tmpl_id name)
            by_tmpl: Dict[str, Dict[str, Any]] = {}
            for p in products:
                tmpl = p.get("product_tmpl_id")
                name = tmpl[1] if isinstance(tmpl, (list, tuple)) and len(tmpl) > 1 else p.get("name", "Other")
                if name not in by_tmpl:
                    by_tmpl[name] = {"quantity": 0, "value": 0.0}
                q, pr = _qty(p), _price(p)
                by_tmpl[name]["quantity"] += q
                by_tmpl[name]["value"] += q * pr
            stats.stock_by_category = [
                {"category": k, "quantity": round(v["quantity"], 2), "value": round(v["value"], 2)}
                for k, v in sorted(by_tmpl.items(), key=lambda x: -x[1]["quantity"])[:10]
                if v["quantity"] > 0
            ]

            return stats

        except Exception as e:
            logger.error("Failed to get dashboard stats", error=str(e))
            return DashboardStats()


def get_dashboard_service() -> DashboardService:
    return DashboardService()
