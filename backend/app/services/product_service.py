"""Product service - business logic for product operations."""

from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, OdooOperationError, ValidationError
from app.core.logging import get_logger
from app.models.product import (
    ProductCreate,
    ProductResponse,
    ProductSearchRequest,
    ProductStockInfo,
    ProductUpdate,
)
from app.services.odoo_client import get_odoo_client
from app.utils.odoo_helpers import odoo_str, odoo_float, odoo_m2o_name

logger = get_logger(__name__)

PRODUCT_FIELDS = [
    "id", "name", "default_code", "barcode", "list_price", "standard_price",
    "qty_available", "virtual_available", "type", "categ_id", "uom_id",
    "active", "description", "weight", "volume", "currency_id", "hs_code",
]

STOCK_FIELDS = [
    "id", "name", "default_code", "qty_available", "virtual_available",
    "incoming_qty", "outgoing_qty", "uom_id",
]


def _first(*keys: str, d: Dict[str, Any], default: Any = None) -> Any:
    """Return the first present value for the given keys in d."""
    for k in keys:
        if k in d and d[k] is not None and d[k] is not False:
            return d[k]
    return default


def _is_storable_product(item: Dict[str, Any]) -> bool:
    """Only storable products (type=product). Exclude Down Payment and non-storable."""
    ptype = (item.get("type") or "").strip().lower() if isinstance(item.get("type"), str) else ""
    if ptype != "product":
        return False
    name = (item.get("name") or "").lower() if isinstance(item.get("name"), str) else ""
    if "down payment" in name or "downpayment" in name:
        return False
    return True


def _map_rest_product(item: Dict[str, Any]) -> ProductResponse:
    """Map a product record from the Odoo REST API to ProductResponse.

    Handles multiple possible field names (e.g. lst_price / list_price / 1st_price,
    name / product_name / Name) so different API response shapes still display.
    """
    if not isinstance(item, dict):
        return ProductResponse(id=0, name="", default_code=None, barcode=None, list_price=0.0, standard_price=0.0, qty_available=0.0, virtual_available=0.0, categ_id=None, categ_name=None, uom_id=None, uom_name=None, type=None, image_url=None, hs_code=None, weight=None, volume=None, active=True, description=None, currency_id=None)
    name = _first("name", "product_name", "Name", d=item) or ""
    if not name and isinstance(item.get("product_tmpl_id"), (list, tuple)) and len(item.get("product_tmpl_id", [])) > 1:
        name = str(item["product_tmpl_id"][1])
    if not name and item.get("barcode"):
        name = f"Product {item.get('barcode')}"
    list_price_val = _first("lst_price", "list_price", "1st_price", d=item)
    return ProductResponse(
        id=int(item.get("id", 0)) if item.get("id") is not None else 0,
        name=name,
        default_code=odoo_str(_first("default_code", "sku", "code", d=item)),
        barcode=odoo_str(item.get("barcode")),
        list_price=odoo_float(list_price_val),
        standard_price=odoo_float(item.get("standard_price")),
        qty_available=odoo_float(item.get("qty_available")),
        virtual_available=odoo_float(item.get("virtual_available")),
        categ_id=None,
        categ_name=odoo_str(_first("categ_name", "category", d=item)) or odoo_m2o_name(item.get("categ_id")),
        uom_id=None,
        uom_name=None,
        type=odoo_str(item.get("type")),
        image_url=None,
        hs_code=odoo_str(item.get("hs_code")),
        weight=None,
        volume=None,
        active=True,
        description=None,
        currency_id=None,
    )


class ProductService:
    """Service layer for product operations."""

    def __init__(self):
        self.client = get_odoo_client()
        self.model = "product.product"
        settings = get_settings()
        self.rest_api_url = settings.ODOO_REST_API_URL.rstrip("/") if settings.ODOO_REST_API_URL else ""

    # ------------------------------------------------------------------
    # Live REST API fetch (primary source for product listing)
    # ------------------------------------------------------------------

    def _get_products_from_rest_api(
        self,
        offset: int = 0,
        limit: int = 50,
    ) -> Optional[Tuple[List[ProductResponse], int]]:
        """Fetch products from the Odoo REST API running on EC2.

        Returns ``None`` if the REST API is not configured or unreachable
        so the caller can fall back to XML-RPC.
        """
        if not self.rest_api_url:
            return None

        try:
            url = f"{self.rest_api_url}/products"
            resp = httpx.get(url, timeout=10.0)
            resp.raise_for_status()
            payload = resp.json()

            # API may return {"data": [...], "count": N} or a top-level list
            if isinstance(payload, list):
                all_items = [p for p in payload if isinstance(p, dict)]
            else:
                all_items = list(payload.get("data", [])) if isinstance(payload, dict) else []
            # Only storable products (exclude Down Payment, service, consu)
            all_items = [p for p in all_items if _is_storable_product(p)]
            total = len(all_items)

            # Apply pagination on our side
            page = all_items[offset: offset + limit]
            products = [_map_rest_product(item) for item in page]

            logger.info(
                "products_fetched_from_rest_api",
                url=url,
                total=total,
                page_size=len(products),
            )
            return products, total

        except Exception as exc:
            logger.warning(
                "rest_api_fetch_failed_falling_back_to_xmlrpc",
                error=str(exc),
                url=self.rest_api_url,
            )
            return None

    # ------------------------------------------------------------------
    # Product listing – tries REST API first, falls back to XML-RPC
    # ------------------------------------------------------------------

    def get_products(
        self,
        offset: int = 0,
        limit: int = 50,
        order: str = "name asc",
        active_only: bool = True,
    ) -> Tuple[List[ProductResponse], int]:
        """Get paginated list of products.

        When PREFER_ODOO_FOR_PRODUCTS is True, fetches only from Odoo (exact Odoo data).
        Otherwise tries the Markwave REST API first, then falls back to Odoo XML-RPC.
        """
        if not get_settings().PREFER_ODOO_FOR_PRODUCTS:
            rest_result = self._get_products_from_rest_api(offset=offset, limit=limit)
            if rest_result is not None:
                return rest_result

        # Odoo XML-RPC: only storable products (type=product), Markwave company
        domain: List[Any] = [
            ("company_id", "=", get_settings().ODOO_MARKWAVE_COMPANY_ID),
            ("type", "=", "product"),
        ]
        if active_only:
            domain.append(("active", "=", True))

        total = self.client.search_count(self.model, domain)
        records = self.client.search_read(
            self.model, domain,
            fields=PRODUCT_FIELDS,
            offset=offset,
            limit=limit,
            order=order,
        )

        products = [ProductResponse.from_odoo(r) for r in records]
        return products, total

    def get_product(self, product_id: int) -> ProductResponse:
        """Get a single product by ID."""
        records = self.client.read(self.model, [product_id], fields=PRODUCT_FIELDS)

        if not records:
            raise NotFoundError("Product", product_id)

        return ProductResponse.from_odoo(records[0])

    def create_product(self, data: ProductCreate) -> ProductResponse:
        """Create a new product."""
        values: Dict[str, Any] = {
            "name": data.name,
            "type": data.type,
            "list_price": data.list_price,
            "standard_price": data.standard_price,
        }

        if data.default_code:
            values["default_code"] = data.default_code
        if data.barcode:
            values["barcode"] = data.barcode
        if data.categ_id:
            values["categ_id"] = data.categ_id
        if data.uom_id:
            values["uom_id"] = data.uom_id
        if data.description:
            values["description"] = data.description
        if data.weight is not None:
            values["weight"] = data.weight
        if data.volume is not None:
            values["volume"] = data.volume
        if data.hs_code:
            values["hs_code"] = data.hs_code

        product_id = self.client.create(self.model, values)
        return self.get_product(product_id)

    def update_product(self, product_id: int, data: ProductUpdate) -> ProductResponse:
        """Update an existing product."""
        # Verify product exists
        self.get_product(product_id)

        values = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}

        if not values:
            raise ValidationError("No fields to update")

        self.client.write(self.model, [product_id], values)
        return self.get_product(product_id)

    def delete_product(self, product_id: int) -> bool:
        """Archive (soft-delete) a product."""
        self.get_product(product_id)
        return self.client.write(self.model, [product_id], {"active": False})

    def search_products(self, search: ProductSearchRequest) -> Tuple[List[ProductResponse], int]:
        """Advanced product search with filters (Markwave only, storable products only)."""
        domain: List[Any] = [
            ("company_id", "=", get_settings().ODOO_MARKWAVE_COMPANY_ID),
            ("type", "=", "product"),
        ]

        if search.active_only:
            domain.append(("active", "=", True))

        if search.query:
            domain.append("|")
            domain.append("|")
            domain.append(("name", "ilike", search.query))
            domain.append(("default_code", "ilike", search.query))
            domain.append(("barcode", "ilike", search.query))

        if search.category_id:
            domain.append(("categ_id", "=", search.category_id))

        if search.min_stock is not None:
            domain.append(("qty_available", ">=", search.min_stock))

        if search.max_stock is not None:
            domain.append(("qty_available", "<=", search.max_stock))

        if search.min_price is not None:
            domain.append(("list_price", ">=", search.min_price))

        if search.max_price is not None:
            domain.append(("list_price", "<=", search.max_price))

        if search.has_barcode is not None:
            if search.has_barcode:
                domain.append(("barcode", "!=", False))
            else:
                domain.append(("barcode", "=", False))

        total = self.client.search_count(self.model, domain)
        records = self.client.search_read(
            self.model, domain,
            fields=PRODUCT_FIELDS,
            offset=search.offset,
            limit=search.limit,
            order=search.order,
        )

        products = [ProductResponse.from_odoo(r) for r in records]
        return products, total

    # ------------------------------------------------------------------
    # Stock levels – tries REST API first, falls back to XML-RPC
    # ------------------------------------------------------------------

    def _get_stock_from_rest_api(
        self,
        offset: int = 0,
        limit: int = 50,
    ) -> Optional[Tuple[List[ProductStockInfo], int]]:
        """Build stock info from the Odoo REST API product data."""
        if not self.rest_api_url:
            return None

        try:
            url = f"{self.rest_api_url}/products"
            resp = httpx.get(url, timeout=10.0)
            resp.raise_for_status()
            payload = resp.json()

            # API may return {"data": [...], "count": N} or a top-level list
            if isinstance(payload, list):
                all_items = [p for p in payload if isinstance(p, dict)]
            else:
                all_items = list(payload.get("data", [])) if isinstance(payload, dict) else []
            # Only storable products (exclude Down Payment, service, consu)
            all_items = [p for p in all_items if _is_storable_product(p)]
            total = len(all_items)

            page = all_items[offset: offset + limit]
            stock_info: List[ProductStockInfo] = []
            for item in page:
                dc = item.get("default_code")
                stock_info.append(
                    ProductStockInfo(
                        product_id=item.get("id", 0),
                        product_name=item.get("name") or "",
                        sku=dc if isinstance(dc, str) else None,
                        qty_available=odoo_float(item.get("qty_available")),
                        qty_forecasted=odoo_float(item.get("virtual_available")),
                        incoming_qty=odoo_float(item.get("incoming_qty")),
                        outgoing_qty=odoo_float(item.get("outgoing_qty")),
                        uom=None,
                    )
                )

            logger.info(
                "stock_fetched_from_rest_api",
                url=url,
                total=total,
                page_size=len(stock_info),
            )
            return stock_info, total

        except Exception as exc:
            logger.warning(
                "rest_api_stock_fetch_failed_falling_back_to_xmlrpc",
                error=str(exc),
            )
            return None

    def get_stock_levels(
        self,
        offset: int = 0,
        limit: int = 50,
    ) -> Tuple[List[ProductStockInfo], int]:
        """Get real-time stock levels for all products.

        Uses the Odoo REST API as the primary source.
        Falls back to XML-RPC if unavailable.
        """
        if not get_settings().PREFER_ODOO_FOR_PRODUCTS:
            rest_result = self._get_stock_from_rest_api(offset=offset, limit=limit)
            if rest_result is not None:
                return rest_result

        # Odoo XML-RPC (exact Odoo data; Markwave only)
        domain = [
            ("company_id", "=", get_settings().ODOO_MARKWAVE_COMPANY_ID),
            ("type", "=", "product"),
            ("active", "=", True),
        ]

        total = self.client.search_count(self.model, domain)
        records = self.client.search_read(
            self.model, domain,
            fields=STOCK_FIELDS,
            offset=offset,
            limit=limit,
            order="qty_available asc",
        )

        stock_info = []
        for r in records:
            uom = r.get("uom_id")
            # Odoo returns False for empty fields instead of None
            sku = r.get("default_code")
            stock_info.append(
                ProductStockInfo(
                    product_id=r["id"],
                    product_name=r["name"],
                    sku=sku if isinstance(sku, str) else None,
                    qty_available=r.get("qty_available", 0) or 0,
                    qty_forecasted=r.get("virtual_available", 0) or 0,
                    incoming_qty=r.get("incoming_qty", 0) or 0,
                    outgoing_qty=r.get("outgoing_qty", 0) or 0,
                    uom=uom[1] if isinstance(uom, (list, tuple)) and len(uom) > 1 else None,
                )
            )

        return stock_info, total

    def get_categories(self) -> List[Dict[str, Any]]:
        """Get all product categories."""
        return self.client.search_read(
            "product.category",
            [],
            fields=["id", "name", "complete_name", "parent_id"],
            order="name asc",
        )


def get_product_service() -> ProductService:
    return ProductService()
