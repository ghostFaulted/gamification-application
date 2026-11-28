import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { groups } from './groups.js';
import { users } from './users.js';

export const pointTransactions = pgTable(
  'point_transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    groupId: uuid()
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    studentId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    awardedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    // Fixed-point decimal (2 fractional digits) prevents binary floating-point rounding drift.
    amount: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull(),
    comment: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('point_transactions_group_student_idx').on(t.groupId, t.studentId),
    index('point_transactions_group_created_at_idx').on(t.groupId, t.createdAt),
    index('point_transactions_student_id_idx').on(t.studentId),
  ],
);

export type PointTransaction = typeof pointTransactions.$inferSelect;
export type NewPointTransaction = typeof pointTransactions.$inferInsert;
