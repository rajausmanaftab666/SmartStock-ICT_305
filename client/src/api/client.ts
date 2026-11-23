import type { ApiErrorBody } from '@shared';

/**
 * The single place the browser talks to the API.
 *
 * Every non-2xx response carries the `{ error, fields? }` body from §6, so this
 * wrapper turns it into an ApiError that pages can either drop onto individual
 * inputs (`fields`) or show in a red toast (`message`).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Body = Record<string, unknown> | undefined;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      // The dev server proxies /api, so the session cookie is first-party.
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as (ApiErrorBody & T) | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? 'Something went wrong.',
      payload?.fields
    );
  }

  return payload as T;
}

/** Appends only the query parameters that actually have a value. */
export function withQuery(path: string, params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: Body) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
