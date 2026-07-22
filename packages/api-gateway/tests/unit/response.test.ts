/**
 * Response utility tests
 */

import { describe, it, expect } from 'vitest';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  getHttpStatus,
} from '../../src/utils/response.js';

describe('Response Utilities', () => {
  describe('successResponse', () => {
    it('should create success response with data', () => {
      const data = { id: '1', name: 'Test' };
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
    });
  });

  describe('paginatedResponse', () => {
    it('should create paginated response', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const response = paginatedResponse(data, 10, 1, 2);

      expect(response.data).toEqual(data);
      expect(response.meta.total).toBe(10);
      expect(response.meta.page).toBe(1);
      expect(response.meta.limit).toBe(2);
      expect(response.meta.hasMore).toBe(true);
    });

    it('should indicate no more pages', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const response = paginatedResponse(data, 2, 1, 2);

      expect(response.meta.hasMore).toBe(false);
    });
  });

  describe('errorResponse', () => {
    it('should create error response', () => {
      const response = errorResponse('TEST_ERROR', 'Test error message');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TEST_ERROR');
      expect(response.error?.message).toBe('Test error message');
      expect(response.data).toBeUndefined();
    });

    it('should include details when provided', () => {
      const details = { field: 'email', reason: 'invalid' };
      const response = errorResponse('VALIDATION_ERROR', 'Validation failed', details);

      expect(response.error?.details).toEqual(details);
    });
  });

  describe('notFoundResponse', () => {
    it('should create not found response', () => {
      const response = notFoundResponse('Plugin', '123');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NOT_FOUND');
      expect(response.error?.message).toContain('Plugin');
      expect(response.error?.message).toContain('123');
    });
  });

  describe('validationErrorResponse', () => {
    it('should create validation error response', () => {
      const details = [{ field: 'email', message: 'Invalid email' }];
      const response = validationErrorResponse(details);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.error?.details).toEqual(details);
    });
  });

  describe('unauthorizedResponse', () => {
    it('should create unauthorized response with default message', () => {
      const response = unauthorizedResponse();

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('UNAUTHORIZED');
      expect(response.error?.message).toBe('Unauthorized');
    });

    it('should create unauthorized response with custom message', () => {
      const response = unauthorizedResponse('Token expired');

      expect(response.error?.message).toBe('Token expired');
    });
  });

  describe('forbiddenResponse', () => {
    it('should create forbidden response with default message', () => {
      const response = forbiddenResponse();

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('FORBIDDEN');
      expect(response.error?.message).toBe('Forbidden');
    });
  });

  describe('getHttpStatus', () => {
    it('should return correct status codes', () => {
      expect(getHttpStatus('NOT_FOUND')).toBe(404);
      expect(getHttpStatus('VALIDATION_ERROR')).toBe(400);
      expect(getHttpStatus('UNAUTHORIZED')).toBe(401);
      expect(getHttpStatus('FORBIDDEN')).toBe(403);
      expect(getHttpStatus('CONFLICT')).toBe(409);
      expect(getHttpStatus('RATE_LIMIT')).toBe(429);
      expect(getHttpStatus('INTERNAL_ERROR')).toBe(500);
    });

    it('should return 500 for unknown error codes', () => {
      expect(getHttpStatus('UNKNOWN_ERROR')).toBe(500);
    });
  });
});
