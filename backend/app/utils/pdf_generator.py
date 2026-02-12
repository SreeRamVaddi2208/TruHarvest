"""Generate professional invoice PDFs using reportlab."""

import io
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

from app.models.invoice import InvoiceResponse


# ---------------------------------------------------------------------------
# Colour palette
# ---------------------------------------------------------------------------

BRAND_COLOR = colors.HexColor("#1a7f64")   # TruHarvest green
HEADER_BG = colors.HexColor("#f0fdf4")
ROW_ALT_BG = colors.HexColor("#f8fafc")
BORDER_COLOR = colors.HexColor("#e2e8f0")
TEXT_DARK = colors.HexColor("#1e293b")
TEXT_MUTED = colors.HexColor("#64748b")


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

def _styles():
    ss = getSampleStyleSheet()

    ss.add(ParagraphStyle(
        "InvTitle",
        parent=ss["Title"],
        fontSize=22,
        textColor=BRAND_COLOR,
        spaceAfter=2 * mm,
    ))
    ss.add(ParagraphStyle(
        "InvSubtitle",
        parent=ss["Normal"],
        fontSize=10,
        textColor=TEXT_MUTED,
    ))
    ss.add(ParagraphStyle(
        "SectionHeading",
        parent=ss["Heading2"],
        fontSize=12,
        textColor=BRAND_COLOR,
        spaceBefore=6 * mm,
        spaceAfter=3 * mm,
    ))
    ss.add(ParagraphStyle(
        "CellText",
        parent=ss["Normal"],
        fontSize=9,
        textColor=TEXT_DARK,
    ))
    ss.add(ParagraphStyle(
        "CellRight",
        parent=ss["Normal"],
        fontSize=9,
        alignment=TA_RIGHT,
        textColor=TEXT_DARK,
    ))
    ss.add(ParagraphStyle(
        "CellBold",
        parent=ss["Normal"],
        fontSize=9,
        textColor=TEXT_DARK,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "CellBoldRight",
        parent=ss["Normal"],
        fontSize=9,
        alignment=TA_RIGHT,
        textColor=TEXT_DARK,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "FooterText",
        parent=ss["Normal"],
        fontSize=8,
        textColor=TEXT_MUTED,
        alignment=TA_CENTER,
    ))
    return ss


# ---------------------------------------------------------------------------
# Currency formatter
# ---------------------------------------------------------------------------

def _fmt_inr(amount: float) -> str:
    """Format amount as INR with Indian grouping (e.g. 1,23,456.00)."""
    sign = "-" if amount < 0 else ""
    amount = abs(amount)
    integer_part = int(amount)
    decimal_part = f"{amount - integer_part:.2f}"[1:]  # e.g. ".50"

    s = str(integer_part)
    if len(s) <= 3:
        formatted = s
    else:
        # last 3 digits
        last3 = s[-3:]
        rest = s[:-3]
        # group rest in pairs from right
        groups = []
        while rest:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        formatted = ",".join(groups) + "," + last3

    return f"{sign}\u20b9{formatted}{decimal_part}"


# ---------------------------------------------------------------------------
# Build the PDF
# ---------------------------------------------------------------------------

def generate_invoice_pdf(invoice: InvoiceResponse) -> bytes:
    """Return raw PDF bytes for the given invoice."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
    )

    styles = _styles()
    elements: list = []

    # ── Header ──────────────────────────────────────────────────────────
    elements.append(Paragraph("TruHarvest", styles["InvTitle"]))
    elements.append(Paragraph("Inventory Management System", styles["InvSubtitle"]))
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=1, color=BRAND_COLOR,
        spaceAfter=4 * mm, spaceBefore=0,
    ))

    # ── Invoice meta ────────────────────────────────────────────────────
    inv_type_label = {
        "out_invoice": "Customer Invoice",
        "in_invoice": "Vendor Bill",
        "out_refund": "Credit Note",
        "in_refund": "Debit Note",
    }.get(invoice.move_type or "", "Invoice")

    state_label = {
        "draft": "Draft",
        "posted": "Posted",
        "cancel": "Cancelled",
    }.get(invoice.state or "", invoice.state or "")

    payment_label = {
        "paid": "Paid",
        "partial": "Partially Paid",
        "not_paid": "Not Paid",
        "reversed": "Reversed",
    }.get(invoice.payment_state or "", invoice.payment_state or "")

    meta_data = [
        [
            Paragraph(f"<b>{inv_type_label}</b>", styles["CellBold"]),
            Paragraph(f"<b>{invoice.name or f'INV-{invoice.id}'}</b>", styles["CellBoldRight"]),
        ],
        [
            Paragraph(f"Customer: {invoice.partner_name or '—'}", styles["CellText"]),
            Paragraph(f"Date: {invoice.invoice_date or '—'}", styles["CellRight"]),
        ],
        [
            Paragraph(f"Status: {state_label}  |  Payment: {payment_label}", styles["CellText"]),
            Paragraph(f"Due: {invoice.invoice_date_due or '—'}", styles["CellRight"]),
        ],
    ]
    if invoice.ref:
        meta_data.append([
            Paragraph(f"Reference: {invoice.ref}", styles["CellText"]),
            Paragraph("", styles["CellText"]),
        ])

    col_width = (doc.width) / 2
    meta_table = Table(meta_data, colWidths=[col_width, col_width])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER_COLOR),
    ]))
    elements.append(meta_table)

    # ── Line items ──────────────────────────────────────────────────────
    elements.append(Paragraph("Line Items", styles["SectionHeading"]))

    header_row = [
        Paragraph("<b>#</b>", styles["CellBold"]),
        Paragraph("<b>Product</b>", styles["CellBold"]),
        Paragraph("<b>Description</b>", styles["CellBold"]),
        Paragraph("<b>Qty</b>", styles["CellBoldRight"]),
        Paragraph("<b>Unit Price</b>", styles["CellBoldRight"]),
        Paragraph("<b>Disc %</b>", styles["CellBoldRight"]),
        Paragraph("<b>Subtotal</b>", styles["CellBoldRight"]),
    ]

    table_data = [header_row]
    lines = invoice.invoice_lines or []
    for idx, line in enumerate(lines, 1):
        table_data.append([
            Paragraph(str(idx), styles["CellText"]),
            Paragraph(line.product_name or "—", styles["CellText"]),
            Paragraph(line.name or "—", styles["CellText"]),
            Paragraph(f"{line.quantity:g}", styles["CellRight"]),
            Paragraph(_fmt_inr(line.price_unit), styles["CellRight"]),
            Paragraph(f"{line.discount:g}%" if line.discount else "—", styles["CellRight"]),
            Paragraph(_fmt_inr(line.price_subtotal), styles["CellRight"]),
        ])

    if not lines:
        table_data.append([
            Paragraph("—", styles["CellText"]),
            Paragraph("No line items", styles["CellText"]),
            "", "", "", "", "",
        ])

    line_col_widths = [
        8 * mm,                 # #
        doc.width * 0.20,       # Product
        doc.width * 0.25,       # Description
        doc.width * 0.10,       # Qty
        doc.width * 0.15,       # Unit Price
        doc.width * 0.10,       # Disc
        doc.width * 0.15,       # Subtotal
    ]
    # Adjust last column so total = doc.width
    used = sum(line_col_widths[:-1])
    line_col_widths[-1] = doc.width - used

    line_table = Table(table_data, colWidths=line_col_widths, repeatRows=1)
    line_style = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        # Grid
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, BORDER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
    ]
    # Alternating row colours
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            line_style.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT_BG))

    line_table.setStyle(TableStyle(line_style))
    elements.append(line_table)

    # ── Totals ──────────────────────────────────────────────────────────
    elements.append(Spacer(1, 4 * mm))

    totals_data = [
        [
            Paragraph("Subtotal", styles["CellText"]),
            Paragraph(_fmt_inr(invoice.amount_untaxed), styles["CellRight"]),
        ],
        [
            Paragraph("Tax", styles["CellText"]),
            Paragraph(_fmt_inr(invoice.amount_tax), styles["CellRight"]),
        ],
        [
            Paragraph("<b>Total</b>", styles["CellBold"]),
            Paragraph(f"<b>{_fmt_inr(invoice.amount_total)}</b>", styles["CellBoldRight"]),
        ],
    ]

    if invoice.amount_residual > 0 and invoice.amount_residual < invoice.amount_total:
        totals_data.append([
            Paragraph("<b>Amount Due</b>", styles["CellBold"]),
            Paragraph(
                f"<b><font color='#dc2626'>{_fmt_inr(invoice.amount_residual)}</font></b>",
                styles["CellBoldRight"],
            ),
        ])

    totals_width = 60 * mm
    totals_table = Table(
        totals_data,
        colWidths=[totals_width * 0.55, totals_width * 0.45],
        hAlign="RIGHT",
    )
    totals_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("LINEABOVE", (0, -1), (-1, -1), 1, BRAND_COLOR),
        ("BACKGROUND", (0, -1), (-1, -1), HEADER_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    elements.append(totals_table)

    # ── Notes ───────────────────────────────────────────────────────────
    if invoice.narration:
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph("Notes", styles["SectionHeading"]))
        elements.append(Paragraph(invoice.narration, styles["CellText"]))

    # ── Footer ──────────────────────────────────────────────────────────
    elements.append(Spacer(1, 12 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=BORDER_COLOR,
        spaceAfter=3 * mm, spaceBefore=0,
    ))
    elements.append(Paragraph(
        "Generated by TruHarvest Inventory Management System",
        styles["FooterText"],
    ))

    # ── Build ───────────────────────────────────────────────────────────
    doc.build(elements)
    return buf.getvalue()
