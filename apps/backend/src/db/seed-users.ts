import type { Role } from '@gamification/shared';
import { db } from './client.js';
import { users } from './schema/index.js';
import type { AppDatabase } from './users.repository.js';

export type SeedRole = Extract<Role, 'lecturer' | 'admin'>;

export interface SeedUserInput {
  login: string;
  role: SeedRole;
}

export interface SeedUsersResult {
  createdCount: number;
  skippedCount: number;
  createdLogins: string[];
  skippedLogins: string[];
}

const MAX_LOGIN_LENGTH = 64;
const LOGIN_PATTERN = /^[a-z0-9._-]+$/;

/** Mirrors docker/ldap/bootstrap/50-seed.ldif (faculty accounts only; students come from CSV). */
export const DEFAULT_DEV_SEED_USERS: readonly SeedUserInput[] = [
  { login: 'lecturer1', role: 'lecturer' },
  { login: 'lecturer2', role: 'lecturer' },
  { login: 'lecturer3', role: 'lecturer' },
  { login: 'lecturer4', role: 'lecturer' },
  { login: 'lecturer5', role: 'lecturer' },
  { login: 'admin1', role: 'admin' },
  { login: 'admin2', role: 'admin' },
  { login: 'admin3', role: 'admin' },
  { login: 'admin4', role: 'admin' },
  { login: 'admin5', role: 'admin' },
];

function normalizeAndValidateLogin(rawLogin: string): string {
  const normalized = rawLogin.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error('Seed login must not be empty');
  }
  if (normalized.length > MAX_LOGIN_LENGTH) {
    throw new Error(`Seed login "${normalized}" exceeds ${MAX_LOGIN_LENGTH} characters`);
  }
  if (!LOGIN_PATTERN.test(normalized)) {
    throw new Error(`Seed login "${rawLogin}" contains invalid characters`);
  }
  return normalized;
}

function parseEnvLogins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(normalizeAndValidateLogin);
}

/**
 * Resolves the list of lecturer/admin accounts to seed.
 * - If SEED_ADMIN_LOGINS or SEED_LECTURER_LOGINS is provided, uses only those logins.
 * - Otherwise, falls back to DEFAULT_DEV_SEED_USERS only when NODE_ENV=development.
 * - Fails closed when NODE_ENV is unset or set to any non-development value.
 */
export function resolveSeedUsers(env: NodeJS.ProcessEnv = process.env): SeedUserInput[] {
  const hasExplicitEnv =
    Boolean(env.SEED_ADMIN_LOGINS?.trim()) || Boolean(env.SEED_LECTURER_LOGINS?.trim());

  if (!hasExplicitEnv) {
    if (env.NODE_ENV !== 'development') {
      throw new Error(
        'Refusing to seed default development accounts unless NODE_ENV=development. Set SEED_ADMIN_LOGINS and/or SEED_LECTURER_LOGINS explicitly.',
      );
    }
    return DEFAULT_DEV_SEED_USERS.map((entry) => ({ ...entry }));
  }

  const adminLogins = parseEnvLogins(env.SEED_ADMIN_LOGINS);
  const lecturerLogins = parseEnvLogins(env.SEED_LECTURER_LOGINS);

  const byLogin = new Map<string, SeedRole>();
  for (const login of adminLogins) {
    byLogin.set(login, 'admin');
  }
  for (const login of lecturerLogins) {
    const existingRole = byLogin.get(login);
    if (existingRole && existingRole !== 'lecturer') {
      throw new Error(`Login "${login}" cannot be assigned to both admin and lecturer seed roles`);
    }
    byLogin.set(login, 'lecturer');
  }

  return Array.from(byLogin, ([login, role]) => ({ login, role }));
}

export async function seedUsers(
  entries: readonly SeedUserInput[],
  database: AppDatabase = db,
): Promise<SeedUsersResult> {
  if (entries.length === 0) {
    return { createdCount: 0, skippedCount: 0, createdLogins: [], skippedLogins: [] };
  }

  const deduplicated = new Map<string, SeedRole>();
  for (const entry of entries) {
    const login = normalizeAndValidateLogin(entry.login);
    const existingRole = deduplicated.get(login);
    if (existingRole && existingRole !== entry.role) {
      throw new Error(`Conflicting seed roles for login "${login}"`);
    }
    deduplicated.set(login, entry.role);
  }

  const normalizedEntries = Array.from(deduplicated, ([login, role]) => ({ login, role }));

  const insertedLogins = await database.transaction(async (tx) => {
    const rows = await tx
      .insert(users)
      .values(normalizedEntries)
      .onConflictDoNothing()
      .returning({ login: users.login });

    return new Set(rows.map((row) => row.login));
  });

  const createdLogins = normalizedEntries
    .map((entry) => entry.login)
    .filter((login) => insertedLogins.has(login));
  const skippedLogins = normalizedEntries
    .map((entry) => entry.login)
    .filter((login) => !insertedLogins.has(login));

  return {
    createdCount: createdLogins.length,
    skippedCount: skippedLogins.length,
    createdLogins,
    skippedLogins,
  };
}
