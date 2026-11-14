import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './pool.js';

export async function runMigrations(): Promise<void> {
  const migrationPath = path.resolve(__dirname, '../../migrations/001_create_users_table.sql');
  const sql = await readFile(migrationPath, 'utf-8');
  await pool.query(sql);
}
