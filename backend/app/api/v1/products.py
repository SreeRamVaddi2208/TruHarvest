"""Product API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query

from app.models.product import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductSearchRequest,
    ProductUpdate,
)
from app.models.common import APIResponse
from app.services.product_service import get_product_service

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=ProductListResponse)
def list_products(
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=200, description="Pagination limit"),
    order: str = Query("name asc", description="Sort order"),
    active_only: bool = Query(True, description="Only active products"),
):
    """List all products with pagination.

    Fetches live data from the Odoo REST API.
    Automatically falls back to XML-RPC if the REST API is unreachable.
    Any changes made in Odoo are reflected here in real time.
    """
    service = get_product_service()
    products, total = service.get_products(offset=offset, limit=limit, order=order, active_only=active_only)
    return ProductListResponse(
        data=products,
        total=total,
        offset=offset,
        limit=limit,
        has_more=(offset + limit) < total,
    )


@router.get("/stock")
def get_stock_levels(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Get real-time stock levels for all products."""
    service = get_product_service()
    stock_info, total = service.get_stock_levels(offset=offset, limit=limit)
    return {
        "success": True,
        "data": stock_info,
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": (offset + limit) < total,
    }


@router.get("/categories")
def get_categories():
    """Get all product categories."""
    service = get_product_service()
    categories = service.get_categories()
    return {"success": True, "data": categories}


@router.post("/search", response_model=ProductListResponse)
def search_products(search: ProductSearchRequest):
    """Advanced product search with filters."""
    service = get_product_service()
    products, total = service.search_products(search)
    return ProductListResponse(
        data=products,
        total=total,
        offset=search.offset,
        limit=search.limit,
        has_more=(search.offset + search.limit) < total,
    )


@router.get("/{product_id}", response_model=APIResponse)
def get_product(product_id: int):
    """Get a single product by ID."""
    service = get_product_service()
    product = service.get_product(product_id)
    return APIResponse(data=product)


@router.post("", response_model=APIResponse)
def create_product(data: ProductCreate):
    """Create a new product."""
    service = get_product_service()
    product = service.create_product(data)
    return APIResponse(data=product, message="Product created successfully")


@router.put("/{product_id}", response_model=APIResponse)
def update_product(product_id: int, data: ProductUpdate):
    """Update an existing product."""
    service = get_product_service()
    product = service.update_product(product_id, data)
    return APIResponse(data=product, message="Product updated successfully")


@router.delete("/{product_id}", response_model=APIResponse)
def delete_product(product_id: int):
    """Archive (soft-delete) a product."""
    service = get_product_service()
    service.delete_product(product_id)
    return APIResponse(message="Product archived successfully")
