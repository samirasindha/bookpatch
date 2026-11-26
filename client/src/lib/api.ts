export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * True when the API looks like it isn't running yet: the request never connected (fetch throws a TypeError)
 * or the dev proxy answered for it with a 5xx. The server can take a while to start the first time because it
 * runs database migrations, so startup queries keep retrying for about a minute instead of giving up.
 */
export function isServerDown(error: unknown) {
  return error instanceof TypeError || (error instanceof ApiError && error.status >= 500);
}

export const SERVER_WAIT_RETRIES = 40;
export const SERVER_WAIT_DELAY_MS = 1500;

/** Retry options for queries the app needs before it can show anything. */
export const waitForServer = {
  retry: (failureCount: number, error: unknown) => isServerDown(error) && failureCount < SERVER_WAIT_RETRIES,
  retryDelay: SERVER_WAIT_DELAY_MS,
};

/** Small typed wrapper around fetch for the Bookpatch API. Sends the session cookie automatically. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
