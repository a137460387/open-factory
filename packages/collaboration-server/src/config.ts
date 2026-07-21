/**
 * Configuration management with environment variable validation.
 * Uses Zod schemas to ensure all required values are present and valid.
 */

import { z } from "zod";

// ============================================================
// Schemas
// ============================================================

const redisSchema = z.object({
  /** Redis connection URL (redis://host:port) */
  url: z.string().url().default("redis://localhost:6379"),
  /** Redis key prefix for namespacing */
  keyPrefix: z.string().default("collab:"),
  /** Connection pool size */
  maxRetriesPerRequest: z.number().int().positive().default(3),
  /** Enable cluster mode for multi-node deployments */
  cluster: z.boolean().default(false),
  /** Cluster nodes (only used when cluster=true) */
  clusterNodes: z
    .array(z.object({ host: z.string(), port: z.number().int() }))
    .default([]),
});

const jwtSchema = z.object({
  /** Secret key for verifying JWT tokens */
  secret: z.string().min(32, "JWT secret must be at least 32 characters"),
  /** Expected token issuer */
  issuer: z.string().default("open-factory"),
  /** Expected token audience */
  audience: z.string().default("collaboration-server"),
});

const turnSchema = z.object({
  /** TURN server URLs */
  urls: z.array(z.string()).default([]),
  /** TURN username */
  username: z.string().default(""),
  /** TURN credential */
  credential: z.string().default(""),
});

const corsSchema = z.object({
  /** Allowed origins */
  origin: z.union([z.string(), z.array(z.string())]).default("*"),
  /** Allow credentials */
  credentials: z.boolean().default(true),
});

export const configSchema = z.object({
  /** Server listen port */
  port: z.coerce.number().int().positive().default(3001),
  /** Server bind host */
  host: z.string().default("0.0.0.0"),
  /** Node environment */
  nodeEnv: z
    .enum(["development", "production", "test"])
    .default("development"),
  /** Log level */
  logLevel: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),

  redis: redisSchema,
  jwt: jwtSchema,
  turn: turnSchema,
  cors: corsSchema,

  /** Maximum rooms the server can hold */
  maxRooms: z.coerce.number().int().positive().default(1000),
  /** Maximum users per room */
  maxUsersPerRoom: z.coerce.number().int().positive().default(10),
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: z.coerce.number().int().positive().default(30_000),
  /** Room idle timeout in ms (0 = never) */
  roomIdleTimeoutMs: z.coerce.number().int().nonnegative().default(3_600_000),
});

export type CollaborationConfig = z.infer<typeof configSchema>;

// ============================================================
// Loader
// ============================================================

/**
 * Build config from environment variables.
 * Validates with Zod and throws a formatted error on failure.
 */
export function loadConfig(): CollaborationConfig {
  const raw = {
    port: env("COLLAB_PORT", "3001"),
    host: env("COLLAB_HOST", "0.0.0.0"),
    nodeEnv: env("NODE_ENV", "development"),
    logLevel: env("LOG_LEVEL", "info"),

    redis: {
      url: env("REDIS_URL", "redis://localhost:6379"),
      keyPrefix: env("REDIS_KEY_PREFIX", "collab:"),
      maxRetriesPerRequest: Number(env("REDIS_MAX_RETRIES", "3")),
      cluster: env("REDIS_CLUSTER", "false") === "true",
      clusterNodes: parseClusterNodes(env("REDIS_CLUSTER_NODES", "")),
    },

    jwt: {
      secret: env("JWT_SECRET", ""),
      issuer: env("JWT_ISSUER", "open-factory"),
      audience: env("JWT_AUDIENCE", "collaboration-server"),
    },

    turn: {
      urls: env("TURN_URLS", "").split(",").filter(Boolean),
      username: env("TURN_USERNAME", ""),
      credential: env("TURN_CREDENTIAL", ""),
    },

    cors: {
      origin: env("CORS_ORIGIN", "*"),
      credentials: env("CORS_CREDENTIALS", "true") === "true",
    },

    maxRooms: env("MAX_ROOMS", "1000"),
    maxUsersPerRoom: env("MAX_USERS_PER_ROOM", "10"),
    heartbeatIntervalMs: env("HEARTBEAT_INTERVAL_MS", "30000"),
    roomIdleTimeoutMs: env("ROOM_IDLE_TIMEOUT_MS", "3600000"),
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${messages}`);
  }
  return result.data;
}

// ============================================================
// Helpers
// ============================================================

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function parseClusterNodes(
  raw: string
): Array<{ host: string; port: number }> {
  if (!raw) return [];
  return raw.split(",").map((entry) => {
    const [host, portStr] = entry.trim().split(":");
    return { host, port: Number(portStr ?? 6379) };
  });
}
