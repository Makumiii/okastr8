/**
 * API Client Wrapper
 * Handles authentication and provides consistent API access
 */

const API_BASE = "/api";

interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith("/api") ? endpoint : `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        credentials: "include", // Include cookies for session auth
    });

    // Handle unauthorized - redirect to login
    if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Unauthorized");
    }

    const data = await response.json();
    return data as ApiResponse<T>;
}

/**
 * GET request helper
 */
export async function get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, { method: "GET" });
}

/**
 * POST request helper
 */
export async function post<T = any>(
    endpoint: string,
    body?: any
): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
    });
}
