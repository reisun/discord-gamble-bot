import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { logger } from './logger';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import eventsRouter from './routes/events';
import gamesRouter from './routes/games';
import betsRouter from './routes/bets';
import usersRouter from './routes/users';
import guildsRouter from './routes/guilds';

export function createApp() {
  const app = express();

  // nginx 背後で X-Forwarded-Proto を信頼する（req.protocol が https を返すように）
  app.set('trust proxy', 1);

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      credentials: true,
    }),
  );
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/guilds', guildsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/events/:eventId/games', gamesRouter);
  app.use('/api/games/:gameId/bets', betsRouter);
  app.use('/api/users', usersRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/version', (_req, res) => {
    res.json({
      service: 'server',
      version: process.env.APP_VERSION ?? '1.1.0',
      commitHash: process.env.GIT_COMMIT ?? 'unknown',
    });
  });

  app.use(errorHandler);

  return app;
}
