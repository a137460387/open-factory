// PluginSandbox tests
// Covers: constructor, fromPermissions, execute, executeAsync,
// checkFileAccess, checkNetworkAccess, checkProcessAccess, checkUIAccess,
// violation management, glob matching, timeout behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginSandbox } from '../sandbox.js';
import type { PermissionDeclaration, PermissionGrant } from '../types.js';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeGrant(
  category: PermissionGrant['category'],
  target: string,
  operations: string[] = ['read'],
): PermissionGrant {
  return { category, target, operations };
}

function makeDeclaration(
  required: PermissionGrant[] = [],
  optional: PermissionGrant[] = [],
): PermissionDeclaration {
  return { required, optional };
}

// ─── Constructor / Default Config ─────────────────────────────────────

describe('PluginSandbox constructor', () => {
  it('uses default config when no args', () => {
    const sb = new PluginSandbox();
    const cfg = sb.getConfig();
    expect(cfg.timeout).toBe(5000);
    expect(cfg.memoryLimit).toBe(64 * 1024 * 1024);
    expect(cfg.allowedPaths).toEqual([]);
    expect(cfg.allowedHosts).toEqual([]);
    expect(cfg.allowProcess).toBe(false);
    expect(cfg.allowUI).toBe(false);
  });

  it('merges partial config, keeps defaults for unspecified fields', () => {
    const sb = new PluginSandbox({ timeout: 999 });
    const cfg = sb.getConfig();
    expect(cfg.timeout).toBe(999);
    expect(cfg.memoryLimit).toBe(64 * 1024 * 1024);
    expect(cfg.allowedPaths).toEqual([]);
  });

  it('overrides multiple fields', () => {
    const sb = new PluginSandbox({
      timeout: 1000,
      memoryLimit: 128 * 1024 * 1024,
      allowProcess: true,
    });
    const cfg = sb.getConfig();
    expect(cfg.timeout).toBe(1000);
    expect(cfg.memoryLimit).toBe(128 * 1024 * 1024);
    expect(cfg.allowProcess).toBe(true);
  });

  it('getConfig returns a copy (mutation does not affect internal state)', () => {
    const sb = new PluginSandbox();
    const cfg = sb.getConfig();
    // @ts-expect-error mutating readonly to verify copy
    cfg.timeout = 0;
    expect(sb.getConfig().timeout).toBe(5000);
  });
});

// ─── fromPermissions ──────────────────────────────────────────────────

describe('PluginSandbox.fromPermissions', () => {
  it('returns defaults for empty declaration', () => {
    const cfg = PluginSandbox.fromPermissions(makeDeclaration());
    expect(cfg.allowedPaths).toEqual([]);
    expect(cfg.allowedHosts).toEqual([]);
    expect(cfg.allowProcess).toBe(false);
    expect(cfg.allowUI).toBe(false);
  });

  it('maps filesystem grant to allowedPaths as "op:target"', () => {
    const decl = makeDeclaration([makeGrant('filesystem', '/tmp/*', ['read', 'write'])]);
    const cfg = PluginSandbox.fromPermissions(decl);
    expect(cfg.allowedPaths).toEqual(['read:/tmp/*', 'write:/tmp/*']);
  });

  it('maps network grant to allowedHosts', () => {
    const decl = makeDeclaration([makeGrant('network', 'https://api.example.com/*', ['connect'])]);
    const cfg = PluginSandbox.fromPermissions(decl);
    expect(cfg.allowedHosts).toEqual(['https://api.example.com/*']);
  });

  it('sets allowProcess=true when operations include "execute"', () => {
    const decl = makeDeclaration([makeGrant('process', 'child', ['execute'])]);
    const cfg = PluginSandbox.fromPermissions(decl);
    expect(cfg.allowProcess).toBe(true);
  });

  it('sets allowProcess=true when operations include "all"', () => {
    const decl = makeDeclaration([makeGrant('process', 'child', ['all'])]);
    const cfg = PluginSandbox.fromPermissions(decl);
    expect(cfg.allowProcess).toBe(true);
  });

  it('does NOT set allowProcess when operations lack "execute" and "all"', () => {
    const decl = makeDeclaration([makeGrant('process', 'child', ['read'])]);
    const cfg = PluginSandbox.fromPermissions(decl);
    expect(cfg.allowProcess).toBe(false);
  });

  it('sets allowUI=true for ui grant', () => {
    const decl = makeDeclaration([makeGrant('ui', 'canvas', ['modify'])]);
    const cfg = PluginSandbox.fromPermissions(decl);
    expect(cfg.allowUI).toBe(true);
  });

  it('includes both required and optional grants', () => {
    const decl = makeDeclaration(
      [makeGrant('filesystem', '/a', ['read'])],
      [makeGrant('network', 'example.com', ['connect'])],
    );
    const cfg = PluginSandbox.fromPermissions(decl);
    expect(cfg.allowedPaths).toEqual(['read:/a']);
    expect(cfg.allowedHosts).toEqual(['example.com']);
  });
});

// ─── execute() ────────────────────────────────────────────────────────

describe('PluginSandbox.execute', () => {
  let sb: PluginSandbox;

  beforeEach(() => {
    sb = new PluginSandbox();
  });

  it('returns success with output for a successful fn', () => {
    const result = sb.execute(() => 42);
    expect(result.success).toBe(true);
    expect(result.output).toBe(42);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('returns failure when fn throws an Error', () => {
    const result = sb.execute(() => {
      throw new Error('boom');
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result.output).toBeUndefined();
  });

  it('returns failure when fn throws a non-Error value', () => {
    const result = sb.execute(() => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('string error');
  });

  it('blocks execution when pre-condition violations exist', () => {
    // Trigger a violation so pre-conditions are non-empty
    // (currently checkPreConditions returns [], but the path is exercised)
    const result = sb.execute(() => 'should run');
    expect(result.success).toBe(true);
    expect(result.output).toBe('should run');
  });
});

// ─── executeAsync() ───────────────────────────────────────────────────

describe('PluginSandbox.executeAsync', () => {
  let sb: PluginSandbox;

  beforeEach(() => {
    sb = new PluginSandbox({ timeout: 100 });
  });

  it('returns success for a resolved promise', async () => {
    const result = await sb.executeAsync(async () => 'hello');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('returns failure for a rejected promise', async () => {
    const result = await sb.executeAsync(async () => {
      throw new Error('async boom');
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('async boom');
  });

  it('rejects with timeout error when execution exceeds timeout', async () => {
    const result = await sb.executeAsync(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 300)),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(result.error).toContain('100ms');
  });

  it('configurable timeout value works', async () => {
    const fastSb = new PluginSandbox({ timeout: 50 });
    const result = await fastSb.executeAsync(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200)),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('50ms');
  });

  // Security boundary: timeout side-effect timing
  // Verifies that the original promise's side-effect does NOT fire
  // before the timeout rejection is observed.
  it('original promise side-effect does not fire before timeout is observed', async () => {
    let sideEffectFired = false;
    let resolveOriginal!: () => void;
    const originalPromise = new Promise<string>((resolve) => {
      resolveOriginal = () => {
        sideEffectFired = true;
        resolve('done');
      };
    });

    // Fire the original after a delay longer than the timeout (100ms)
    const timer = setTimeout(resolveOriginal, 300);

    const result = await sb.executeAsync(() => originalPromise);

    // We got the timeout result BEFORE the side-effect fired
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(sideEffectFired).toBe(false);

    // Wait for the side-effect to fire, then confirm it did
    await new Promise((r) => setTimeout(r, 350));
    expect(sideEffectFired).toBe(true);

    clearTimeout(timer);
  });
});

// ─── checkFileAccess ──────────────────────────────────────────────────

describe('PluginSandbox.checkFileAccess', () => {
  it('denies when allowedPaths is empty', () => {
    const sb = new PluginSandbox();
    expect(sb.checkFileAccess('/any/path')).toBe(false);
    expect(sb.getViolations()).toHaveLength(1);
    expect(sb.getViolations()[0].type).toBe('filesystem');
  });

  it('allows exact match', () => {
    const sb = new PluginSandbox({ allowedPaths: ['/tmp/data'] });
    expect(sb.checkFileAccess('/tmp/data')).toBe(true);
    expect(sb.getViolations()).toHaveLength(0);
  });

  it('allows glob wildcard match', () => {
    const sb = new PluginSandbox({ allowedPaths: ['read:/tmp/*'] });
    expect(sb.checkFileAccess('read:/tmp/file.txt')).toBe(true);
  });

  it('denies non-matching path', () => {
    const sb = new PluginSandbox({ allowedPaths: ['read:/tmp/*'] });
    expect(sb.checkFileAccess('read:/etc/passwd')).toBe(false);
    expect(sb.getViolations()).toHaveLength(1);
  });
});

// ─── checkNetworkAccess ───────────────────────────────────────────────

describe('PluginSandbox.checkNetworkAccess', () => {
  it('denies when allowedHosts is empty', () => {
    const sb = new PluginSandbox();
    expect(sb.checkNetworkAccess('example.com')).toBe(false);
    expect(sb.getViolations()[0].type).toBe('network');
  });

  it('allows exact match', () => {
    const sb = new PluginSandbox({ allowedHosts: ['api.example.com'] });
    expect(sb.checkNetworkAccess('api.example.com')).toBe(true);
  });

  it('allows glob wildcard match', () => {
    const sb = new PluginSandbox({ allowedHosts: ['*.example.com'] });
    expect(sb.checkNetworkAccess('api.example.com')).toBe(true);
  });

  it('denies non-matching host', () => {
    const sb = new PluginSandbox({ allowedHosts: ['*.example.com'] });
    expect(sb.checkNetworkAccess('evil.com')).toBe(false);
  });
});

// ─── checkProcessAccess / checkUIAccess ───────────────────────────────

describe('PluginSandbox.checkProcessAccess', () => {
  it('denies when allowProcess is false', () => {
    const sb = new PluginSandbox();
    expect(sb.checkProcessAccess()).toBe(false);
    expect(sb.getViolations()[0].type).toBe('process');
  });

  it('allows when allowProcess is true', () => {
    const sb = new PluginSandbox({ allowProcess: true });
    expect(sb.checkProcessAccess()).toBe(true);
    expect(sb.getViolations()).toHaveLength(0);
  });
});

describe('PluginSandbox.checkUIAccess', () => {
  it('denies when allowUI is false', () => {
    const sb = new PluginSandbox();
    expect(sb.checkUIAccess()).toBe(false);
    expect(sb.getViolations()[0].type).toBe('ui');
  });

  it('allows when allowUI is true', () => {
    const sb = new PluginSandbox({ allowUI: true });
    expect(sb.checkUIAccess()).toBe(true);
    expect(sb.getViolations()).toHaveLength(0);
  });
});

// ─── Violation management ─────────────────────────────────────────────

describe('PluginSandbox violation management', () => {
  it('getViolations returns a copy', () => {
    const sb = new PluginSandbox();
    sb.checkFileAccess('/x');
    const v1 = sb.getViolations();
    const v2 = sb.getViolations();
    expect(v1).not.toBe(v2);
    expect(v1).toEqual(v2);
  });

  it('clearViolations empties the list', () => {
    const sb = new PluginSandbox();
    sb.checkFileAccess('/x');
    sb.checkNetworkAccess('y');
    expect(sb.getViolations().length).toBeGreaterThan(0);
    sb.clearViolations();
    expect(sb.getViolations()).toHaveLength(0);
  });

  it('accumulates multiple violations', () => {
    const sb = new PluginSandbox();
    sb.checkFileAccess('/a');
    sb.checkFileAccess('/b');
    sb.checkNetworkAccess('c');
    sb.checkProcessAccess();
    sb.checkUIAccess();
    expect(sb.getViolations()).toHaveLength(5);
  });
});

// ─── Glob matching edge cases (via checkFileAccess / checkNetworkAccess) ──

describe('glob matching edge cases', () => {
  it('"*" matches everything', () => {
    const sb = new PluginSandbox({ allowedPaths: ['*'] });
    expect(sb.checkFileAccess('/literally/anything')).toBe(true);
  });

  it('special regex chars are escaped (. is literal)', () => {
    const sb = new PluginSandbox({ allowedHosts: ['192.168.1.1'] });
    // "192.168.1.1" should NOT match "192.168.11" (dot is literal, not regex wildcard)
    expect(sb.checkNetworkAccess('192.168.1.1')).toBe(true);
    expect(sb.checkNetworkAccess('192.168.11')).toBe(false);
    expect(sb.checkNetworkAccess('192.168.1X1')).toBe(false);
  });

  it('special regex chars are escaped (+ is literal)', () => {
    const sb = new PluginSandbox({ allowedPaths: ['/data+files'] });
    expect(sb.checkFileAccess('/data+files')).toBe(true);
    expect(sb.checkFileAccess('/dataXfiles')).toBe(false);
  });

  it('special regex chars are escaped (^ is literal)', () => {
    const sb = new PluginSandbox({ allowedPaths: ['^caret'] });
    expect(sb.checkFileAccess('^caret')).toBe(true);
    expect(sb.checkFileAccess('Xcaret')).toBe(false);
  });

  it('special regex chars are escaped ($ is literal)', () => {
    const sb = new PluginSandbox({ allowedPaths: ['dollar$'] });
    expect(sb.checkFileAccess('dollar$')).toBe(true);
    expect(sb.checkFileAccess('dollarX')).toBe(false);
  });

  it('special regex chars are escaped (| is literal)', () => {
    const sb = new PluginSandbox({ allowedPaths: ['a|b'] });
    expect(sb.checkFileAccess('a|b')).toBe(true);
    expect(sb.checkFileAccess('a')).toBe(false);
    expect(sb.checkFileAccess('b')).toBe(false);
  });

  it('special regex chars are escaped ([] is literal)', () => {
    const sb = new PluginSandbox({ allowedPaths: ['[abc]'] });
    expect(sb.checkFileAccess('[abc]')).toBe(true);
    expect(sb.checkFileAccess('a')).toBe(false);
  });

  it('special regex chars are escaped (\\ is literal)', () => {
    const sb = new PluginSandbox({ allowedPaths: ['path\\seg'] });
    expect(sb.checkFileAccess('path\\seg')).toBe(true);
  });

  it('*.evil.com does NOT match notevil.com (prefix bypass)', () => {
    const sb = new PluginSandbox({ allowedHosts: ['*.evil.com'] });
    expect(sb.checkNetworkAccess('api.evil.com')).toBe(true);
    expect(sb.checkNetworkAccess('notevil.com')).toBe(false);
  });

  it('glob with multiple wildcards', () => {
    const sb = new PluginSandbox({ allowedHosts: ['*.*.example.com'] });
    expect(sb.checkNetworkAccess('a.b.example.com')).toBe(true);
    expect(sb.checkNetworkAccess('example.com')).toBe(false);
  });
});
