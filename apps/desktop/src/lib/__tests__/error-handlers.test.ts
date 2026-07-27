import { describe, it, expect, vi } from 'vitest';
import { logError, logErrorWithDefault, silentError } from '../error-handlers';

vi.mock('@open-factory/editor-core/utils', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('error-handlers', () => {
  describe('logError', () => {
    it('returns a function', () => {
      expect(typeof logError('test')).toBe('function');
    });

    it('returns undefined', () => {
      const handler = logError('ctx');
      expect(handler(new Error('test'))).toBeUndefined();
    });

    it('handles non-Error values', () => {
      const handler = logError('ctx');
      expect(handler('string error')).toBeUndefined();
      expect(handler(null)).toBeUndefined();
      expect(handler(undefined)).toBeUndefined();
    });
  });

  describe('logErrorWithDefault', () => {
    it('returns the default value', () => {
      const handler = logErrorWithDefault('ctx', 42);
      expect(handler(new Error('test'))).toBe(42);
    });

    it('works with different default types', () => {
      const handler = logErrorWithDefault('ctx', 'fallback');
      expect(handler(new Error('test'))).toBe('fallback');
    });

    it('works with null default', () => {
      const handler = logErrorWithDefault('ctx', null);
      expect(handler(new Error('test'))).toBeNull();
    });
  });

  describe('silentError', () => {
    it('returns a function', () => {
      expect(typeof silentError('test')).toBe('function');
    });

    it('returns undefined', () => {
      const handler = silentError('ctx');
      expect(handler(new Error('test'))).toBeUndefined();
    });
  });
});
