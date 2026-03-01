"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

// Product API
import {
  getProducts,
  getProduct,
  getStockLevels,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
} from "@/lib/api/products";

// Stock API
import {
  getStockMovements,
  createIncomingShipment,
  createOutgoingDelivery,
  adjustStock,
  getLocations,
  getWarehouses,
  getPickings,
  confirmPicking,
  validatePicking,
  setupTruHarvestWarehouse,
} from "@/lib/api/stock";

// Invoice API
import {
  getInvoices,
  getInvoice,
  createInvoice,
  confirmInvoice,
  cancelInvoice,
  getPartners,
} from "@/lib/api/invoices";

// Dashboard API
import {
  getDashboardStats,
  getHealthStatus,
  getSyncStatus,
  triggerSync,
} from "@/lib/api/dashboard";

// Orders API (place order in Odoo)
import {
  placeOrderInOdoo,
  type PlaceOrderRequest,
} from "@/lib/api/orders";

// Auth / current role
import { getMe } from "@/lib/api/auth";

// Types
import type {
  Product,
  ProductCreate,
  ProductUpdate,
  ProductSearchRequest,
  ProductStockInfo,
  ProductParams,
  StockMove,
  StockPickingCreate,
  StockPicking,
  StockAdjustment,
  StockMovementParams,
  PickingParams,
  Invoice,
  InvoiceCreate,
  InvoiceParams,
  Partner,
  PartnerParams,
  DashboardStats,
  HealthResponse,
  SyncStatus,
  PaginatedResponse,
  APIResponse,
} from "@/lib/types";

// =============================================================================
// Shared defaults
// =============================================================================

const STALE_TIME = 5_000; // 5 seconds – keep data fresh
const REFETCH_INTERVAL = 30_000; // 30 seconds – general polling

// Products & stock use a faster cadence so Odoo changes appear almost instantly
const PRODUCT_STALE_TIME = 3_000; // 3 seconds
const PRODUCT_REFETCH_INTERVAL = 10_000; // 10 seconds
// Dashboard refreshes often so pending incoming/outgoing show quickly
const DASHBOARD_REFETCH_INTERVAL = 5_000; // 5 seconds

/** Convenience type alias for partial query option overrides. */
type ExtraQueryOpts<T> = Partial<
  Pick<UseQueryOptions<T>, "enabled" | "staleTime" | "refetchInterval">
>;

// =============================================================================
// Query Keys – centralised for easy invalidation
// =============================================================================

export const queryKeys = {
  // Products
  products: (params?: ProductParams) => ["products", params] as const,
  product: (id: number) => ["products", id] as const,
  stockLevels: (params?: ProductParams) => ["stock-levels", params] as const,
  searchProducts: (data?: ProductSearchRequest) =>
    ["products", "search", data] as const,
  categories: () => ["categories"] as const,

  // Stock
  stockMovements: (params?: StockMovementParams) =>
    ["stock-movements", params] as const,
  locations: () => ["locations"] as const,
  warehouses: () => ["warehouses"] as const,
  pickings: (params?: PickingParams) => ["pickings", params] as const,

  // Invoices
  invoices: (params?: InvoiceParams) => ["invoices", params] as const,
  invoice: (id: number) => ["invoices", id] as const,
  partners: (params?: PartnerParams) => ["partners", params] as const,

  // Dashboard & system
  dashboard: () => ["dashboard"] as const,
  health: () => ["health"] as const,
  syncStatus: () => ["sync-status"] as const,
  me: () => ["me"] as const,
} as const;

// =============================================================================
// Product Hooks
// =============================================================================

export function useProducts(
  params?: ProductParams,
  opts?: ExtraQueryOpts<PaginatedResponse<Product>>
) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => getProducts(params),
    staleTime: PRODUCT_STALE_TIME,
    refetchInterval: PRODUCT_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    ...opts,
  });
}

export function useProduct(
  id: number,
  opts?: ExtraQueryOpts<APIResponse<Product>>
) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => getProduct(id),
    staleTime: PRODUCT_STALE_TIME,
    refetchInterval: PRODUCT_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    enabled: id > 0,
    ...opts,
  });
}

export function useStockLevels(
  params?: ProductParams,
  opts?: ExtraQueryOpts<PaginatedResponse<ProductStockInfo>>
) {
  return useQuery({
    queryKey: queryKeys.stockLevels(params),
    queryFn: () => getStockLevels(params),
    staleTime: PRODUCT_STALE_TIME,
    refetchInterval: PRODUCT_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    ...opts,
  });
}

export function useSearchProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProductSearchRequest) => searchProducts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProductCreate) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductUpdate }) =>
      updateProduct(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.product(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => getCategories(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// =============================================================================
// Stock Hooks
// =============================================================================

export function useStockMovements(
  params?: StockMovementParams,
  opts?: ExtraQueryOpts<PaginatedResponse<StockMove>>
) {
  return useQuery({
    queryKey: queryKeys.stockMovements(params),
    queryFn: () => getStockMovements(params),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    ...opts,
  });
}

export function useCreateIncoming() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StockPickingCreate) => createIncomingShipment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["pickings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateOutgoing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StockPickingCreate) => createOutgoingDelivery(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["pickings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StockAdjustment) => adjustStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: queryKeys.locations(),
    queryFn: () => getLocations(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.warehouses(),
    queryFn: () => getWarehouses(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function usePickings(
  params?: PickingParams,
  opts?: ExtraQueryOpts<PaginatedResponse<StockPicking>>
) {
  return useQuery({
    queryKey: queryKeys.pickings(params),
    queryFn: () => getPickings(params),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    ...opts,
  });
}

export function useConfirmPicking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pickingId: number) => confirmPicking(pickingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });
}

export function useValidatePicking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pickingId: number) => validatePicking(pickingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });
}

export function useSetupTruHarvestWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => setupTruHarvestWarehouse(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// =============================================================================
// Invoice Hooks
// =============================================================================

export function useInvoices(
  params?: InvoiceParams,
  opts?: ExtraQueryOpts<PaginatedResponse<Invoice>>
) {
  return useQuery({
    queryKey: queryKeys.invoices(params),
    queryFn: () => getInvoices(params),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    ...opts,
  });
}

export function useInvoice(
  id: number,
  opts?: ExtraQueryOpts<APIResponse<Invoice>>
) {
  return useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: () => getInvoice(id),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    enabled: id > 0,
    ...opts,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InvoiceCreate) => createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useConfirmInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => confirmInvoice(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoice(id) });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cancelInvoice(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoice(id) });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function usePartners(
  params?: PartnerParams,
  opts?: ExtraQueryOpts<PaginatedResponse<Partner>>
) {
  return useQuery({
    queryKey: queryKeys.partners(params),
    queryFn: () => getPartners(params),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    ...opts,
  });
}

export function usePlaceOrderInOdoo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlaceOrderRequest) => placeOrderInOdoo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["pickings"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// =============================================================================
// Auth / Current role
// =============================================================================

export function useMe(opts?: ExtraQueryOpts<APIResponse<{ role: string }>>) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => getMe(),
    staleTime: 5 * 60 * 1000, // 5 min – role rarely changes
    ...opts,
  });
}

// =============================================================================
// Dashboard & System Hooks
// =============================================================================

export function useDashboardStats(
  opts?: ExtraQueryOpts<APIResponse<DashboardStats>>
) {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => getDashboardStats(),
    staleTime: PRODUCT_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    ...opts,
  });
}

export function useHealthStatus(opts?: ExtraQueryOpts<HealthResponse>) {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => getHealthStatus(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    ...opts,
  });
}

export function useSyncStatus(opts?: ExtraQueryOpts<APIResponse<SyncStatus>>) {
  return useQuery({
    queryKey: queryKeys.syncStatus(),
    queryFn: () => getSyncStatus(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    ...opts,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => triggerSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
