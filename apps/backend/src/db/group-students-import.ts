import type { Role } from '@gamification/shared';

/** Unique normalized logins of an import, split by outcome; every list keeps the input order. */
export interface ImportGroupStudentsResult {
  addedLogins: string[];
  /** Accounts created by this import; a subset of `addedLogins`. */
  createdLogins: string[];
  alreadyInGroupLogins: string[];
  notStudentLogins: string[];
  /** Extra occurrences of logins repeated in the input. */
  duplicatesCount: number;
}

export interface PreparedImportLogins {
  /** First-seen unique logins, already trimmed and lowercased. */
  uniqueLogins: string[];
  duplicatesCount: number;
}

/**
 * Trims and lowercases logins, drops exact duplicates and counts them, and rejects empty ones.
 * Shared by the Drizzle import and the in-memory e2e fake so both classify the input the same way.
 */
export function prepareImportLogins(rawLogins: readonly string[]): PreparedImportLogins {
  const normalizedLogins = rawLogins.map((login) => login.trim().toLowerCase());
  if (normalizedLogins.some((login) => login.length === 0)) {
    throw new Error('Login must not be empty');
  }
  const uniqueLogins = Array.from(new Set(normalizedLogins));
  return {
    uniqueLogins,
    duplicatesCount: normalizedLogins.length - uniqueLogins.length,
  };
}

export interface ImportAccount {
  id: string;
  role: Role;
}

/**
 * Builds the import report from already-resolved accounts and the sets of created logins
 * and newly linked student ids. Throws if a prepared login has no account (the store
 * should have created or loaded it).
 */
export function classifyImportedStudents(input: {
  uniqueLogins: readonly string[];
  accounts: ReadonlyMap<string, ImportAccount>;
  created: ReadonlySet<string>;
  added: ReadonlySet<string>;
  duplicatesCount: number;
}): ImportGroupStudentsResult {
  const result: ImportGroupStudentsResult = {
    addedLogins: [],
    createdLogins: [],
    alreadyInGroupLogins: [],
    notStudentLogins: [],
    duplicatesCount: input.duplicatesCount,
  };
  for (const login of input.uniqueLogins) {
    const account = input.accounts.get(login);
    if (!account) {
      throw new Error(`Imported login "${login}" was not found after insert`);
    }
    if (account.role !== 'student') {
      result.notStudentLogins.push(login);
    } else if (input.added.has(account.id)) {
      result.addedLogins.push(login);
      if (input.created.has(login)) {
        result.createdLogins.push(login);
      }
    } else {
      result.alreadyInGroupLogins.push(login);
    }
  }
  return result;
}
