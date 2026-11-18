/** Error thrown by apiFetch for a failed request (status 0 = no connection). */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Receives the path of the request that got the 401, e.g. "/api/auth/logout". */
type UnauthorizedHandler = (path: string) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registers the callback run on every HTTP 401, i.e. when the session has expired. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON; a FormData body (file upload) is sent as multipart. */
  body?: unknown;
  signal?: AbortSignal;
  /**
   * For calls whose response body is not used (e.g. logout): if reading the body fails,
   * keep the received status instead of throwing, so the outcome is still known.
   */
  ignoreBodyErrors?: boolean;
}

/**
 * Calls the backend, e.g. `apiFetch<User>('/api/users/me')`, with the session cookie.
 * Returns the parsed JSON body or throws ApiError; a 401 also runs the unauthorized handler.
 */
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, signal, ignoreBodyErrors = false }: ApiFetchOptions = {},
): Promise<T> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await send(path, {
      method,
      headers,
      credentials: 'include',
      signal,
      body:
        body === undefined || isFormData ? (body as FormData | undefined) : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, 'Brak połączenia z serwerem. Spróbuj ponownie później.');
  }

  const data = ignoreBodyErrors
    ? await readBody(response).catch(() => undefined)
    : await readBody(response);
  if (response.status === 401) unauthorizedHandler?.(path);
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, data), data);
  return data as T;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// NestJS errors look like { statusCode, message: string | string[], error }.
function errorMessage(status: number, data: unknown): string {
  if (status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
  if (data && typeof data === 'object' && 'message' in data) {
    const { message } = data;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
  }
  if (status === 403) return 'Brak uprawnień do tej operacji.';
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}

// TODO: remove this dev-only mock once the auth backend exists.
// To test an expired session, log in and run in the browser console: __simulateExpiredSession()
// It sends a request that answers 401 locally, so the app logs out with "Sesja wygasła".
const DEV_EXPIRED_PATH = '/api/__dev/expired-session';

function send(path: string, init: RequestInit): Promise<Response> {
  if (import.meta.env.DEV && path === DEV_EXPIRED_PATH) {
    return Promise.resolve(new Response(null, { status: 401 }));
  }
  return fetch(path, init);
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    __simulateExpiredSession: () => apiFetch(DEV_EXPIRED_PATH).catch(() => undefined),
  });
}
