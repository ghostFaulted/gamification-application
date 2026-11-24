import { ROLES, type AuthUser, type LoginResponse, type MeResponse } from '@gamification/shared';
import { ApiError, apiFetch } from './client';

export interface LoginCredentials {
  login: string;
  password: string;
}

export class LoginError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LoginError';
    this.status = status;
  }
}

/**
 * Signs in through LDAP (POST /api/auth/login). The server sets the auth_token cookie
 * and returns the user with their role. Throws LoginError with a message for the form.
 */
export async function login({ login, password }: LoginCredentials): Promise<AuthUser> {
  try {
    const { user } = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { login, password },
    });
    return user;
  } catch (error) {
    throw new LoginError(
      loginErrorMessage(error),
      error instanceof ApiError ? error.status : undefined,
    );
  }
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Nieprawidłowy login lub hasło.';
    if (error.status === 503) return 'Serwer LDAP jest niedostępny. Spróbuj ponownie później.';
    if (error.status === 0) return error.message;
  }
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}

/** How long the start-up session check may take before the server counts as not responding. */
const SESSION_CHECK_TIMEOUT_MS = 10_000;

/**
 * Asks the server who is signed in (GET /api/auth/me), based on the auth_token cookie.
 * Throws ApiError: 401 when there is no valid session; 0 when no valid answer arrived (server
 * unreachable, no answer in time or a malformed response). Aborting the given signal rethrows
 * the abort error unchanged.
 */
export async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  // Own controller instead of AbortSignal.any/timeout, which older browsers (e.g. Safari < 17.4)
  // do not have.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SESSION_CHECK_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });

  let data: MeResponse | undefined;
  try {
    data = await apiFetch<MeResponse>('/api/auth/me', { signal: controller.signal });
  } catch (error) {
    // An ApiError means the server answered (e.g. 401 = no session) or the connection failed,
    // so it is kept even if the timeout fired meanwhile, e.g. while the body was being read.
    // Only an abort by the timeout becomes "not responding"; a caller's abort is rethrown.
    if (!(error instanceof ApiError) && timedOut && !signal?.aborted) {
      throw new ApiError(0, 'Serwer nie odpowiada. Spróbuj ponownie.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  const user: unknown = data?.user;
  if (!isAuthUser(user)) {
    throw new ApiError(0, 'Nieprawidłowa odpowiedź serwera. Spróbuj ponownie.', data);
  }
  return { login: user.login, role: user.role };
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const { login, role } = value as Record<string, unknown>;
  return typeof login === 'string' && (ROLES as readonly unknown[]).includes(role);
}

/** Ends the session on the server: revokes the token and clears the auth_token cookie. */
export async function logout(): Promise<void> {
  // Only the status matters: 2xx/401 means the session ended, even if the body is unreadable.
  await apiFetch('/api/auth/logout', { method: 'POST', ignoreBodyErrors: true });
}
