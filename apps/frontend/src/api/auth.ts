import type { AuthUser, LoginResponse, MeResponse } from '@gamification/shared';
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
 * Throws ApiError: 401 when there is no valid session, 0 when the server is unreachable or
 * does not answer in time. Aborting the given signal rethrows the abort error unchanged.
 */
export async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const timeout = AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS);
  try {
    const { user } = await apiFetch<MeResponse>('/api/auth/me', {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return user;
  } catch (error) {
    // A timeout is reported like a lost connection; a caller's abort (e.g. unmount) is not.
    if (timeout.aborted && !signal?.aborted) {
      throw new ApiError(0, 'Serwer nie odpowiada. Spróbuj ponownie.');
    }
    throw error;
  }
}

/** Ends the session on the server: revokes the token and clears the auth_token cookie. */
export async function logout(): Promise<void> {
  // Only the status matters: 2xx/401 means the session ended, even if the body is unreadable.
  await apiFetch('/api/auth/logout', { method: 'POST', ignoreBodyErrors: true });
}
