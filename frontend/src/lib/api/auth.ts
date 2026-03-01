import { get } from "@/lib/api-client";
import type { APIResponse } from "@/lib/types";

export type AppRole = "viewer" | "controller" | "admin";

export interface MeResponse {
  role: AppRole;
}

/**
 * Get current app user role (viewer, controller, admin).
 * Controller and admin can accept draft and update state (confirm, validate).
 */
export function getMe(): Promise<APIResponse<MeResponse>> {
  return get<APIResponse<MeResponse>>("/me");
}
