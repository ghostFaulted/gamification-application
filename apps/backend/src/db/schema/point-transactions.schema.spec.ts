import { getTableConfig } from 'drizzle-orm/pg-core';
import { pointTransactions } from './point-transactions.js';

describe('point_transactions Drizzle schema', () => {
  it('defines columns, constraints and fixed-point numeric amount', () => {
    const config = getTableConfig(pointTransactions);

    expect(config.name).toBe('point_transactions');
    expect(config.columns.map((c) => c.name)).toEqual([
      'id',
      'groupId',
      'studentId',
      'awardedBy',
      'amount',
      'comment',
      'createdAt',
    ]);

    const byName = new Map(config.columns.map((c) => [c.name, c]));
    expect(byName.get('groupId')?.notNull).toBe(true);
    expect(byName.get('studentId')?.notNull).toBe(true);
    expect(byName.get('awardedBy')?.notNull).toBe(false);
    expect(byName.get('amount')?.notNull).toBe(true);
    expect(byName.get('amount')?.dataType).toBe('number');
    expect(byName.get('amount')?.getSQLType()).toMatch(/^numeric\(10,\s*2\)$/);
    expect(byName.get('comment')?.notNull).toBe(false);
    expect(byName.get('createdAt')?.notNull).toBe(true);
  });

  it('defines foreign keys to groups and users and query indexes', () => {
    const config = getTableConfig(pointTransactions);

    const fks = config.foreignKeys.map((fk) => {
      const ref = fk.reference();
      return {
        columns: ref.columns.map((c) => c.name),
        table: getTableConfig(ref.foreignTable).name,
        onDelete: fk.onDelete,
      };
    });

    expect(fks).toEqual([
      { columns: ['groupId'], table: 'groups', onDelete: 'cascade' },
      { columns: ['studentId'], table: 'users', onDelete: 'cascade' },
      { columns: ['awardedBy'], table: 'users', onDelete: 'set null' },
    ]);

    const indexes = config.indexes.map((i) => ({
      name: i.config.name,
      unique: i.config.unique,
    }));
    expect(indexes).toEqual([
      { name: 'point_transactions_group_student_idx', unique: false },
      { name: 'point_transactions_group_created_at_idx', unique: false },
      { name: 'point_transactions_student_id_idx', unique: false },
    ]);
  });
});
