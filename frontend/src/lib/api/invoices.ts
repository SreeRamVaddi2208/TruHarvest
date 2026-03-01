import { get, post, getBlob } from "@/lib/api-client";
import type {
  Invoice,
  InvoiceCreate,
  InvoiceParams,
  Partner,
  PartnerParams,
  PaginatedResponse,
  APIResponse,
} from "@/lib/types";

/**
 * Fetch a paginated list of invoices.
 */
export function getInvoices(
  params?: InvoiceParams
): Promise<PaginatedResponse<Invoice>> {
  return get<PaginatedResponse<Invoice>>(
    "/invoices",
    params as Record<string, unknown>
  );
}

/**
 * Fetch a single invoice by ID.
 */
export function getInvoice(id: number): Promise<APIResponse<Invoice>> {
  return get<APIResponse<Invoice>>(`/invoices/${id}`);
}

/**
 * Create a new invoice.
 */
export function createInvoice(
  data: InvoiceCreate
): Promise<APIResponse<Invoice>> {
  return post<APIResponse<Invoice>>("/invoices", data);
}

/**
 * Confirm a draft invoice.
 */
export function confirmInvoice(id: number): Promise<APIResponse<Invoice>> {
  return post<APIResponse<Invoice>>(`/invoices/${id}/confirm`);
}

/**
 * Cancel an invoice.
 */
export function cancelInvoice(id: number): Promise<APIResponse<Invoice>> {
  return post<APIResponse<Invoice>>(`/invoices/${id}/cancel`);
}

/**
 * Download an invoice as a PDF blob.
 */
export function getInvoicePdf(id: number): Promise<Blob> {
  return getBlob(`/invoices/${id}/pdf`);
}

/**
 * Fetch a paginated list of partners (customers / vendors).
 */
export function getPartners(
  params?: PartnerParams
): Promise<PaginatedResponse<Partner>> {
  return get<PaginatedResponse<Partner>>(
    "/invoices/partners",
    params as Record<string, unknown>
  );
}
