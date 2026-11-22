import process from 'node:process';
import { db, pool } from './client.js';
import { resolveSeedUsers, seedUsers } from './seed-users.js';

function formatError(error: unknown): string {
  if (error instanceof AggregateError) {
    const details = error.errors.map(formatError).join('; ');
    return error.message ? `${error.message}: ${details}` : details || error.name;
  }
  if (error instanceof Error) {
    const cause = error.cause ? ` (cause: ${formatError(error.cause)})` : '';
    return `${error.message || error.name}${cause}`;
  }
  return String(error);
}

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
  console.error('Database seed failed:', formatError(error));
  process.exitCode = 1;
});
