import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const revokedTokens = pgTable('revoked_tokens', {
  jti: uuid().primaryKey(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type RevokedToken = typeof revokedTokens.$inferSelect;
