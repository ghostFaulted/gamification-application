import process from 'node:process';
import { db, pool } from './client.js';
import { resolveSeedUsers, seedUsers } from './seed-users.js';

async function main(): Promise<void> {
  try {
    const entries = resolveSeedUsers(process.env);
    const result = await seedUsers(entries, db);
    console.log(
      `Seed completed: created ${result.createdCount}, skipped ${result.skippedCount} existing user(s).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Database seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
