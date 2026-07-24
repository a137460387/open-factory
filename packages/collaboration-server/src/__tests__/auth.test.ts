/**
 * Tests for JWT authentication middleware (Socket.IO + Express).
 * Covers token extraction, verification, and middleware integration.
 */

import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import {
  verifyToken,
  extractBearerToken,
  createExpressAuthMiddleware,
  AuthError,
} from "../auth.js";
import type { CollaborationConfig } from "../config.js";

// ============================================================
// Test Config
// ============================================================

const testSecret = "test-secret-key-that-is-at-least-32-chars-long!!";

const testConfig: Pick<CollaborationConfig, "jwt"> = {
  jwt: {
    secret: testSecret,
    issuer: "open-factory",
    audience: "collaboration-server",
  },
};

function makeToken(
  overrides: Record<string, unknown> = {},
  signOptions: jwt.SignOptions = {}
): string {
  return jwt.sign(
    { sub: "user-1", name: "Test User", ...overrides },
    testSecret,
    { algorithm: "HS256", issuer: "open-factory", audience: "collaboration-server", expiresIn: "1h", ...signOptions }
  );
}

// ============================================================
// extractBearerToken
// ============================================================

describe("extractBearerToken", () => {
  it("returns token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null for undefined header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractBearerToken("")).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null for Bearer with empty token", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
  });

  it("returns null for Bearer with extra parts", () => {
    expect(extractBearerToken("Bearer abc def")).toBeNull();
  });

  it("returns null for just 'Bearer'", () => {
    expect(extractBearerToken("Bearer")).toBeNull();
  });
});

// ============================================================
// verifyToken
// ============================================================

describe("verifyToken", () => {
  it("returns payload for valid token", () => {
    const token = makeToken();
    const payload = verifyToken(token, testConfig);
    expect(payload.sub).toBe("user-1");
    expect(payload.name).toBe("Test User");
  });

  it("throws TOKEN_EXPIRED for expired token", () => {
    const token = makeToken({}, { expiresIn: -10 });
    expect(() => verifyToken(token, testConfig)).toThrow(AuthError);
    try {
      verifyToken(token, testConfig);
    } catch (err) {
      expect((err as AuthError).code).toBe("TOKEN_EXPIRED");
    }
  });

  it("throws TOKEN_INVALID for wrong secret", () => {
    const token = jwt.sign({ sub: "u1", name: "N" }, "wrong-secret", {
      algorithm: "HS256",
    });
    expect(() => verifyToken(token, testConfig)).toThrow(AuthError);
    try {
      verifyToken(token, testConfig);
    } catch (err) {
      expect((err as AuthError).code).toBe("TOKEN_INVALID");
    }
  });

  it("throws INVALID_PAYLOAD when sub is missing", () => {
    const token = jwt.sign({ name: "No User" }, testSecret, {
      algorithm: "HS256",
      issuer: "open-factory",
      audience: "collaboration-server",
    });
    expect(() => verifyToken(token, testConfig)).toThrow(AuthError);
    try {
      verifyToken(token, testConfig);
    } catch (err) {
      expect((err as AuthError).code).toBe("INVALID_PAYLOAD");
    }
  });

  it("throws INVALID_PAYLOAD when name is empty", () => {
    const token = jwt.sign({ sub: "u1", name: "" }, testSecret, {
      algorithm: "HS256",
      issuer: "open-factory",
      audience: "collaboration-server",
    });
    try {
      verifyToken(token, testConfig);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AuthError).code).toBe("INVALID_PAYLOAD");
    }
  });

  it("throws TOKEN_INVALID for garbage string", () => {
    expect(() => verifyToken("not-a-token", testConfig)).toThrow(AuthError);
  });

  it("throws TOKEN_INVALID for empty string", () => {
    try {
      verifyToken("", testConfig);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AuthError).code).toBe("TOKEN_INVALID");
      expect((err as AuthError).message).toContain("empty");
    }
  });

  it("throws TOKEN_INVALID for whitespace-only string", () => {
    try {
      verifyToken("   ", testConfig);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AuthError).code).toBe("TOKEN_INVALID");
    }
  });

  it("respects issuer validation", () => {
    const token = jwt.sign({ sub: "u1", name: "N" }, testSecret, {
      algorithm: "HS256",
      issuer: "wrong-issuer",
    });
    try {
      verifyToken(token, testConfig);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AuthError).code).toBe("TOKEN_INVALID");
    }
  });

  it("respects audience validation", () => {
    const token = jwt.sign({ sub: "u1", name: "N" }, testSecret, {
      algorithm: "HS256",
      audience: "wrong-audience",
    });
    try {
      verifyToken(token, testConfig);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AuthError).code).toBe("TOKEN_INVALID");
    }
  });
});

// ============================================================
// createExpressAuthMiddleware
// ============================================================

describe("createExpressAuthMiddleware", () => {
  const middleware = createExpressAuthMiddleware(testConfig);

  function mockReqRes(authHeader?: string) {
    const req = {
      headers: authHeader ? { authorization: authHeader } : {},
    } as Parameters<typeof middleware>[0];
    let statusCode = 0;
    let responseBody: unknown;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: unknown) => {
        responseBody = body;
        return res;
      },
    } as Parameters<typeof middleware>[1];
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    return {
      req,
      res,
      next: next as Parameters<typeof middleware>[2],
      getResult: () => ({ statusCode, responseBody, nextCalled, user: req.user }),
    };
  }

  it("calls next() with valid token and attaches user", () => {
    const token = makeToken();
    const { req, res, next, getResult } = mockReqRes(`Bearer ${token}`);
    middleware(req, res, next);
    const result = getResult();
    expect(result.nextCalled).toBe(true);
    expect(result.user).toEqual({ userId: "user-1", displayName: "Test User" });
  });

  it("returns 401 when Authorization header is missing", () => {
    const { req, res, next, getResult } = mockReqRes();
    middleware(req, res, next);
    const result = getResult();
    expect(result.statusCode).toBe(401);
    expect(result.nextCalled).toBe(false);
    expect((result.responseBody as { code: string }).code).toBe("NO_TOKEN");
  });

  it("returns 401 for expired token", () => {
    const token = makeToken({}, { expiresIn: -10 });
    const { req, res, next, getResult } = mockReqRes(`Bearer ${token}`);
    middleware(req, res, next);
    const result = getResult();
    expect(result.statusCode).toBe(401);
    expect(result.nextCalled).toBe(false);
    expect((result.responseBody as { code: string }).code).toBe("TOKEN_EXPIRED");
  });

  it("returns 401 for invalid token", () => {
    const { req, res, next, getResult } = mockReqRes("Bearer invalid.token.here");
    middleware(req, res, next);
    const result = getResult();
    expect(result.statusCode).toBe(401);
    expect(result.nextCalled).toBe(false);
  });

  it("returns 401 for non-Bearer scheme", () => {
    const { req, res, next, getResult } = mockReqRes("Basic abc123");
    middleware(req, res, next);
    const result = getResult();
    expect(result.statusCode).toBe(401);
    expect((result.responseBody as { code: string }).code).toBe("NO_TOKEN");
  });

  it("returns 401 for token with missing sub", () => {
    const token = jwt.sign({ name: "No Sub" }, testSecret, {
      algorithm: "HS256",
      issuer: "open-factory",
      audience: "collaboration-server",
    });
    const { req, res, next, getResult } = mockReqRes(`Bearer ${token}`);
    middleware(req, res, next);
    const result = getResult();
    expect(result.statusCode).toBe(401);
    expect((result.responseBody as { code: string }).code).toBe("INVALID_PAYLOAD");
  });
});
