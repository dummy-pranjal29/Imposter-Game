import { createServer } from 'http';
import { createApp } from './app';
import { createSocketServer } from './socket/socketServer';
import { config } from './config';
import { logger } from './utils/logger';

async function bootstrap() {
  const app = createApp();
  const httpServer = createServer(app);

  await createSocketServer(httpServer);

  httpServer.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`, {
      env: config.env,
      redis: config.redis.enabled,
    });
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { error: err.message });
  process.exit(1);
});
