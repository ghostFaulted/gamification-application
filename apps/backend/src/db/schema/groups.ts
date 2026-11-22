import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { courses } from './courses.js';
import { users } from './users.js';

export const groups = pgTable(
  'groups',
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    lecturerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: varchar({ length: 120 }).notNull(),
    semester: varchar({ length: 32 }),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('groups_course_id_idx').on(t.courseId),
    index('groups_lecturer_id_idx').on(t.lecturerId),
    uniqueIndex('groups_course_name_unique').on(t.courseId, sql`lower(${t.name})`),
  ],
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
