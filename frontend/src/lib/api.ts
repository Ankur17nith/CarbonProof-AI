import type { ApiErrorBody, ApiResponse } from '@/types/api';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId?: string;
  public readonly details?: Array<{ path: string; message: string }>;

  public constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setApiAuthToken(token: string | null): void {
  authToken = token;
}

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorizedCallback = callback;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  idempotencyKey?: string;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  const headers = new Headers(options.headers);

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      // Let the browser set the boundary header automatically
      body = options.body;
    } else {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (response.status === 401) {
    onUnauthorizedCallback?.();
  }

  if (!response.ok) {
    let errorData: ApiErrorBody['error'];
    try {
      const json = (await response.json()) as ApiErrorBody;
      errorData = json.error ?? {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'An unexpected error occurred',
      };
    } catch {
      errorData = {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'An unexpected error occurred',
      };
    }
    throw new ApiError(response.status, errorData);
  }

  // Handle binary downloads or empty responses
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const json = (await response.json()) as ApiResponse<T>;
    return json.data;
  }

  return (await response.blob()) as unknown as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
