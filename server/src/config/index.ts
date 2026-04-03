import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  allowedOrigins: process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, /\.vercel\.app$/]
    : ['http://localhost:5173', 'http://localhost:4173'],

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    enabled: process.env.USE_REDIS === 'true',
  },

  game: {
    maxPlayersPerRoom: parseInt(process.env.MAX_PLAYERS_PER_ROOM ?? '5', 10),
    wordRevealDurationMs: parseInt(process.env.WORD_REVEAL_DURATION_MS ?? '15000', 10),   // 15s to read word
    descriptionDurationMs: parseInt(process.env.DESCRIPTION_DURATION_MS ?? '120000', 10), // 2 min to write
    discussionDurationMs: parseInt(process.env.DISCUSSION_DURATION_MS ?? '180000', 10),   // 3 min discussion
    votingDurationMs: parseInt(process.env.VOTING_DURATION_MS ?? '60000', 10),            // 1 min to vote
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  },

  logLevel: process.env.LOG_LEVEL ?? 'info',
} as const;
