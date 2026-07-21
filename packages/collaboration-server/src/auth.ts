/**
 * JWT authentication middleware for Socket.IO connections.
 * Verifies tokens, extracts user identity, and attaches it to the socket.
 */

import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { CollaborationConfig } from "./config.js";
import type { SocketData } from "./types.js";

// ============================================================
// Token Payload Schema
// ============================================================

const tokenPayloadSchema = z.object({
  sub: z.string().min(1, "Token missing subject (userId)"),
  name: z.string().min(1, "Token missing name"),
  iat: z.number().optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

// ============================================================
// Errors
// ============================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ============================================================
// Verification
// ============================================================

/**
 * Verify a JWT token string and return the decoded payload.
 * Throws AuthError on any failure.
 */
export function verifyToken(
  token: string,
  config: Pick<CollaborationConfig, "jwt">
): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithms: ["HS256", "HS384", "HS512"],
    });

    const parsed = tokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      throw new AuthError(`Invalid token payload: ${msg}`, "INVALID_PAYLOAD");
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError("Token has expired", "TOKEN_EXPIRED");
    }
    if (err instanceof jwt.NotBeforeError) {
      throw new AuthError("Token not yet valid", "TOKEN_NOT_ACTIVE");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthError(`Token verification failed: ${err.message}`, "TOKEN_INVALID");
    }
    throw new AuthError("Authentication failed", "AUTH_FAILED");
  }
}

// ============================================================
// Socket.IO Middleware
// ============================================================

/**
 * Create a Socket.IO middleware function that authenticates connections.
 *
 * Expects the token in:
 *  - `auth.token` (preferred)
 *  - `handshake.auth.token`
 *
 * On success, attaches `userId` and `displayName` to `socket.data`.
 */
export function createAuthMiddleware(config: Pick<CollaborationConfig, "jwt">) {
  return (socket: Socket, next: (err?: Error) => void) => {
    try {
      // Extract token from multiple possible locations
      const token =
        (socket.handshake.auth as Record<string, string>)?.token ??
        (socket.handshake.query as Record<string, string>)?.token;

      if (!token) {
        return next(
          new AuthError("No authentication token provided", "NO_TOKEN")
        );
      }

      const payload = verifyToken(token, config);

      // Attach user data to socket
      const data = socket.data as SocketData;
      data.userId = payload.sub;
      data.displayName = payload.name;

      next();
    } catch (err) {
      if (err instanceof AuthError) {
        return next(err);
      }
      return next(
        new AuthError("Unexpected authentication error", "AUTH_FAILED")
      );
    }
  };
}

/**
 * Generate a JWT token for testing purposes.
 * Not intended for production use — real tokens should come from
 * the main auth service.
 */
export function generateTestToken(
  userId: string,
  displayName: string,
  config: Pick<CollaborationConfig, "jwt">
): string {
  return jwt.sign(
    { sub: userId, name: displayName },
    config.jwt.secret,
    {
      algorithm: "HS256",
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: "1h",
    }
  );
}
