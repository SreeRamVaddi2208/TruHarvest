"""API v1 router - aggregates all endpoint routers."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.products import router as products_router
from app.api.v1.stock import router as stock_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.sync import router as sync_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(products_router)
api_router.include_router(stock_router)
api_router.include_router(invoices_router)
api_router.include_router(sync_router)
