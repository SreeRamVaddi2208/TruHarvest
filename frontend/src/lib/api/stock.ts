import { get, post } from "@/lib/api-client";
import type {
  StockMove,
  StockPickingCreate,
  StockPicking,
  StockAdjustment,
  StockLocation,
  StockMovementParams,
  PickingParams,
  PaginatedResponse,
  APIResponse,
} from "@/lib/types";

/**
 * Fetch a paginated list of stock movements.
 */
export function getStockMovements(
  params?: StockMovementParams
): Promise<PaginatedResponse<StockMove>> {
  return get<PaginatedResponse<StockMove>>(
    "/stock/movements",
    params as Record<string, unknown>
  );
}

/**
 * Create an incoming shipment (receipt).
 */
export function createIncomingShipment(
  data: StockPickingCreate
): Promise<APIResponse<StockPicking>> {
  return post<APIResponse<StockPicking>>("/stock/incoming", data);
}

/**
 * Create an outgoing delivery.
 */
export function createOutgoingDelivery(
  data: StockPickingCreate
): Promise<APIResponse<StockPicking>> {
  return post<APIResponse<StockPicking>>("/stock/outgoing", data);
}

/**
 * Adjust stock quantity for a product.
 */
export function adjustStock(
  data: StockAdjustment
): Promise<APIResponse<null>> {
  return post<APIResponse<null>>("/stock/adjust", data);
}

/**
 * Fetch all stock locations.
 */
export function getLocations(): Promise<APIResponse<StockLocation[]>> {
  return get<APIResponse<StockLocation[]>>("/stock/locations");
}

/**
 * Fetch all warehouses.
 */
export function getWarehouses(): Promise<
  APIResponse<{ id: number; name: string; code: string }[]>
> {
  return get<APIResponse<{ id: number; name: string; code: string }[]>>(
    "/stock/warehouses"
  );
}

/**
 * Fetch a paginated list of stock pickings.
 */
export function getPickings(
  params?: PickingParams
): Promise<PaginatedResponse<StockPicking>> {
  return get<PaginatedResponse<StockPicking>>(
    "/stock/pickings",
    params as Record<string, unknown>
  );
}

/**
 * Confirm a draft picking (controller/admin role required).
 */
export function confirmPicking(
  pickingId: number
): Promise<APIResponse<StockPicking>> {
  return post<APIResponse<StockPicking>>(
    `/stock/pickings/${pickingId}/confirm`,
    {}
  );
}

/**
 * Validate a picking (set to done) (controller/admin role required).
 */
export function validatePicking(
  pickingId: number
): Promise<APIResponse<StockPicking>> {
  return post<APIResponse<StockPicking>>(
    `/stock/pickings/${pickingId}/validate`,
    {}
  );
}

export interface SetupWarehouseResponse {
  created: boolean;
  warehouse_id: number;
  message: string;
}

/**
 * Create TruHarvest warehouse in Odoo if it does not exist (controller/admin only).
 * Creates warehouse and locations so incoming/outgoing shipments work.
 */
export function setupTruHarvestWarehouse(): Promise<
  APIResponse<SetupWarehouseResponse>
> {
  return post<APIResponse<SetupWarehouseResponse>>("/stock/setup-warehouse", {});
}
