import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { groups } from './groups.js';
import { users } from './users.js';

export const groupStudents = pgTable(
  'group_students',
  {
    groupId: uuid()
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    studentId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'group_students_pk', columns: [t.groupId, t.studentId] }),
    index('group_students_student_id_idx').on(t.studentId),
  ],
);

export type GroupStudent = typeof groupStudents.$inferSelect;
export type NewGroupStudent = typeof groupStudents.$inferInsert;
