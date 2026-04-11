import path from 'path';
import { fileURLToPath } from 'url';
import migrate from 'node-pg-migrate';
import { Pool } from 'pg';

const TEST_DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://gamble_user:reisun0101@127.0.0.1:5432/gamble_bot_test';

export async function setup() {
  // Check if tables already exist (e.g. schema was pre-loaded)
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events'`,
    );
    if (Number(rows[0].cnt) > 0) {
      return; // Schema already exists, skip migrations
    }
  } finally {
    await pool.end();
  }

  const migrationsDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'migrations',
  );

  await migrate({
    databaseUrl: TEST_DATABASE_URL,
    migrationsTable: 'pgmigrations',
    dir: migrationsDir,
    direction: 'up',
    verbose: false,
  });
}
