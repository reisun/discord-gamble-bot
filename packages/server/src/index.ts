import path from 'path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import migrate from 'node-pg-migrate';

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function runMigrations(): Promise<void> {
  await migrate({
    databaseUrl: process.env.DATABASE_URL!,
    migrationsTable: 'pgmigrations',
    dir: path.join(__dirname, '..', 'migrations'),
    direction: 'up',
    verbose: false,
  });
}

async function main(): Promise<void> {
  console.log('[migrate] Running migrations...');
  await runMigrations();
  console.log('[migrate] Done.');

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

main().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
