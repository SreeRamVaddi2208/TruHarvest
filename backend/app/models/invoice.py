"""Invoice-related Pydantic models."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.utils.odoo_helpers import (
    clean_odoo_record, odoo_str, odoo_float, odoo_m2o_id, odoo_m2o_name,
)


class InvoiceLineCreate(BaseModel):
    """Invoice line item."""
    product_id: int = Field(..., description="Product ID")
    quantity: float = Field(..., gt=0, description="Quantity")
    price_unit: Optional[float] = Field(None, description="Unit price (uses product price if not set)")
    discount: float = Field(0.0, ge=0, le=100, description="Discount percentage")
    tax_ids: Optional[List[int]] = Field(None, description="Tax IDs to apply")
    name: Optional[str] = Field(None, description="Description override")


class InvoiceCreate(BaseModel):
    """Create a new invoice."""
    partner_id: int = Field(..., description="Customer/Partner ID")
    invoice_date: Optional[str] = Field(None, description="Invoice date (ISO format)")
    payment_term_id: Optional[int] = Field(None, description="Payment term ID")
    journal_id: Optional[int] = Field(None, description="Journal ID")
    currency_id: Optional[int] = Field(None, description="Currency ID")
    move_type: str = Field("out_invoice", description="Type: out_invoice, in_invoice, out_refund, in_refund")
    narration: Optional[str] = Field(None, description="Internal notes")
    ref: Optional[str] = Field(None, description="External reference")
    lines: List[InvoiceLineCreate] = Field(..., min_length=1, description="Invoice line items")


class InvoiceLineResponse(BaseModel):
    """Invoice line response."""
    id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: float = 0.0
    price_unit: float = 0.0
    discount: float = 0.0
    price_subtotal: float = 0.0
    price_total: float = 0.0
    tax_ids: Optional[List[Any]] = None
    name: Optional[str] = None

    @classmethod
    def from_odoo(cls, data: Dict[str, Any]) -> "InvoiceLineResponse":
        d = clean_odoo_record(data)
        return cls(
            id=d.get("id", 0),
            product_id=odoo_m2o_id(data.get("product_id")),
            product_name=odoo_m2o_name(data.get("product_id")),
            quantity=odoo_float(d.get("quantity")),
            price_unit=odoo_float(d.get("price_unit")),
            discount=odoo_float(d.get("discount")),
            price_subtotal=odoo_float(d.get("price_subtotal")),
            price_total=odoo_float(d.get("price_total")),
            tax_ids=d.get("tax_ids") if isinstance(d.get("tax_ids"), list) else None,
            name=odoo_str(d.get("name")),
        )


class InvoiceResponse(BaseModel):
    """Full invoice response."""
    id: int
    name: str
    partner_id: Optional[int] = None
    partner_name: Optional[str] = None
    move_type: Optional[str] = None
    state: Optional[str] = None
    payment_state: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_date_due: Optional[str] = None
    amount_untaxed: float = 0.0
    amount_tax: float = 0.0
    amount_total: float = 0.0
    amount_residual: float = 0.0
    currency_id: Optional[int] = None
    currency_name: Optional[str] = None
    ref: Optional[str] = None
    narration: Optional[str] = None
    invoice_lines: List[InvoiceLineResponse] = []

    @classmethod
    def from_odoo(cls, data: Dict[str, Any], lines: Optional[List[Dict[str, Any]]] = None) -> "InvoiceResponse":
        d = clean_odoo_record(data)
        raw_date = d.get("invoice_date")
        raw_due = d.get("invoice_date_due")
        return cls(
            id=d.get("id", 0),
            name=d.get("name") or "",
            partner_id=odoo_m2o_id(data.get("partner_id")),
            partner_name=odoo_m2o_name(data.get("partner_id")),
            move_type=odoo_str(d.get("move_type")),
            state=odoo_str(d.get("state")),
            payment_state=odoo_str(d.get("payment_state")),
            invoice_date=str(raw_date) if raw_date else None,
            invoice_date_due=str(raw_due) if raw_due else None,
            amount_untaxed=odoo_float(d.get("amount_untaxed")),
            amount_tax=odoo_float(d.get("amount_tax")),
            amount_total=odoo_float(d.get("amount_total")),
            amount_residual=odoo_float(d.get("amount_residual")),
            currency_id=odoo_m2o_id(data.get("currency_id")),
            currency_name=odoo_m2o_name(data.get("currency_id")),
            ref=odoo_str(d.get("ref")),
            narration=odoo_str(d.get("narration")),
            invoice_lines=[InvoiceLineResponse.from_odoo(l) for l in (lines or [])],
        )


class InvoiceListResponse(BaseModel):
    """Paginated invoice list."""
    success: bool = True
    data: List[InvoiceResponse]
    total: int
    offset: int
    limit: int
    has_more: bool
