"""Invoice API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.core.roles import require_controller_role
from app.models.invoice import InvoiceCreate, InvoiceListResponse, InvoiceResponse
from app.models.common import APIResponse
from app.services.invoice_service import get_invoice_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    move_type: Optional[str] = Query(None, description="Filter: out_invoice, in_invoice"),
    state: Optional[str] = Query(None, description="Filter: draft, posted, cancel"),
    partner_id: Optional[int] = Query(None, description="Filter by partner"),
    date_from: Optional[str] = Query(None, description="From date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="To date (YYYY-MM-DD)"),
):
    """List invoices with filters."""
    service = get_invoice_service()
    invoices, total = service.get_invoices(
        offset=offset,
        limit=limit,
        move_type=move_type,
        state=state,
        partner_id=partner_id,
        date_from=date_from,
        date_to=date_to,
    )
    return InvoiceListResponse(
        data=invoices,
        total=total,
        offset=offset,
        limit=limit,
        has_more=(offset + limit) < total,
    )


@router.get("/partners")
def list_partners(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Search by name or email"),
):
    """Get partners/customers for invoice creation."""
    service = get_invoice_service()
    partners, total = service.get_partners(offset=offset, limit=limit, search=search)
    return {
        "success": True,
        "data": partners,
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/{invoice_id}", response_model=APIResponse)
def get_invoice(invoice_id: int):
    """Get a single invoice by ID."""
    service = get_invoice_service()
    invoice = service.get_invoice(invoice_id)
    return APIResponse(data=invoice)


@router.post("", response_model=APIResponse)
def create_invoice(data: InvoiceCreate):
    """Create a new invoice."""
    service = get_invoice_service()
    invoice = service.create_invoice(data)
    return APIResponse(data=invoice, message="Invoice created successfully")


@router.post("/{invoice_id}/confirm", response_model=APIResponse)
def confirm_invoice(invoice_id: int):
    """Confirm/post an invoice (controller or admin role required)."""
    require_controller_role()
    service = get_invoice_service()
    invoice = service.confirm_invoice(invoice_id)
    return APIResponse(data=invoice, message="Invoice confirmed successfully")


@router.post("/{invoice_id}/cancel", response_model=APIResponse)
def cancel_invoice(invoice_id: int):
    """Cancel an invoice (controller or admin role required)."""
    require_controller_role()
    service = get_invoice_service()
    invoice = service.cancel_invoice(invoice_id)
    return APIResponse(data=invoice, message="Invoice cancelled successfully")


@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int):
    """Download invoice as PDF."""
    service = get_invoice_service()

    # Verify invoice exists
    invoice = service.get_invoice(invoice_id)

    pdf_data = service.get_invoice_pdf(invoice_id)
    if pdf_data:
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="invoice_{invoice.name}.pdf"',
            },
        )

    return APIResponse(
        success=False,
        message="PDF generation is not available. Please download the invoice from Odoo directly.",
    )
