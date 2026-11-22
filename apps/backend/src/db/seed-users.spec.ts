import {
  DEFAULT_DEV_SEED_USERS,
  resolveSeedUsers,
  seedUsers,
  type SeedUserInput,
} from './seed-users.js';
import type { AppDatabase } from './users.repository.js';

function createFakeDb(existingLogins: Set<string>) {
  const insertedCalls: Array<Array<{ login: string; role: string }>> = [];

  const fakeTx = {
    insert: () => ({
      values: (rows: Array<{ login: string; role: string }>) => {
        insertedCalls.push(rows);
        return {
          onConflictDoNothing: () => ({
            returning: async () => {
              const created: Array<{ login: string }> = [];
              for (const row of rows) {
                if (!existingLogins.has(row.login)) {
                  existingLogins.add(row.login);
                  created.push({ login: row.login });
                }
              }
              return created;
            },
          }),
        };
      },
    }),
  };

  const fakeDb = {
    transaction: async <T>(cb: (tx: typeof fakeTx) => Promise<T>): Promise<T> => cb(fakeTx),
  } as unknown as AppDatabase;

  return { fakeDb, insertedCalls };
}

describe('resolveSeedUsers', () => {
  it('returns default lecturer1..5 and admin1..5 outside production when env vars are unset', () => {
    const resolved = resolveSeedUsers({ NODE_ENV: 'development' });

    expect(resolved).toEqual(DEFAULT_DEV_SEED_USERS);
    expect(resolved).toHaveLength(10);
    expect(resolved.filter((u) => u.role === 'lecturer')).toHaveLength(5);
    expect(resolved.filter((u) => u.role === 'admin')).toHaveLength(5);
  });

  it.each([undefined, '', 'production', 'staging', 'test'])(
    'refuses to seed default dev accounts when NODE_ENV=%j and env vars are unset',
    (nodeEnv) => {
      expect(() => resolveSeedUsers({ NODE_ENV: nodeEnv })).toThrow(/NODE_ENV=development/);
    },
  );

  it('parses explicit SEED_ADMIN_LOGINS and SEED_LECTURER_LOGINS even in production', () => {
    const resolved = resolveSeedUsers({
      NODE_ENV: 'production',
      SEED_ADMIN_LOGINS: ' Admin.One , admin.one ',
      SEED_LECTURER_LOGINS: 'mszczepanski,lecturer_2',
    });

    expect(resolved).toEqual([
      { login: 'admin.one', role: 'admin' },
      { login: 'mszczepanski', role: 'lecturer' },
      { login: 'lecturer_2', role: 'lecturer' },
    ]);
  });

  it('throws when the same login is listed in both admin and lecturer env vars', () => {
    expect(() =>
      resolveSeedUsers({
        SEED_ADMIN_LOGINS: 'shared_user',
        SEED_LECTURER_LOGINS: 'SHARED_USER',
      }),
    ).toThrow(/both admin and lecturer/);
  });

  it('throws on invalid login characters in env vars', () => {
    expect(() => resolveSeedUsers({ SEED_ADMIN_LOGINS: 'bad login' })).toThrow(
      /invalid characters/,
    );
  });
});

describe('seedUsers', () => {
  it('returns zeroes without touching database when input list is empty', async () => {
    const { fakeDb, insertedCalls } = createFakeDb(new Set());

    const result = await seedUsers([], fakeDb);

    expect(result).toEqual({
      createdCount: 0,
      skippedCount: 0,
      createdLogins: [],
      skippedLogins: [],
    });
    expect(insertedCalls).toHaveLength(0);
  });

  it('inserts new users idempotently and skips existing logins without overwriting', async () => {
    const existing = new Set<string>(['lecturer1', 'admin1']);
    const { fakeDb, insertedCalls } = createFakeDb(existing);

    const first = await seedUsers(DEFAULT_DEV_SEED_USERS, fakeDb);
    expect(first.createdCount).toBe(8);
    expect(first.skippedCount).toBe(2);
    expect(first.skippedLogins).toEqual(['lecturer1', 'admin1']);
    expect(insertedCalls).toHaveLength(1);

    const second = await seedUsers(DEFAULT_DEV_SEED_USERS, fakeDb);
    expect(second.createdCount).toBe(0);
    expect(second.skippedCount).toBe(10);
  });

  it('normalizes case and deduplicates repeated entries with the same role', async () => {
    const { fakeDb, insertedCalls } = createFakeDb(new Set());
    const entries: SeedUserInput[] = [
      { login: ' Lecturer1 ', role: 'lecturer' },
      { login: 'lecturer1', role: 'lecturer' },
      { login: 'ADMIN1', role: 'admin' },
    ];

    const result = await seedUsers(entries, fakeDb);

    expect(result).toEqual({
      createdCount: 2,
      skippedCount: 0,
      createdLogins: ['lecturer1', 'admin1'],
      skippedLogins: [],
    });
    expect(insertedCalls).toEqual([
      [
        { login: 'lecturer1', role: 'lecturer' },
        { login: 'admin1', role: 'admin' },
      ],
    ]);
  });

  it('throws on conflicting roles for the same login', async () => {
    const { fakeDb } = createFakeDb(new Set());

    await expect(
      seedUsers(
        [
          { login: 'user1', role: 'admin' },
          { login: 'USER1', role: 'lecturer' },
        ],
        fakeDb,
      ),
    ).rejects.toThrow(/Conflicting seed roles/);
  });
});
