import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { roomRouter } from './controllers/roomController';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────
  app.use(helmet());

  // ── CORS: only allow our client origin ────────────────────────────
  app.use(
    cors({
      origin: config.allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    })
  );

  // ── Body parsing ──────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' })); // prevent large payload attacks

  // ── Global rate limiter ───────────────────────────────────────────
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    })
  );

  // ── Request logging (dev only) ────────────────────────────────────
  if (config.env !== 'production') {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  // ── Routes ────────────────────────────────────────────────────────
  app.use('/api/rooms', roomRouter);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: Date.now() });
  });

  // ── 404 handler ───────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Global error handler ──────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
