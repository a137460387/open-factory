/**
 * API Gateway configuration
 */

import { z } from 'zod';

// ============================================================
// Config Schema
// ============================================================

const configSchema = z.object({
  // Server
  port: z.number().default(3001),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // JWT
  jwt: z.object({
    secret: z.string().min(32),
    issuer: z.string().default('open-factory'),
    audience: z.string().default('open-factory-api'),
    expiresIn: z.string().default('1h'),
    refreshExpiresIn: z.string().default('7d'),
  }),

  // Database
  database: z.object({
    url: z.string(),
    poolSize: z.number().default(10),
    ssl: z.boolean().default(false),
  }),

  // Rate Limiting
  rateLimit: z.object({
    max: z.number().default(100),
    window: z.string().default('1 minute'),
  }),

  // CORS
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string())]).default('*'),
    credentials: z.boolean().default(true),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: z.boolean().default(false),
  }),
});

export type Config = z.infer<typeof configSchema>;

// ============================================================
// Load Config
// ============================================================

export function loadConfig(): Config {
  const raw = {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',

    jwt: {
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars',
      issuer: process.env.JWT_ISSUER || 'open-factory',
      audience: process.env.JWT_AUDIENCE || 'open-factory-api',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/open_factory',
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
      ssl: process.env.DB_SSL === 'true',
    },

    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      window: process.env.RATE_LIMIT_WINDOW || '1 minute',
    },

    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: process.env.CORS_CREDENTIALS !== 'false',
    },

    logging: {
      level: process.env.LOG_LEVEL || 'info',
      pretty: process.env.LOG_PRETTY === 'true',
    },
  };

  return configSchema.parse(raw);
}

// ============================================================
// Singleton Config
// ============================================================

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
