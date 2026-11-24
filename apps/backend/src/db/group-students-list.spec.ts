import { findGroupStudents } from './groups.repository';
import { groupStudents, users } from './schema/index.js';
import type { AppDatabase } from './users.repository';

const GROUP_ID = '55555555-5555-4555-8555-555555555555';

function createFakeDb(rows: Array<{ id: string; login: string; assignedAt: Date }>) {
  const calls = { from: [] as unknown[], joined: [] as unknown[], orderBy: 0, where: 0 };
  const database = {
    select: () => ({
      from: (table: unknown) => {
        calls.from.push(table);
        return {
          innerJoin: (joined: unknown) => {
            calls.joined.push(joined);
            return {
              where: () => {
                calls.where += 1;
                return {
                  orderBy: async (...columns: unknown[]) => {
                    calls.orderBy = columns.length;
                    return rows;
                  },
                };
              },
            };
          },
        };
      },
    }),
  };
  return { database: database as unknown as AppDatabase, calls };
}

describe('findGroupStudents', () => {
  it('reads group members joined with their accounts, filtered and ordered', async () => {
    const rows = [
      { id: 'u1', login: 's500001', assignedAt: new Date('2026-11-18T10:00:00.000Z') },
      { id: 'u2', login: 's500002', assignedAt: new Date('2026-11-18T10:00:00.000Z') },
    ];
    const { database, calls } = createFakeDb(rows);

    await expect(findGroupStudents(GROUP_ID, database)).resolves.toEqual(rows);
    expect(calls.from).toEqual([groupStudents]);
    expect(calls.joined).toEqual([users]);
    expect(calls.where).toBe(1);
    // Assignment time first, then login.
    expect(calls.orderBy).toBe(2);
  });

  it('returns an empty list for a group without students', async () => {
    const { database } = createFakeDb([]);

    await expect(findGroupStudents(GROUP_ID, database)).resolves.toEqual([]);
  });
});
