// =============================================================================
// Product Types
// =============================================================================

export interface Product {
  id: number;
  name: string;
  default_code: string | null;
  barcode: string | null;
  list_price: number;
  standard_price: number;
  qty_available: number;
  virtual_available: number;
  categ_id: number | null;
  categ_name: string | null;
  uom_id: number | null;
  uom_name: string | null;
  type: string | null;
  image_url: string | null;
  hs_code: string | null;
  weight: number | null;
  volume: number | null;
  active: boolean;
  description: string | null;
}

export interface ProductCreate {
  name: string;
  default_code?: string;
  barcode?: string;
  list_price: number;
  standard_price: number;
  type?: string;
  categ_id?: number;
  description?: string;
  weight?: number;
  volume?: number;
  hs_code?: string;
}

export interface ProductUpdate {
  name?: string;
  default_code?: string;
  barcode?: string;
  list_price?: number;
  standard_price?: number;
  categ_id?: number;
  description?: string;
  weight?: number;
  volume?: number;
  hs_code?: string;
}

export interface ProductSearchRequest {
  query?: string;
  category_id?: number;
  min_stock?: number;
  max_stock?: number;
  min_price?: number;
  max_price?: number;
  active_only?: boolean;
  has_barcode?: boolean;
  offset?: number;
  limit?: number;
  order?: string;
}

export interface ProductStockInfo {
  product_id: number;
  product_name: string;
  sku: string | null;
  qty_available: number;
  qty_forecasted: number;
  qty_reserved: number;
  incoming_qty: number;
  outgoing_qty: number;
  uom: string | null;
}

// =============================================================================
// Stock Types
// =============================================================================

export interface StockMove {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  product_uom: string | null;
  location_id: number | null;
  location_name: string | null;
  location_dest_id: number | null;
  location_dest_name: string | null;
  date: string | null;
  reference: string | null;
  state: string | null;
  origin: string | null;
  picking_type: string | null;
}

export interface StockMoveCreate {
  product_id: number;
  quantity: number;
  location_id?: number;
  location_dest_id?: number;
  move_type: string;
  reference?: string;
}

export interface StockPickingCreate {
  partner_id?: number;
  picking_type: string;
  scheduled_date?: string;
  origin?: string;
  lines: StockMoveCreate[];
}

export interface StockPicking {
  id: number;
  name: string;
  partner_id: number | null;
  partner_name: string | null;
  picking_type: string | null;
  scheduled_date: string | null;
  date_done: string | null;
  state: string | null;
  origin: string | null;
  move_lines: StockMove[];
}

export interface StockAdjustment {
  product_id: number;
  new_quantity: number;
  location_id?: number;
  reason?: string;
}

export interface StockLocation {
  id: number;
  name: string;
  complete_name: string | null;
  usage: string | null;
}

// =============================================================================
// Invoice Types
// =============================================================================

export interface Invoice {
  id: number;
  name: string;
  partner_id: number | null;
  partner_name: string | null;
  move_type: string | null;
  state: string | null;
  payment_state: string | null;
  invoice_date: string | null;
  invoice_date_due: string | null;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  amount_residual: number;
  currency_id: number | null;
  currency_name: string | null;
  ref: string | null;
  narration: string | null;
  invoice_lines: InvoiceLine[];
}

export interface InvoiceLine {
  id: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number;
  price_unit: number;
  discount: number;
  price_subtotal: number;
  price_total: number;
  name: string | null;
}

export interface InvoiceLineCreate {
  product_id: number;
  quantity: number;
  price_unit?: number;
  discount?: number;
  name?: string;
}

export interface InvoiceCreate {
  partner_id: number;
  invoice_date?: string;
  move_type?: string;
  narration?: string;
  ref?: string;
  lines: InvoiceLineCreate[];
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface DashboardStats {
  total_products: number;
  total_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  pending_incoming: number;
  pending_outgoing: number;
  total_invoices: number;
  unpaid_invoices: number;
  revenue_this_month: number;
  top_products: {
    name: string;
    sku: string;
    qty: number;
    value: number;
  }[];
  recent_movements: {
    product: string;
    qty: number;
    date: string;
    reference: string;
  }[];
  stock_by_category: {
    category: string;
    quantity: number;
    value: number;
  }[];
  pending_incoming_list?: {
    id: number;
    name: string;
    state: string;
    scheduled_date: string;
    origin: string;
  }[];
  pending_outgoing_list?: {
    id: number;
    name: string;
    state: string;
    scheduled_date: string;
    origin: string;
  }[];
}

// =============================================================================
// Common Types
// =============================================================================

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

export interface APIError {
  message: string;
  type: string;
  details: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  version: string;
  odoo_connected: boolean;
  odoo_version: string | null;
}

export interface Partner {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  vat: string | null;
  is_company: boolean;
}

// =============================================================================
// Query Param Types (for convenience)
// =============================================================================

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

export interface StockMovementParams extends PaginationParams {
  product_id?: number;
  state?: string;
  date_from?: string;
  date_to?: string;
}

export interface InvoiceParams extends PaginationParams {
  state?: string;
  partner_id?: number;
  date_from?: string;
  date_to?: string;
}

export interface PartnerParams extends PaginationParams {
  search?: string;
  is_company?: boolean;
}

export interface ProductParams extends PaginationParams {
  search?: string;
  category_id?: number;
  active_only?: boolean;
}

export interface PickingParams extends PaginationParams {
  picking_type?: string;
  state?: string;
}

export interface SyncStatus {
  last_sync: string | null;
  is_syncing: boolean;
  sync_errors: string[];
}
