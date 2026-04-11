import path from 'path';
import migrate from 'node-pg-migrate';

import { logger } from './logger';
import { createApp } from './app';
import { startCleanupScheduler } from './cleanup';

const app = createApp();
const port = process.env.PORT ?? 3000;

async function runMigrations(): Promise<void> {
  await migrate({
    databaseUrl: process.env.DATABASE_URL!,
    migrationsTable: 'pgmigrations',
    dir: path.join(__dirname, 'migrations'),
    direction: 'up',
    verbose: false,
  });
}

async function main(): Promise<void> {
  logger.info('[migrate] Running migrations...');
  await runMigrations();
  logger.info('[migrate] Done.');

  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    startCleanupScheduler();
  });
}

main().catch((err) => {
  logger.error('[startup] Fatal error:', err);
  process.exit(1);
});
