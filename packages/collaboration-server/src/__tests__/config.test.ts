/**
 * Tests for configuration validation.
 * Covers JWT_SECRET requirement, CORS origin deny-all default, and startup validation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, configSchema } from "../config.js";

// ============================================================
// Environment Helpers
// ============================================================

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

// ============================================================
// JWT_SECRET Tests
// ============================================================

describe("JWT_SECRET validation", () => {
  beforeEach(() => {
    setEnv({
      JWT_SECRET: undefined,
      NODE_ENV: "test",
    });
  });
  afterEach(resetEnv);

  it("throws when JWT_SECRET is missing", () => {
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_SECRET is empty string", () => {
    setEnv({ JWT_SECRET: "" });
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_SECRET is shorter than 32 characters", () => {
    setEnv({ JWT_SECRET: "short-key" });
    expect(() => loadConfig()).toThrow(/at least 32/);
  });

  it("throws when JWT_SECRET is whitespace-only", () => {
    setEnv({ JWT_SECRET: "                                   " });
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it("succeeds when JWT_SECRET is exactly 32 characters", () => {
    setEnv({ JWT_SECRET: "a".repeat(32) });
    const config = loadConfig();
    expect(config.jwt.secret).toHaveLength(32);
  });

  it("succeeds when JWT_SECRET is longer than 32 characters", () => {
    setEnv({ JWT_SECRET: "a-very-long-secret-key-that-is-definitely-long-enough" });
    const config = loadConfig();
    expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);
  });
});

// ============================================================
// CORS Origin Tests
// ============================================================

describe("CORS origin validation", () => {
  beforeEach(() => {
    setEnv({
      JWT_SECRET: "test-secret-key-that-is-at-least-32-characters-long",
      NODE_ENV: "test",
      CORS_ORIGIN: undefined,
    });
  });
  afterEach(resetEnv);

  it("defaults to empty array (deny all) when CORS_ORIGIN is not set", () => {
    const config = loadConfig();
    expect(config.cors.origin).toEqual([]);
  });

  it("defaults to empty array when CORS_ORIGIN is empty string", () => {
    setEnv({ CORS_ORIGIN: "" });
    const config = loadConfig();
    expect(config.cors.origin).toEqual([]);
  });

  it("parses single origin", () => {
    setEnv({ CORS_ORIGIN: "https://example.com" });
    const config = loadConfig();
    expect(config.cors.origin).toEqual(["https://example.com"]);
  });

  it("parses multiple comma-separated origins", () => {
    setEnv({
      CORS_ORIGIN: "https://a.com,https://b.com,https://c.com",
    });
    const config = loadConfig();
    expect(config.cors.origin).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
    ]);
  });

  it("trims whitespace from origins", () => {
    setEnv({ CORS_ORIGIN: " https://a.com , https://b.com " });
    const config = loadConfig();
    expect(config.cors.origin).toEqual(["https://a.com", "https://b.com"]);
  });

  it("filters out empty entries from comma-separated list", () => {
    setEnv({ CORS_ORIGIN: "https://a.com,,https://b.com," });
    const config = loadConfig();
    expect(config.cors.origin).toEqual(["https://a.com", "https://b.com"]);
  });
});

// ============================================================
// Schema-level validation
// ============================================================

describe("configSchema", () => {
  it("rejects JWT secret shorter than 32 chars", () => {
    const result = configSchema.safeParse({
      jwt: { secret: "short", issuer: "i", audience: "a" },
      redis: { url: "redis://localhost:6379" },
      cors: { origin: [], credentials: true },
      turn: { urls: [], username: "", credential: "" },
      port: 3001,
      host: "0.0.0.0",
      nodeEnv: "test",
      logLevel: "info",
      maxRooms: 100,
      maxUsersPerRoom: 10,
      heartbeatIntervalMs: 30000,
      roomIdleTimeoutMs: 3600000,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid config with empty CORS origins", () => {
    const result = configSchema.safeParse({
      jwt: { secret: "a".repeat(32), issuer: "i", audience: "a" },
      redis: { url: "redis://localhost:6379" },
      cors: { origin: [], credentials: true },
      turn: { urls: [], username: "", credential: "" },
      port: 3001,
      host: "0.0.0.0",
      nodeEnv: "test",
      logLevel: "info",
      maxRooms: 100,
      maxUsersPerRoom: 10,
      heartbeatIntervalMs: 30000,
      roomIdleTimeoutMs: 3600000,
    });
    expect(result.success).toBe(true);
  });
});
