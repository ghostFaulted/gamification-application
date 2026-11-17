import type { AuthUser, LoginResponse } from '@gamification/shared';
import { ApiError, apiFetch } from './client';

export interface LoginCredentials {
  login: string;
  password: string;
}

export class LoginError extends Error {}

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
    throw new LoginError(loginErrorMessage(error));
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

/** Ends the session on the server: revokes the token and clears the auth_token cookie. */
export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}
