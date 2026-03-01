import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

// =============================================================================
// Custom Error Class
// =============================================================================

export class ApiError extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly details: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    type: string = "unknown_error",
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.type = type;
    this.details = details;
  }
}

// =============================================================================
// Axios Instance
// =============================================================================

// TruHarvest backend uses /api/v1; set NEXT_PUBLIC_API_PREFIX="" for external API (e.g. 8001) with no prefix
const API_PREFIX =
  typeof process.env.NEXT_PUBLIC_API_PREFIX !== "undefined"
    ? process.env.NEXT_PUBLIC_API_PREFIX
    : "/api/v1";
const BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /\/$/,
    ""
  ) + (API_PREFIX || "");

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// =============================================================================
// Request Interceptor
// =============================================================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach auth token if available (future-proof for JWT auth)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// =============================================================================
// Response Interceptor
// =============================================================================

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ success: boolean; error?: { message: string; type: string; details: Record<string, unknown> } }>) => {
    if (error.response) {
      const { status, data } = error.response;

      // Parse structured error from FastAPI backend
      if (data?.error) {
        throw new ApiError(
          data.error.message,
          status,
          data.error.type,
          data.error.details ?? {}
        );
      }

      // Fallback for non-structured errors
      const fallbackMessage =
        typeof data === "string"
          ? data
          : (data as Record<string, unknown>)?.detail?.toString() ??
            error.message;

      throw new ApiError(fallbackMessage, status);
    }

    if (error.request) {
      throw new ApiError(
        "No response received from server. Please check your connection.",
        0,
        "network_error"
      );
    }

    throw new ApiError(
      error.message ?? "An unexpected error occurred.",
      0,
      "request_error"
    );
  }
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Typed GET request. Returns the response `data` directly.
 */
export async function get<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await apiClient.get<T>(url, { params });
  return response.data;
}

/**
 * Typed POST request. Returns the response `data` directly.
 */
export async function post<T>(
  url: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await apiClient.post<T>(url, data, { params });
  return response.data;
}

/**
 * Typed PUT request. Returns the response `data` directly.
 */
export async function put<T>(
  url: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await apiClient.put<T>(url, data, { params });
  return response.data;
}

/**
 * Typed DELETE request. Returns the response `data` directly.
 */
export async function del<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await apiClient.delete<T>(url, { params });
  return response.data;
}

/**
 * GET request that returns a Blob (useful for PDF downloads, etc.).
 */
export async function getBlob(
  url: string,
  params?: Record<string, unknown>
): Promise<Blob> {
  const response = await apiClient.get(url, {
    params,
    responseType: "blob",
  });
  return response.data as Blob;
}

export { apiClient };
export default apiClient;
