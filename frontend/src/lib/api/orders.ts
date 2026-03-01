import { post } from "@/lib/api-client";
import type { APIResponse } from "@/lib/types";

const COMPANY_ID =
  typeof process.env.NEXT_PUBLIC_COMPANY_ID !== "undefined"
    ? Number(process.env.NEXT_PUBLIC_COMPANY_ID)
    : 3;

/** Line for place-order (Odoo: reduces stock + creates invoice). */
export interface PlaceOrderLine {
  product_id: number;
  quantity: number;
  price_unit?: number;
}

/** Request body for POST /orders/place. */
export interface PlaceOrderRequest {
  partner_id: number;
  lines: PlaceOrderLine[];
  origin?: string;
}

/** Response from place-order. */
export interface PlaceOrderResponse {
  success: boolean;
  message: string;
  delivery_id?: number;
  delivery_name?: string;
  invoice_id?: number;
  invoice_name?: string;
}

/**
 * Place customer order in Odoo: creates outgoing delivery (reduces stock) and invoice.
 */
export function placeOrderInOdoo(
  data: PlaceOrderRequest
): Promise<APIResponse<PlaceOrderResponse>> {
  return post<APIResponse<PlaceOrderResponse>>("/orders/place", data);
}

/**
 * Create order – POST /orders (external API). Sends company_id for the external API.
 */
export function createOrder(
  data: Record<string, unknown>
): Promise<APIResponse<unknown>> {
  return post<APIResponse<unknown>>("/orders", {
    ...data,
    company_id: (data?.company_id as number) ?? COMPANY_ID,
  });
}

/**
 * Payment success – POST /orders/{orderId}/payment_success (external API).
 */
export function paymentSuccess(
  orderId: number,
  data?: Record<string, unknown>
): Promise<APIResponse<unknown>> {
  return post<APIResponse<unknown>>(
    `/orders/${orderId}/payment_success`,
    data ?? {}
  );
}
