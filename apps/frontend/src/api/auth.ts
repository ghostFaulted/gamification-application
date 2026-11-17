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
