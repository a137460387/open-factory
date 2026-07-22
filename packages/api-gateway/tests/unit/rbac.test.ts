/**
 * RBAC middleware tests
 */

import { describe, it, expect } from 'vitest';
import { hasPermission } from '../../src/middleware/rbac.js';

describe('RBAC Middleware', () => {
  describe('hasPermission', () => {
    it('should allow admin full access', () => {
      expect(hasPermission(['admin'], 'plugins', 'read')).toBe(true);
      expect(hasPermission(['admin'], 'plugins', 'write')).toBe(true);
      expect(hasPermission(['admin'], 'plugins', 'delete')).toBe(true);
      expect(hasPermission(['admin'], 'creators', 'read')).toBe(true);
      expect(hasPermission(['admin'], 'anything', 'delete')).toBe(true);
    });

    it('should allow creator to read and write plugins', () => {
      expect(hasPermission(['creator'], 'plugins', 'read')).toBe(true);
      expect(hasPermission(['creator'], 'plugins', 'write')).toBe(true);
      expect(hasPermission(['creator'], 'plugins', 'delete')).toBe(false);
    });

    it('should allow creator to read and write creators', () => {
      expect(hasPermission(['creator'], 'creators', 'read')).toBe(true);
      expect(hasPermission(['creator'], 'creators', 'write')).toBe(true);
      expect(hasPermission(['creator'], 'creators', 'delete')).toBe(false);
    });

    it('should allow creator to read and write projects', () => {
      expect(hasPermission(['creator'], 'projects', 'read')).toBe(true);
      expect(hasPermission(['creator'], 'projects', 'write')).toBe(true);
      expect(hasPermission(['creator'], 'projects', 'delete')).toBe(false);
    });

    it('should allow user to read only', () => {
      expect(hasPermission(['user'], 'plugins', 'read')).toBe(true);
      expect(hasPermission(['user'], 'plugins', 'write')).toBe(false);
      expect(hasPermission(['user'], 'plugins', 'delete')).toBe(false);
      expect(hasPermission(['user'], 'creators', 'read')).toBe(true);
      expect(hasPermission(['user'], 'creators', 'write')).toBe(false);
      expect(hasPermission(['user'], 'projects', 'read')).toBe(true);
      expect(hasPermission(['user'], 'projects', 'write')).toBe(false);
    });

    it('should deny access for unknown resource', () => {
      expect(hasPermission(['user'], 'unknown', 'read')).toBe(false);
      expect(hasPermission(['creator'], 'unknown', 'read')).toBe(false);
    });

    it('should handle multiple roles', () => {
      expect(hasPermission(['user', 'creator'], 'plugins', 'write')).toBe(true);
      expect(hasPermission(['user', 'creator'], 'creators', 'write')).toBe(true);
    });

    it('should deny access for empty roles', () => {
      expect(hasPermission([], 'plugins', 'read')).toBe(false);
    });
  });
});
