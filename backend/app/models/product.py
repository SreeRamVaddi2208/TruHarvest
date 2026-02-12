"""Product-related Pydantic models."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.utils.odoo_helpers import (
    clean_odoo_record, odoo_str, odoo_float, odoo_m2o_id, odoo_m2o_name,
)


class ProductBase(BaseModel):
    """Base product fields."""
    name: str = Field(..., description="Product name")
    default_code: Optional[str] = Field(None, description="Internal reference / SKU")
    barcode: Optional[str] = Field(None, description="Product barcode")
    list_price: float = Field(0.0, description="Sales price")
    standard_price: float = Field(0.0, description="Cost price")


class ProductCreate(ProductBase):
    """Fields for creating a product."""
    type: str = Field("product", description="Product type: product, consu, service")
    categ_id: Optional[int] = Field(None, description="Product category ID")
    uom_id: Optional[int] = Field(None, description="Unit of measure ID")
    hs_code: Optional[str] = Field(None, description="HS Code for customs")
    description: Optional[str] = Field(None, description="Product description")
    weight: Optional[float] = Field(None, description="Product weight in kg")
    volume: Optional[float] = Field(None, description="Product volume in m³")


class ProductUpdate(BaseModel):
    """Fields for updating a product."""
    name: Optional[str] = None
    default_code: Optional[str] = None
    barcode: Optional[str] = None
    list_price: Optional[float] = None
    standard_price: Optional[float] = None
    categ_id: Optional[int] = None
    description: Optional[str] = None
    weight: Optional[float] = None
    volume: Optional[float] = None
    hs_code: Optional[str] = None


class ProductResponse(BaseModel):
    """Full product response."""
    id: int
    name: str
    default_code: Optional[str] = None
    barcode: Optional[str] = None
    list_price: float = 0.0
    standard_price: float = 0.0
    qty_available: float = 0.0
    virtual_available: float = 0.0
    categ_id: Optional[int] = None
    categ_name: Optional[str] = None
    uom_id: Optional[int] = None
    uom_name: Optional[str] = None
    type: Optional[str] = None
    image_url: Optional[str] = None
    hs_code: Optional[str] = None
    weight: Optional[float] = None
    volume: Optional[float] = None
    active: bool = True
    description: Optional[str] = None
    currency_id: Optional[int] = None

    @classmethod
    def from_odoo(cls, data: Dict[str, Any]) -> "ProductResponse":
        """Create a ProductResponse from raw Odoo data."""
        d = clean_odoo_record(data)
        w = d.get("weight")
        v = d.get("volume")
        return cls(
            id=d.get("id", 0),
            name=d.get("name") or "",
            default_code=odoo_str(d.get("default_code")),
            barcode=odoo_str(d.get("barcode")),
            list_price=odoo_float(d.get("list_price")),
            standard_price=odoo_float(d.get("standard_price")),
            qty_available=odoo_float(d.get("qty_available")),
            virtual_available=odoo_float(d.get("virtual_available")),
            categ_id=odoo_m2o_id(data.get("categ_id")),
            categ_name=odoo_m2o_name(data.get("categ_id")),
            uom_id=odoo_m2o_id(data.get("uom_id")),
            uom_name=odoo_m2o_name(data.get("uom_id")),
            type=odoo_str(d.get("type")),
            image_url=None,
            hs_code=odoo_str(d.get("hs_code")),
            weight=float(w) if w is not None else None,
            volume=float(v) if v is not None else None,
            active=bool(d.get("active", True)),
            description=odoo_str(d.get("description")),
            currency_id=odoo_m2o_id(data.get("currency_id")),
        )


class ProductStockInfo(BaseModel):
    """Product stock summary."""
    product_id: int
    product_name: str
    sku: Optional[str] = None
    qty_available: float = 0.0
    qty_forecasted: float = 0.0
    qty_reserved: float = 0.0
    incoming_qty: float = 0.0
    outgoing_qty: float = 0.0
    uom: Optional[str] = None


class ProductSearchRequest(BaseModel):
    """Advanced search/filter request."""
    query: Optional[str] = Field(None, description="Free text search")
    category_id: Optional[int] = Field(None, description="Category filter")
    min_stock: Optional[float] = Field(None, description="Minimum stock level")
    max_stock: Optional[float] = Field(None, description="Maximum stock level")
    min_price: Optional[float] = Field(None, description="Minimum price")
    max_price: Optional[float] = Field(None, description="Maximum price")
    active_only: bool = Field(True, description="Only active products")
    has_barcode: Optional[bool] = Field(None, description="Filter by barcode presence")
    offset: int = Field(0, ge=0, description="Pagination offset")
    limit: int = Field(50, ge=1, le=200, description="Pagination limit")
    order: str = Field("name asc", description="Sort order")


class ProductListResponse(BaseModel):
    """Paginated product list response."""
    success: bool = True
    data: List[ProductResponse]
    total: int
    offset: int
    limit: int
    has_more: bool
