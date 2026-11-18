import { apiFetch } from './client';

export interface LoginCredentials {
  login: string;
  password: string;
}

export class LoginError extends Error {}

/**
 * Tymczasowa atrapa logowania - backend /api/auth/login jeszcze nie istnieje.
 * Na potrzeby podglądu: hasło "zle" symuluje błędne dane, login "ldap" - niedostępny serwer.
 * TODO: zastąpić prawdziwym POST /api/auth/login, gdy backend będzie gotowy.
 */
export async function login({ login, password }: LoginCredentials): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (login.toLowerCase() === 'ldap') {
    throw new LoginError('Serwer LDAP jest niedostępny. Spróbuj ponownie później.');
  }
  if (password === 'zle') {
    throw new LoginError('Nieprawidłowy login lub hasło.');
  }
}

/** Ends the session on the server: revokes the token and clears the auth_token cookie. */
export async function logout(): Promise<void> {
  // Only the status matters: 2xx/401 means the session ended, even if the body is unreadable.
  await apiFetch('/api/auth/logout', { method: 'POST', ignoreBodyErrors: true });
}
