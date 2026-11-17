import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from './client.js';
import { users, type User } from './schema/index.js';

export type AppDatabase = typeof db;

export interface BulkInsertStudentsResult {
  createdCount: number;
  skippedDuplicatesCount: number;
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
    return { createdCount: 0, skippedDuplicatesCount: 0 };
  }

  const uniqueLogins = Array.from(new Set(rawLogins.map(normalizeLogin)));

  const createdCount = await database.transaction(async (tx) => {
    let insertedTotal = 0;

    for (let offset = 0; offset < uniqueLogins.length; offset += BULK_INSERT_CHUNK_SIZE) {
      const chunk = uniqueLogins.slice(offset, offset + BULK_INSERT_CHUNK_SIZE);
      const inserted = await tx
        .insert(users)
        .values(chunk.map((login) => ({ login, role: 'student' as const })))
        .onConflictDoNothing()
        .returning({ id: users.id });

      insertedTotal += inserted.length;
    }

    return insertedTotal;
  });

  return {
    createdCount,
    skippedDuplicatesCount: rawLogins.length - createdCount,
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
