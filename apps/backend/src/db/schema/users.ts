import { ROLES } from '@gamification/shared';
import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ROLES);

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    login: varchar({ length: 64 }).notNull(),
    role: userRole().notNull().default('student'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_login_unique').on(sql`lower(${t.login})`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
