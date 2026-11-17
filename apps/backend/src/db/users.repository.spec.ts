import { bulkInsertStudents, findUserByLogin, type AppDatabase } from './users.repository';

function createFakeDb(existingLogins: Set<string>) {
  const insertedCalls: Array<Array<{ login: string; role: string }>> = [];

  const fakeTx = {
    insert: () => ({
      values: (rows: Array<{ login: string; role: string }>) => {
        insertedCalls.push(rows);
        return {
          onConflictDoNothing: () => ({
            returning: async () => {
              const created: Array<{ id: string }> = [];
              for (const row of rows) {
                if (!existingLogins.has(row.login)) {
                  existingLogins.add(row.login);
                  created.push({ id: `uuid-${row.login}` });
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
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  } as unknown as AppDatabase;

  return { fakeDb, insertedCalls };
}

describe('users.repository', () => {
  it('returns zeroes without touching database when input array is empty', async () => {
    const existing = new Set<string>();
    const { fakeDb, insertedCalls } = createFakeDb(existing);

    const result = await bulkInsertStudents([], fakeDb);

    expect(result).toEqual({ createdCount: 0, skippedDuplicatesCount: 0 });
    expect(insertedCalls).toHaveLength(0);
  });

  it('normalizes logins, deduplicates input, and counts existing DB collisions', async () => {
    const existing = new Set<string>(['s222222']);
    const { fakeDb, insertedCalls } = createFakeDb(existing);

    const result = await bulkInsertStudents(
      [' s111111 ', 'S111111', 's222222', 's333333', 's333333'],
      fakeDb,
    );

    expect(result).toEqual({
      createdCount: 2,
      skippedDuplicatesCount: 3,
    });
    expect(insertedCalls).toEqual([
      [
        { login: 's111111', role: 'student' },
        { login: 's222222', role: 'student' },
        { login: 's333333', role: 'student' },
      ],
    ]);
  });

  it('chunks inserts above 1000 unique logins inside a single transaction', async () => {
    const existing = new Set<string>();
    const { fakeDb, insertedCalls } = createFakeDb(existing);
    const logins = Array.from({ length: 1250 }, (_, i) => `s${100000 + i}`);

    const result = await bulkInsertStudents(logins, fakeDb);

    expect(result).toEqual({ createdCount: 1250, skippedDuplicatesCount: 0 });
    expect(insertedCalls).toHaveLength(2);
    expect(insertedCalls[0]).toHaveLength(1000);
    expect(insertedCalls[1]).toHaveLength(250);
  });

  it('throws when rawLogins contains an empty or whitespace-only login', async () => {
    const { fakeDb } = createFakeDb(new Set());

    await expect(bulkInsertStudents(['s111111', '   '], fakeDb)).rejects.toThrow(
      'Login must not be empty',
    );
  });

  it('throws in findUserByLogin when login is empty', async () => {
    const { fakeDb } = createFakeDb(new Set());

    await expect(findUserByLogin('  ', fakeDb)).rejects.toThrow('Login must not be empty');
  });
});
