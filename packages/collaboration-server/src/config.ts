/**
 * Configuration management with environment variable validation.
 * Uses Zod schemas to ensure all required values are present and valid.
 *
 * SECURITY: JWT_SECRET is mandatory and must be >= 32 characters.
 * CORS origin defaults to deny-all when not explicitly configured.
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
  /** Secret key for verifying JWT tokens — MUST come from environment */
  secret: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .refine((s) => s.trim().length >= 32, {
      message: "JWT_SECRET must not be whitespace-only",
    }),
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
  /**
   * Allowed origins for CORS.
   * SECURITY: Must be explicitly configured per environment.
   * Empty array = deny all cross-origin requests.
   */
  origin: z
    .union([z.string(), z.array(z.string())])
    .default([]),
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
      secret: requiredEnv("JWT_SECRET"),
      issuer: env("JWT_ISSUER", "open-factory"),
      audience: env("JWT_AUDIENCE", "collaboration-server"),
    },

    turn: {
      urls: env("TURN_URLS", "").split(",").filter(Boolean),
      username: env("TURN_USERNAME", ""),
      credential: env("TURN_CREDENTIAL", ""),
    },

    cors: {
      origin: parseCorsOrigins(env("CORS_ORIGIN", "")),
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

/** Require an env var — throws immediately if missing or empty. */
function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Set it before starting the server.`
    );
  }
  return value;
}

/** Parse CORS origins: empty string → empty array (deny all). */
function parseCorsOrigins(raw: string): string[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
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

/**
 * Validate critical configuration at startup.
 * Calls process.exit(1) with a clear message if config is invalid.
 * Use this at server entry points to fail fast.
 */
export function validateOrExit(): CollaborationConfig {
  try {
    return loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n[FATAL] Server configuration error:\n${message}\n`);
    process.exit(1);
  }
}
