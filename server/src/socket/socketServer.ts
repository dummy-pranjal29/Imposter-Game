import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../config';
import { logger } from '../utils/logger';
import { gameEngine } from '../engine/GameEngine';
import { registerSocketHandlers } from './socketHandlers';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types';

export async function createSocketServer(httpServer: HttpServer) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Prefer WebSocket; fall back to long-polling for restrictive networks
    transports: ['websocket', 'polling'],
    // Ping every 20s, disconnect after 2 missed pings (40s)
    pingInterval: 20_000,
    pingTimeout: 40_000,
    // Max buffer size per event to prevent memory abuse
    maxHttpBufferSize: 1e5, // 100 KB
  });

  // ── Optional: Redis adapter for horizontal scaling ──────────────────────
  // These packages are only installed when USE_REDIS=true (not in devDependencies).
  // The dynamic imports are intentionally untyped — suppress TS module errors.
  if (config.redis.enabled) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { createAdapter } = await import('@socket.io/redis-adapter' as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { createClient }  = await import('redis' as any);

    const pubClient = createClient({ url: config.redis.url });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter attached');
  }

  // Initialise game engine with the io instance
  gameEngine.init(io);

  // Register per-socket event handlers
  io.on('connection', (socket) => {
    logger.debug('Socket connected', { socketId: socket.id });
    registerSocketHandlers(io, socket);
  });

  logger.info('Socket.IO server ready');
  return io;
}
