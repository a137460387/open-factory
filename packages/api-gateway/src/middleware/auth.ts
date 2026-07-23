/**
 * JWT authentication middleware
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config.js';
import type { TokenPayload, UserRole } from '../types.js';

// ============================================================
// Auth Error
// ============================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ============================================================
// Token Verification
// ============================================================

export function verifyToken(token: string): TokenPayload {
  const config = getConfig();

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithms: ['HS256'],
    });

    return decoded as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError('Token has expired', 'TOKEN_EXPIRED');
    }
    if (err instanceof jwt.NotBeforeError) {
      throw new AuthError('Token not yet valid', 'TOKEN_NOT_ACTIVE');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthError(`Token verification failed: ${err.message}`, 'TOKEN_INVALID');
    }
    throw new AuthError('Authentication failed', 'AUTH_FAILED');
  }
}

export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const config = getConfig();

  return jwt.sign(payload, config.jwt.secret, {
    algorithm: 'HS256',
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.jwt.expiresIn as any,
  });
}

export function generateRefreshToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const config = getConfig();

  return jwt.sign(payload, config.jwt.secret, {
    algorithm: 'HS256',
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.jwt.refreshExpiresIn as any,
  });
}

// ============================================================
// Fastify Middleware
// ============================================================

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new AuthError('No authorization header', 'NO_AUTH_HEADER');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AuthError('Invalid authorization format', 'INVALID_AUTH_FORMAT');
  }

  try {
    const payload = verifyToken(token);
    request.user = payload;
  } catch (err) {
    if (err instanceof AuthError) {
      reply.status(err.statusCode).send({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }
    throw err;
  }
}

// ============================================================
// Optional Auth (doesn't fail if no token)
// ============================================================

export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return;
  }

  try {
    const payload = verifyToken(token);
    request.user = payload;
  } catch {
    // Ignore auth errors for optional auth
  }
}
