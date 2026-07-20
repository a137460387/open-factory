import { describe, expect, it, beforeEach } from 'vitest';
import { PluginSandbox, type SandboxViolation } from '../src/sandbox';

describe('PluginSandbox', () => {
  let sandbox: PluginSandbox;

  beforeEach(() => {
    sandbox = new PluginSandbox();
  });

  it('registers and retrieves a policy', () => {
    sandbox.register('test-plugin', {
      permissions: ['read-project', 'menu-register'],
    });
    const policy = sandbox.getPolicy('test-plugin');
    expect(policy).toBeDefined();
    expect(policy!.permissions).toContain('read-project');
  });

  it('checks permissions correctly', () => {
    sandbox.register('test-plugin', {
      permissions: ['read-project'],
    });
    expect(sandbox.hasPermission('test-plugin', 'read-project')).toBe(true);
    expect(sandbox.hasPermission('test-plugin', 'write-project')).toBe(false);
  });

  it('throws on permission enforcement failure', () => {
    sandbox.register('test-plugin', {
      permissions: ['read-project'],
    });
    expect(() => sandbox.enforcePermission('test-plugin', 'write-project')).toThrow('Permission denied');
  });

  it('enforces rate limiting', () => {
    sandbox.register('test-plugin', {
      permissions: ['read-project'],
      rateLimitPerMinute: 2,
    });
    sandbox.enforceRateLimit('test-plugin');
    sandbox.enforceRateLimit('test-plugin');
    expect(() => sandbox.enforceRateLimit('test-plugin')).toThrow('Rate limit exceeded');
  });

  it('enforces host access restrictions', () => {
    sandbox.register('test-plugin', {
      permissions: ['read-project'],
      allowedHosts: ['api.example.com'],
    });
    expect(() => sandbox.enforceHostAccess('test-plugin', 'api.example.com')).not.toThrow();
    expect(() => sandbox.enforceHostAccess('test-plugin', 'evil.com')).toThrow('Host not allowed');
  });

  it('enforces path access restrictions', () => {
    sandbox.register('test-plugin', {
      permissions: ['read-project'],
      allowedPaths: ['/data/plugins/test-plugin/'],
    });
    expect(() => sandbox.enforcePathAccess('test-plugin', '/data/plugins/test-plugin/file.txt')).not.toThrow();
    expect(() => sandbox.enforcePathAccess('test-plugin', '/etc/passwd')).toThrow('Path not allowed');
  });

  it('reports violations', () => {
    const violations: SandboxViolation[] = [];
    sandbox.onViolation((v) => violations.push(v));

    sandbox.register('test-plugin', {
      permissions: ['read-project'],
    });
    try {
      sandbox.enforcePermission('test-plugin', 'write-project');
    } catch {
      // Expected
    }

    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('permission-denied');
    expect(violations[0].pluginId).toBe('test-plugin');
  });

  it('wraps API with sandbox enforcement', () => {
    sandbox.register('test-plugin', {
      permissions: ['read-project'],
    });

    const api = {
      getData: () => 'data',
      writeData: () => 'written',
    };

    const wrapped = sandbox.wrapApi('test-plugin', api, 'read-project');
    expect(wrapped.getData).toBeDefined();
    expect(typeof wrapped.getData).toBe('function');
  });

  it('unregisters a plugin', () => {
    sandbox.register('test-plugin', { permissions: ['read-project'] });
    sandbox.unregister('test-plugin');
    expect(sandbox.getPolicy('test-plugin')).toBeUndefined();
  });
});
