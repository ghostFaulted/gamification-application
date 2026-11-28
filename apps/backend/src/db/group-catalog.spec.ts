import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { findGroupCatalog, type GroupCatalogRecord } from './groups.repository';
import { courses, groups, users } from './schema/index.js';
import type { AppDatabase } from './users.repository';

const dialect = new PgDialect({ casing: 'snake_case' });

function render(fragment: SQL | undefined) {
  if (!fragment) throw new Error('Expected an SQL fragment');
  return dialect.sqlToQuery(fragment).sql;
}

function createFakeDb(rows: GroupCatalogRecord[]) {
  const calls = {
    from: [] as unknown[],
    joined: [] as unknown[],
    orderBy: [] as SQL[][],
  };

  const database = {
    select: () => ({
      from: (table: unknown) => {
        calls.from.push(table);
        return {
          innerJoin: (firstJoin: unknown) => {
            calls.joined.push(firstJoin);
            return {
              innerJoin: (secondJoin: unknown) => {
                calls.joined.push(secondJoin);
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

describe('findGroupCatalog', () => {
  it('reads all groups with course and lecturer login ordered by course and group name', async () => {
    const rows: GroupCatalogRecord[] = [
      {
        id: 'g1',
        courseId: 'c1',
        courseName: 'Algorytmy',
        courseCode: 'ALG',
        name: 'Grupa 1',
        semester: '2026/27-Z',
        lecturerLogin: 'lecturer1',
      },
    ];
    const { database, calls } = createFakeDb(rows);

    await expect(findGroupCatalog(database)).resolves.toEqual(rows);

    expect(calls.from).toEqual([groups]);
    expect(calls.joined).toEqual([courses, users]);
    expect(calls.orderBy).toHaveLength(1);
    expect(calls.orderBy[0].map(render)).toEqual(['"courses"."name" asc', '"groups"."name" asc']);
  });
});
