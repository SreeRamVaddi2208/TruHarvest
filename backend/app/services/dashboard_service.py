"""Dashboard service - aggregated statistics and analytics."""

from typing import Any, Dict, List

from app.core.logging import get_logger
from app.models.common import DashboardStats
from app.services.odoo_client import get_odoo_client

logger = get_logger(__name__)


class DashboardService:
    """Service layer for dashboard analytics."""

    def __init__(self):
        self.client = get_odoo_client()

    def get_stats(self) -> DashboardStats:
        """Get comprehensive dashboard statistics."""
        try:
            stats = DashboardStats()

            # Total products
            stats.total_products = self.client.search_count(
                "product.product",
                [("type", "=", "product"), ("active", "=", True)],
            )

            # Stock value calculation
            products = self.client.search_read(
                "product.product",
                [("type", "=", "product"), ("active", "=", True)],
                fields=["qty_available", "standard_price"],
            )
            stats.total_stock_value = sum(
                (p.get("qty_available", 0) * p.get("standard_price", 0))
                for p in products
            )

            # Low stock (< 10 units)
            stats.low_stock_count = self.client.search_count(
                "product.product",
                [("type", "=", "product"), ("active", "=", True), ("qty_available", ">", 0), ("qty_available", "<", 10)],
            )

            # Out of stock
            stats.out_of_stock_count = self.client.search_count(
                "product.product",
                [("type", "=", "product"), ("active", "=", True), ("qty_available", "<=", 0)],
            )

            # Pending incoming shipments
            stats.pending_incoming = self.client.search_count(
                "stock.picking",
                [("picking_type_id.code", "=", "incoming"), ("state", "in", ["assigned", "confirmed", "waiting"])],
            )

            # Pending outgoing deliveries
            stats.pending_outgoing = self.client.search_count(
                "stock.picking",
                [("picking_type_id.code", "=", "outgoing"), ("state", "in", ["assigned", "confirmed", "waiting"])],
            )

            # Total invoices
            stats.total_invoices = self.client.search_count(
                "account.move",
                [("move_type", "in", ["out_invoice", "in_invoice"])],
            )

            # Unpaid invoices
            stats.unpaid_invoices = self.client.search_count(
                "account.move",
                [("move_type", "=", "out_invoice"), ("payment_state", "!=", "paid"), ("state", "=", "posted")],
            )

            # Top products by stock value
            top_products = self.client.search_read(
                "product.product",
                [("type", "=", "product"), ("active", "=", True), ("qty_available", ">", 0)],
                fields=["name", "default_code", "qty_available", "standard_price"],
                limit=10,
                order="qty_available desc",
            )
            stats.top_products = [
                {
                    "name": p["name"],
                    "sku": p.get("default_code", ""),
                    "qty": p.get("qty_available", 0),
                    "value": round(p.get("qty_available", 0) * p.get("standard_price", 0), 2),
                }
                for p in top_products
            ]

            # Recent stock movements
            recent_moves = self.client.search_read(
                "stock.move",
                [("state", "=", "done")],
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

            # Stock by category
            categories = self.client.search_read(
                "product.category", [],
                fields=["id", "name"],
            )
            stock_by_category = []
            for cat in categories[:10]:
                cat_products = self.client.search_read(
                    "product.product",
                    [("categ_id", "=", cat["id"]), ("type", "=", "product")],
                    fields=["qty_available", "standard_price"],
                )
                total_qty = sum(p.get("qty_available", 0) for p in cat_products)
                total_value = sum(p.get("qty_available", 0) * p.get("standard_price", 0) for p in cat_products)
                if total_qty > 0:
                    stock_by_category.append({
                        "category": cat["name"],
                        "quantity": round(total_qty, 2),
                        "value": round(total_value, 2),
                    })
            stats.stock_by_category = stock_by_category

            return stats

        except Exception as e:
            logger.error("Failed to get dashboard stats", error=str(e))
            return DashboardStats()


def get_dashboard_service() -> DashboardService:
    return DashboardService()
