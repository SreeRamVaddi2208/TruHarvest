import { get, post, put, del } from "@/lib/api-client";
import type {
  Product,
  ProductCreate,
  ProductUpdate,
  ProductSearchRequest,
  ProductStockInfo,
  ProductParams,
  PaginatedResponse,
  APIResponse,
} from "@/lib/types";

/**
 * Fetch a paginated list of products.
 */
export function getProducts(
  params?: ProductParams
): Promise<PaginatedResponse<Product>> {
  return get<PaginatedResponse<Product>>("/products", params as Record<string, unknown>);
}

/**
 * Fetch a single product by ID.
 */
export function getProduct(id: number): Promise<APIResponse<Product>> {
  return get<APIResponse<Product>>(`/products/${id}`);
}

/**
 * Fetch stock levels for products.
 */
export function getStockLevels(
  params?: ProductParams
): Promise<PaginatedResponse<ProductStockInfo>> {
  return get<PaginatedResponse<ProductStockInfo>>(
    "/products/stock",
    params as Record<string, unknown>
  );
}

/**
 * Search products with advanced filters.
 */
export function searchProducts(
  data: ProductSearchRequest
): Promise<PaginatedResponse<Product>> {
  return post<PaginatedResponse<Product>>("/products/search", data);
}

/**
 * Create a new product.
 */
export function createProduct(
  data: ProductCreate
): Promise<APIResponse<Product>> {
  return post<APIResponse<Product>>("/products", data);
}

/**
 * Update an existing product.
 */
export function updateProduct(
  id: number,
  data: ProductUpdate
): Promise<APIResponse<Product>> {
  return put<APIResponse<Product>>(`/products/${id}`, data);
}

/**
 * Delete a product by ID.
 */
export function deleteProduct(id: number): Promise<APIResponse<null>> {
  return del<APIResponse<null>>(`/products/${id}`);
}

/**
 * Fetch all product categories.
 */
export function getCategories(): Promise<
  APIResponse<{ id: number; name: string }[]>
> {
  return get<APIResponse<{ id: number; name: string }[]>>(
    "/products/categories"
  );
}
