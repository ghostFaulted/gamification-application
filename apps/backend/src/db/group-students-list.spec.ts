import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { findGroupStudents } from './groups.repository';
import { groupStudents, users } from './schema/index.js';
import type { AppDatabase } from './users.repository';

const GROUP_ID = '55555555-5555-4555-8555-555555555555';

// Same casing as the app's drizzle client (client.ts), so column names render as in production.
const dialect = new PgDialect({ casing: 'snake_case' });

function render(fragment: SQL | undefined) {
  if (!fragment) throw new Error('Expected an SQL fragment');
  const { sql, params } = dialect.sqlToQuery(fragment);
  return { sql, params };
}

function createFakeDb(rows: Array<{ id: string; login: string; assignedAt: Date }>) {
  const calls = {
    from: [] as unknown[],
    joined: [] as unknown[],
    where: [] as Array<SQL | undefined>,
    orderBy: [] as SQL[][],
  };
  const database = {
    select: () => ({
      from: (table: unknown) => {
        calls.from.push(table);
        return {
          innerJoin: (joined: unknown) => {
            calls.joined.push(joined);
            return {
              where: (condition: SQL | undefined) => {
                calls.where.push(condition);
                return {
                  orderBy: async (...columns: SQL[]) => {
                    calls.orderBy.push(columns);
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
  it('reads the members of the given group, oldest assignment first, then by login', async () => {
    const rows = [
      { id: 'u1', login: 's500001', assignedAt: new Date('2026-11-18T10:00:00.000Z') },
      { id: 'u2', login: 's500002', assignedAt: new Date('2026-11-18T10:00:00.000Z') },
    ];
    const { database, calls } = createFakeDb(rows);

    await expect(findGroupStudents(GROUP_ID, database)).resolves.toEqual(rows);

    expect(calls.from).toEqual([groupStudents]);
    expect(calls.joined).toEqual([users]);
    expect(calls.where).toHaveLength(1);
    expect(render(calls.where[0])).toEqual({
      sql: '"group_students"."group_id" = $1',
      params: [GROUP_ID],
    });
    expect(calls.orderBy).toHaveLength(1);
    expect(calls.orderBy[0].map((column) => render(column).sql)).toEqual([
      '"group_students"."assigned_at" asc',
      '"users"."login" asc',
    ]);
  });

  it('returns an empty list for a group without students', async () => {
    const { database } = createFakeDb([]);

    await expect(findGroupStudents(GROUP_ID, database)).resolves.toEqual([]);
  });
});
