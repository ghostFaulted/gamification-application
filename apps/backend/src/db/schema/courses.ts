import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const courses = pgTable(
  'courses',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 160 }).notNull(),
    code: varchar({ length: 64 }),
    description: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('courses_code_unique')
      .on(sql`lower(${t.code})`)
      .where(sql`${t.code} is not null`),
  ],
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
