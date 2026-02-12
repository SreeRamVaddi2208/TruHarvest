"""Sync and health check API endpoints."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.models.common import APIResponse, DashboardStats, HealthResponse, SyncStatusResponse
from app.services.odoo_client import get_odoo_client
from app.services.dashboard_service import get_dashboard_service

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint."""
    settings = get_settings()
    client = get_odoo_client()
    conn_info = client.check_connection()

    return HealthResponse(
        status="healthy" if conn_info["connected"] else "degraded",
        version=settings.APP_VERSION,
        odoo_connected=conn_info["connected"],
        odoo_version=conn_info.get("server_version"),
    )


@router.get("/sync/status", response_model=SyncStatusResponse)
def sync_status():
    """Check data synchronization status."""
    client = get_odoo_client()
    conn_info = client.check_connection()

    if not conn_info["connected"]:
        return SyncStatusResponse(
            success=False,
            errors=["Odoo connection is not available"],
        )

    # Get counts from Odoo
    try:
        products = client.search_count("product.product", [("active", "=", True)])
        moves = client.search_count("stock.move", [("state", "=", "done")])
        invoices = client.search_count("account.move", [("move_type", "in", ["out_invoice", "in_invoice"])])

        return SyncStatusResponse(
            success=True,
            products_synced=products,
            stock_synced=moves,
            invoices_synced=invoices,
        )
    except Exception as e:
        return SyncStatusResponse(
            success=False,
            errors=[str(e)],
        )


@router.post("/sync/trigger", response_model=APIResponse)
def trigger_sync():
    """Manually trigger a data sync (re-authenticate and verify connection)."""
    client = get_odoo_client()
    client.reset()

    conn_info = client.check_connection()
    if conn_info["connected"]:
        return APIResponse(
            success=True,
            message="Sync completed successfully. Connection to Odoo re-established.",
            data=conn_info,
        )
    else:
        return APIResponse(
            success=False,
            message="Sync failed. Could not connect to Odoo.",
            errors=[conn_info.get("error", "Unknown error")],
        )


@router.get("/dashboard", response_model=APIResponse)
def get_dashboard():
    """Get dashboard statistics and analytics."""
    service = get_dashboard_service()
    stats = service.get_stats()
    return APIResponse(data=stats)
