"""Invoice service - business logic for invoice operations."""

import base64
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, OdooOperationError, ValidationError
from app.core.logging import get_logger
from app.models.invoice import (
    InvoiceCreate,
    InvoiceLineResponse,
    InvoiceResponse,
)
from app.services.odoo_client import get_odoo_client
from app.utils.pdf_generator import generate_invoice_pdf

logger = get_logger(__name__)

INVOICE_FIELDS = [
    "id", "name", "partner_id", "move_type", "state", "payment_state",
    "invoice_date", "invoice_date_due", "amount_untaxed", "amount_tax",
    "amount_total", "amount_residual", "currency_id", "ref", "narration",
    "invoice_line_ids",
]

INVOICE_LINE_FIELDS = [
    "id", "product_id", "quantity", "price_unit", "discount",
    "price_subtotal", "price_total", "tax_ids", "name",
]


class InvoiceService:
    """Service layer for invoice operations."""

    def __init__(self):
        self.client = get_odoo_client()
        self.model = "account.move"
        self.line_model = "account.move.line"

    def get_invoices(
        self,
        offset: int = 0,
        limit: int = 50,
        move_type: Optional[str] = None,
        state: Optional[str] = None,
        partner_id: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Tuple[List[InvoiceResponse], int]:
        """Get paginated list of invoices."""
        domain: List[Any] = [("move_type", "in", ["out_invoice", "in_invoice", "out_refund", "in_refund"])]

        if move_type:
            domain = [("move_type", "=", move_type)]
        if state:
            domain.append(("state", "=", state))
        if partner_id:
            domain.append(("partner_id", "=", partner_id))
        if date_from:
            domain.append(("invoice_date", ">=", date_from))
        if date_to:
            domain.append(("invoice_date", "<=", date_to))

        total = self.client.search_count(self.model, domain)
        records = self.client.search_read(
            self.model, domain,
            fields=INVOICE_FIELDS,
            offset=offset,
            limit=limit,
            order="invoice_date desc, id desc",
        )

        invoices = []
        for r in records:
            line_ids = r.get("invoice_line_ids", [])
            lines = []
            if line_ids:
                lines = self.client.read(self.line_model, line_ids, fields=INVOICE_LINE_FIELDS)
            invoices.append(InvoiceResponse.from_odoo(r, lines))

        return invoices, total

    def get_invoice(self, invoice_id: int) -> InvoiceResponse:
        """Get a single invoice by ID."""
        records = self.client.read(self.model, [invoice_id], fields=INVOICE_FIELDS)
        if not records:
            raise NotFoundError("Invoice", invoice_id)

        record = records[0]
        line_ids = record.get("invoice_line_ids", [])
        lines = []
        if line_ids:
            lines = self.client.read(self.line_model, line_ids, fields=INVOICE_LINE_FIELDS)

        return InvoiceResponse.from_odoo(record, lines)

    def create_invoice(self, data: InvoiceCreate) -> InvoiceResponse:
        """Create a new invoice in Odoo."""
        invoice_lines = []
        for line in data.lines:
            line_vals: Dict[str, Any] = {
                "product_id": line.product_id,
                "quantity": line.quantity,
            }
            if line.price_unit is not None:
                line_vals["price_unit"] = line.price_unit
            if line.discount:
                line_vals["discount"] = line.discount
            if line.tax_ids:
                line_vals["tax_ids"] = [(6, 0, line.tax_ids)]
            if line.name:
                line_vals["name"] = line.name

            invoice_lines.append((0, 0, line_vals))

        invoice_vals: Dict[str, Any] = {
            "partner_id": data.partner_id,
            "move_type": data.move_type,
            "invoice_line_ids": invoice_lines,
        }

        if data.invoice_date:
            invoice_vals["invoice_date"] = data.invoice_date
        if data.payment_term_id:
            invoice_vals["payment_term_id"] = data.payment_term_id
        if data.journal_id:
            invoice_vals["journal_id"] = data.journal_id
        if data.currency_id:
            invoice_vals["currency_id"] = data.currency_id
        if data.narration:
            invoice_vals["narration"] = data.narration
        if data.ref:
            invoice_vals["ref"] = data.ref

        try:
            invoice_id = self.client.create(self.model, invoice_vals)
            logger.info("Invoice created", invoice_id=invoice_id)
            return self.get_invoice(invoice_id)
        except Exception as e:
            logger.error("Invoice creation failed", error=str(e))
            raise OdooOperationError(
                message=f"Failed to create invoice: {str(e)}",
                details={"partner_id": data.partner_id},
            )

    def confirm_invoice(self, invoice_id: int) -> InvoiceResponse:
        """Confirm/post an invoice."""
        invoice = self.get_invoice(invoice_id)
        if invoice.state != "draft":
            raise ValidationError(f"Invoice is not in draft state (current: {invoice.state})")

        try:
            self.client.execute_kw(self.model, "action_post", [[invoice_id]])
            return self.get_invoice(invoice_id)
        except Exception as e:
            logger.error("Invoice confirmation failed", invoice_id=invoice_id, error=str(e))
            raise OdooOperationError(
                message=f"Failed to confirm invoice: {str(e)}",
                details={"invoice_id": invoice_id},
            )

    def cancel_invoice(self, invoice_id: int) -> InvoiceResponse:
        """Cancel an invoice."""
        try:
            self.client.execute_kw(self.model, "button_cancel", [[invoice_id]])
            return self.get_invoice(invoice_id)
        except Exception as e:
            logger.error("Invoice cancellation failed", invoice_id=invoice_id, error=str(e))
            raise OdooOperationError(
                message=f"Failed to cancel invoice: {str(e)}",
                details={"invoice_id": invoice_id},
            )

    # ------------------------------------------------------------------
    # PDF generation – tries multiple strategies
    # ------------------------------------------------------------------

    def get_invoice_pdf(self, invoice_id: int) -> Optional[bytes]:
        """Get invoice PDF, trying several strategies in order:

        1. Odoo XML-RPC ``_render_qweb_pdf`` (native Odoo report)
        2. Odoo HTTP report download (``/report/pdf/…``)
        3. Local PDF generation via *reportlab* (always works)
        """
        # Strategy 1: Odoo XML-RPC _render_qweb_pdf
        pdf = self._pdf_via_xmlrpc(invoice_id)
        if pdf:
            return pdf

        # Strategy 2: Odoo HTTP report endpoint
        pdf = self._pdf_via_odoo_http(invoice_id)
        if pdf:
            return pdf

        # Strategy 3: Generate locally with reportlab (guaranteed)
        logger.info(
            "generating_pdf_locally",
            invoice_id=invoice_id,
            reason="odoo_methods_unavailable",
        )
        invoice = self.get_invoice(invoice_id)
        return generate_invoice_pdf(invoice)

    def _pdf_via_xmlrpc(self, invoice_id: int) -> Optional[bytes]:
        """Try Odoo's XML-RPC report engine."""
        report_names = [
            "account.report_invoice",
            "account.report_invoice_with_payments",
        ]
        for report_name in report_names:
            try:
                result = self.client.execute_kw(
                    "ir.actions.report",
                    "_render_qweb_pdf",
                    [report_name, [invoice_id]],
                )
                if result and isinstance(result, (list, tuple)) and len(result) > 0:
                    data = result[0]
                    # Odoo may return base64-encoded bytes
                    if isinstance(data, str):
                        data = base64.b64decode(data)
                    if isinstance(data, bytes) and data[:5] == b"%PDF-":
                        logger.info("pdf_from_xmlrpc", invoice_id=invoice_id, report=report_name)
                        return data
            except Exception as exc:
                logger.warning(
                    "xmlrpc_pdf_failed",
                    invoice_id=invoice_id,
                    report=report_name,
                    error=str(exc),
                )
        return None

    def _pdf_via_odoo_http(self, invoice_id: int) -> Optional[bytes]:
        """Download the PDF from Odoo's web /report/pdf/ endpoint."""
        settings = get_settings()
        odoo_url = settings.ODOO_URL.rstrip("/")

        try:
            # Step 1: Authenticate via Odoo's web login to get a session cookie
            with httpx.Client(timeout=15.0, follow_redirects=True) as http:
                login_resp = http.post(
                    f"{odoo_url}/web/session/authenticate",
                    json={
                        "jsonrpc": "2.0",
                        "params": {
                            "db": settings.ODOO_DB,
                            "login": settings.ODOO_USERNAME,
                            "password": settings.ODOO_PASSWORD,
                        },
                    },
                )
                login_resp.raise_for_status()
                login_data = login_resp.json()
                if login_data.get("error") or not login_data.get("result", {}).get("uid"):
                    logger.warning("odoo_http_login_failed", data=login_data)
                    return None

                # Step 2: Download the report PDF
                report_url = (
                    f"{odoo_url}/report/pdf/"
                    f"account.report_invoice/{invoice_id}"
                )
                pdf_resp = http.get(report_url)
                pdf_resp.raise_for_status()

                if (
                    pdf_resp.headers.get("content-type", "").startswith("application/pdf")
                    or pdf_resp.content[:5] == b"%PDF-"
                ):
                    logger.info("pdf_from_odoo_http", invoice_id=invoice_id)
                    return pdf_resp.content

        except Exception as exc:
            logger.warning(
                "odoo_http_pdf_failed",
                invoice_id=invoice_id,
                error=str(exc),
            )

        return None

    def get_partners(
        self,
        offset: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        is_customer: bool = True,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get partners/customers."""
        domain: List[Any] = []
        if search:
            domain.append("|")
            domain.append(("name", "ilike", search))
            domain.append(("email", "ilike", search))

        total = self.client.search_count("res.partner", domain)
        records = self.client.search_read(
            "res.partner", domain,
            fields=["id", "name", "email", "phone", "street", "city", "country_id", "vat", "is_company"],
            offset=offset,
            limit=limit,
            order="name asc",
        )
        return records, total


def get_invoice_service() -> InvoiceService:
    return InvoiceService()
