/**
 * Unified API response utilities
 */

import type { ApiResponse, PaginatedResponse } from '../types.js';

// ============================================================
// Success Responses
// ============================================================

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      hasMore: page * limit < total,
    },
  };
}

// ============================================================
// Error Responses
// ============================================================

export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

export function notFoundResponse(resource: string, id: string): ApiResponse<never> {
  return errorResponse('NOT_FOUND', `${resource} with id ${id} not found`);
}

export function validationErrorResponse(details: unknown): ApiResponse<never> {
  return errorResponse('VALIDATION_ERROR', 'Request validation failed', details);
}

export function unauthorizedResponse(message = 'Unauthorized'): ApiResponse<never> {
  return errorResponse('UNAUTHORIZED', message);
}

export function forbiddenResponse(message = 'Forbidden'): ApiResponse<never> {
  return errorResponse('FORBIDDEN', message);
}

// ============================================================
// HTTP Status Helpers
// ============================================================

export function getHttpStatus(code: string): number {
  const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    CONFLICT: 409,
    INTERNAL_ERROR: 500,
    RATE_LIMIT: 429,
  };

  return statusMap[code] || 500;
}
