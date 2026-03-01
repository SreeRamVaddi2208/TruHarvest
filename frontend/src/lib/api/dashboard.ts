import { get, post } from "@/lib/api-client";
import type {
  DashboardStats,
  HealthResponse,
  SyncStatus,
  APIResponse,
} from "@/lib/types";

/**
 * Fetch dashboard statistics (KPIs, top products, recent movements, etc.).
 */
export function getDashboardStats(): Promise<APIResponse<DashboardStats>> {
  return get<APIResponse<DashboardStats>>("/dashboard");
}

/**
 * Check backend and Odoo health status.
 */
export function getHealthStatus(): Promise<HealthResponse> {
  return get<HealthResponse>("/health");
}

/**
 * Get the current synchronisation status with Odoo.
 */
export function getSyncStatus(): Promise<APIResponse<SyncStatus>> {
  return get<APIResponse<SyncStatus>>("/sync/status");
}

/**
 * Trigger a manual sync with Odoo.
 */
export function triggerSync(): Promise<APIResponse<null>> {
  return post<APIResponse<null>>("/sync/trigger");
}
