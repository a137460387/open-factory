/**
 * Error handling utilities
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthError } from '../middleware/auth.js';
import { errorResponse, getHttpStatus } from './response.js';

// ============================================================
// Custom Error Classes
// ============================================================

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

// ============================================================
// Global Error Handler
// ============================================================

export async function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log error
  request.log.error(error);

  // Handle known errors
  if (error instanceof AppError) {
    reply.status(error.statusCode).send(
      errorResponse(error.code, error.message, error.details)
    );
    return;
  }

  if (error instanceof AuthError) {
    reply.status(error.statusCode).send(
      errorResponse(error.code, error.message)
    );
    return;
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    reply.status(400).send(
      errorResponse('VALIDATION_ERROR', 'Request validation failed', error.message)
    );
    return;
  }

  // Handle unknown errors
  reply.status(500).send(
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred')
  );
}
