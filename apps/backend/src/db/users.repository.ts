import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from './client.js';
import { users, type User } from './schema/index.js';

export type AppDatabase = typeof db;

export interface BulkInsertStudentsResult {
  createdCount: number;
  skippedDuplicatesCount: number;
  /** Normalized logins actually inserted, in input order (length = createdCount). */
  createdLogins: string[];
  /**
   * Normalized logins of every input entry that did not create a user: already in the database
   * or repeated in the input (length = skippedDuplicatesCount, so a login may repeat).
   */
  skippedLogins: string[];
}

const BULK_INSERT_CHUNK_SIZE = 1000;

function normalizeLogin(rawLogin: string): string {
  const normalized = rawLogin.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error('Login must not be empty');
  }
  return normalized;
}

export async function findUserByLogin(
  login: string,
  database: AppDatabase = db,
): Promise<User | null> {
  const normalized = normalizeLogin(login);
  const [user] = await database
    .select()
    .from(users)
    .where(eq(sql`lower(${users.login})`, normalized))
    .limit(1);

  return user ?? null;
}

export async function bulkInsertStudents(
  rawLogins: readonly string[],
  database: AppDatabase = db,
): Promise<BulkInsertStudentsResult> {
  if (rawLogins.length === 0) {
    return { createdCount: 0, skippedDuplicatesCount: 0, createdLogins: [], skippedLogins: [] };
  }

  const normalizedLogins = rawLogins.map(normalizeLogin);
  const uniqueLogins = Array.from(new Set(normalizedLogins));

  const insertedLogins = await database.transaction(async (tx) => {
    const inserted = new Set<string>();

    for (let offset = 0; offset < uniqueLogins.length; offset += BULK_INSERT_CHUNK_SIZE) {
      const chunk = uniqueLogins.slice(offset, offset + BULK_INSERT_CHUNK_SIZE);
      const rows = await tx
        .insert(users)
        .values(chunk.map((login) => ({ login, role: 'student' as const })))
        .onConflictDoNothing()
        .returning({ login: users.login });

      for (const row of rows) {
        inserted.add(row.login);
      }
    }

    return inserted;
  });

  // RETURNING order is not guaranteed, so both lists follow the input order instead.
  const createdLogins = uniqueLogins.filter((login) => insertedLogins.has(login));
  const notYetCreated = new Set(createdLogins);
  const skippedLogins = normalizedLogins.filter((login) => !notYetCreated.delete(login));

  return {
    createdCount: createdLogins.length,
    skippedDuplicatesCount: skippedLogins.length,
    createdLogins,
    skippedLogins,
  };
}

export abstract class UsersRepository {
  abstract findByLogin(login: string): Promise<User | null>;
  abstract bulkInsertStudents(rawLogins: readonly string[]): Promise<BulkInsertStudentsResult>;
}

@Injectable()
export class DrizzleUsersRepository extends UsersRepository {
  async findByLogin(login: string): Promise<User | null> {
    return findUserByLogin(login);
  }

  async bulkInsertStudents(rawLogins: readonly string[]): Promise<BulkInsertStudentsResult> {
    return bulkInsertStudents(rawLogins);
  }
}
