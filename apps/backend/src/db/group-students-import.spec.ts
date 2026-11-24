import type { Role } from '@gamification/shared';
import { GroupNotFoundError, importGroupStudents } from './groups.repository';
import { groups, users } from './schema/index.js';
import type { AppDatabase } from './users.repository';

const GROUP_ID = '55555555-5555-4555-8555-555555555555';

interface FakeAccount {
  id: string;
  login: string;
  role: Role;
}

function createFakeDb({
  groupExists = true,
  accounts = [] as FakeAccount[],
  members = [] as string[],
} = {}) {
  const stored = [...accounts];
  const memberIds = new Set(members);
  const userInsertSizes: number[] = [];
  const linkInsertSizes: number[] = [];
  // The user lookup always follows the insert of the same chunk, so it answers for that chunk.
  let lastLoginChunk: string[] = [];

  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === groups) {
            return { for: async () => (groupExists ? [{ id: GROUP_ID }] : []) };
          }
          return Promise.resolve(
            stored.filter((account) => lastLoginChunk.includes(account.login.toLowerCase())),
          );
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (rows: Array<Record<string, string>>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (table === users) {
              lastLoginChunk = rows.map((row) => row.login);
              userInsertSizes.push(rows.length);
              const created: Array<{ login: string }> = [];
              for (const { login } of rows) {
                if (!stored.some((account) => account.login.toLowerCase() === login)) {
                  stored.push({ id: `id-${login}`, login, role: 'student' });
                  created.push({ login });
                }
              }
              return created;
            }

            linkInsertSizes.push(rows.length);
            const linked: Array<{ studentId: string }> = [];
            for (const { studentId } of rows) {
              if (!memberIds.has(studentId)) {
                memberIds.add(studentId);
                linked.push({ studentId });
              }
            }
            return linked;
          },
        }),
      }),
    }),
  };

  const fakeDb = {
    transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> => cb(tx),
  } as unknown as AppDatabase;

  return { fakeDb, memberIds, userInsertSizes, linkInsertSizes };
}

describe('importGroupStudents', () => {
  it('creates missing students, links them and reports every login by outcome', async () => {
    const { fakeDb, memberIds } = createFakeDb({
      accounts: [
        { id: 'id-s2', login: 'S2', role: 'student' },
        { id: 'id-s3', login: 's3', role: 'student' },
        { id: 'id-lecturer1', login: 'lecturer1', role: 'lecturer' },
        { id: 'id-admin1', login: 'admin1', role: 'admin' },
      ],
      members: ['id-s3'],
    });

    const result = await importGroupStudents(
      GROUP_ID,
      ['s1', 's2', ' S1 ', 's3', 'lecturer1', 'admin1', 's4'],
      fakeDb,
    );

    expect(result).toEqual({
      addedLogins: ['s1', 's2', 's4'],
      createdLogins: ['s1', 's4'],
      alreadyInGroupLogins: ['s3'],
      notStudentLogins: ['lecturer1', 'admin1'],
      duplicatesCount: 1,
    });
    expect([...memberIds].sort()).toEqual(['id-s1', 'id-s2', 'id-s3', 'id-s4']);
  });

  it('is idempotent: a second import of the same logins adds nobody', async () => {
    const { fakeDb } = createFakeDb();
    await importGroupStudents(GROUP_ID, ['s1', 's2'], fakeDb);

    const second = await importGroupStudents(GROUP_ID, ['s1', 's2'], fakeDb);

    expect(second).toEqual({
      addedLogins: [],
      createdLogins: [],
      alreadyInGroupLogins: ['s1', 's2'],
      notStudentLogins: [],
      duplicatesCount: 0,
    });
  });

  it('throws GroupNotFoundError and writes nothing when the group does not exist', async () => {
    const { fakeDb, userInsertSizes, linkInsertSizes } = createFakeDb({ groupExists: false });

    await expect(importGroupStudents(GROUP_ID, ['s1'], fakeDb)).rejects.toThrow(GroupNotFoundError);
    expect(userInsertSizes).toEqual([]);
    expect(linkInsertSizes).toEqual([]);
  });

  it('returns an empty result for no logins', async () => {
    const { fakeDb, userInsertSizes } = createFakeDb();

    await expect(importGroupStudents(GROUP_ID, [], fakeDb)).resolves.toEqual({
      addedLogins: [],
      createdLogins: [],
      alreadyInGroupLogins: [],
      notStudentLogins: [],
      duplicatesCount: 0,
    });
    expect(userInsertSizes).toEqual([]);
  });

  it('splits large imports into chunks of 1000', async () => {
    const { fakeDb, userInsertSizes, linkInsertSizes } = createFakeDb();
    const logins = Array.from({ length: 1250 }, (_, i) => `s${100000 + i}`);

    const result = await importGroupStudents(GROUP_ID, logins, fakeDb);

    expect(result.addedLogins).toEqual(logins);
    expect(userInsertSizes).toEqual([1000, 250]);
    expect(linkInsertSizes).toEqual([1000, 250]);
  });

  it('rejects an empty login', async () => {
    const { fakeDb } = createFakeDb();

    await expect(importGroupStudents(GROUP_ID, ['s1', '  '], fakeDb)).rejects.toThrow(
      'Login must not be empty',
    );
  });
});
