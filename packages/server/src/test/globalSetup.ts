import path from 'path';
import { fileURLToPath } from 'url';
import migrate from 'node-pg-migrate';

const TEST_DATABASE_URL = 'postgresql://gamble_user:reisun0101@127.0.0.1:5432/gamble_bot_test';

export async function setup() {
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
