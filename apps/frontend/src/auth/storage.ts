import { ROLES, type AuthUser } from '@gamification/shared';

// The JWT itself is in an httpOnly cookie that JS cannot read. Only the public user data
// (login + role) is kept here, so a page reload does not lose the session. The backend has
// no "who am I" endpoint yet; if the cookie has expired, the next API call answers 401
// and the app logs out with "Sesja wygasła".
const STORAGE_KEY = 'gamification.user';

export function loadStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (
      data &&
      typeof data === 'object' &&
      'login' in data &&
      'role' in data &&
      typeof data.login === 'string' &&
      (ROLES as readonly unknown[]).includes(data.role)
    ) {
      return { login: data.login, role: data.role as AuthUser['role'] };
    }
  } catch {
    // Broken or unavailable storage: start signed out.
  }
  return null;
}

export function storeUser(user: AuthUser | null): void {
  try {
    if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (e.g. private mode): the session just will not survive a reload.
  }
}
