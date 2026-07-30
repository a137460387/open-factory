// PermissionManager tests
// Covers: initialize, revokeAll, hasPermission, grantOptional,
// denyGlobally/allowGlobally, audit log, validateDeclaration,
// matchesTarget edge cases, checkPermissions helper.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PermissionManager,
  buildPermissionDeclaration,
  checkPermissions,
} from '../permissions.js';
import type { PermissionGrant, PermissionDeclaration } from '../types.js';

// ─── Helpers ──────────────────────────────────────────────────────────

function grant(
  category: PermissionGrant['category'],
  target: string,
  operations: string[] = ['read'],
): PermissionGrant {
  return { category, target, operations };
}

const PLUGIN_ID = 'test-plugin';

// ─── PermissionManager.initialize ─────────────────────────────────────

describe('PermissionManager.initialize', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  it('sets state with required permissions in granted', () => {
    const req = [grant('filesystem', '/tmp/*', ['read'])];
    pm.initialize(PLUGIN_ID, { required: req, optional: [] });
    const state = pm.getState(PLUGIN_ID)!;
    expect(state.pluginId).toBe(PLUGIN_ID);
    expect(state.granted).toEqual(req);
    expect(state.denied).toEqual([]);
    expect(state.auditLog).toEqual([]);
  });

  it('overwrites previous state on duplicate initialize', () => {
    pm.initialize(PLUGIN_ID, { required: [grant('filesystem', '/a', ['read'])], optional: [] });
    pm.initialize(PLUGIN_ID, { required: [grant('network', 'b.com', ['connect'])], optional: [] });
    const state = pm.getState(PLUGIN_ID)!;
    expect(state.granted).toEqual([grant('network', 'b.com', ['connect'])]);
  });
});

// ─── PermissionManager.revokeAll ──────────────────────────────────────

describe('PermissionManager.revokeAll', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
    pm.initialize(PLUGIN_ID, { required: [grant('filesystem', '/a', ['read'])], optional: [] });
  });

  it('removes state for the plugin', () => {
    pm.revokeAll(PLUGIN_ID);
    expect(pm.getState(PLUGIN_ID)).toBeUndefined();
  });

  it('hasPermission returns false after revoke', () => {
    pm.revokeAll(PLUGIN_ID);
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/a', operation: 'read' })).toBe(false);
  });
});

// ─── PermissionManager.hasPermission ──────────────────────────────────

describe('PermissionManager.hasPermission', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
    pm.initialize(PLUGIN_ID, {
      required: [
        grant('filesystem', '/data/*', ['read', 'write']),
        grant('network', 'api.example.com', ['connect']),
        grant('process', 'child', ['execute']),
      ],
      optional: [],
    });
  });

  it('denies unregistered plugin', () => {
    expect(pm.hasPermission('unknown', { category: 'filesystem', target: '/data/x', operation: 'read' })).toBe(false);
    expect(pm.getPluginAuditLog('unknown')).toHaveLength(1);
  });

  it('allows exact target + matching operation', () => {
    expect(pm.hasPermission(PLUGIN_ID, { category: 'network', target: 'api.example.com', operation: 'connect' })).toBe(true);
  });

  it('allows wildcard target match', () => {
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/data/file.txt', operation: 'read' })).toBe(true);
  });

  it('denies target match but wrong operation', () => {
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/data/x', operation: 'delete' })).toBe(false);
  });

  it('allows any operation when "all" is in operations', () => {
    pm.initialize('all-plugin', {
      required: [grant('filesystem', '/pub', ['all'])],
      optional: [],
    });
    expect(pm.hasPermission('all-plugin', { category: 'filesystem', target: '/pub', operation: 'anything' })).toBe(true);
  });

  it('denies when no grant matches category', () => {
    expect(pm.hasPermission(PLUGIN_ID, { category: 'ui', target: 'canvas', operation: 'modify' })).toBe(false);
  });

  it('denies when no grant matches target', () => {
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/etc/passwd', operation: 'read' })).toBe(false);
  });
});

// ─── Global deny / allow ──────────────────────────────────────────────

describe('PermissionManager global deny/allow', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
    pm.initialize(PLUGIN_ID, {
      required: [grant('filesystem', '/data/*', ['read'])],
      optional: [],
    });
  });

  it('denyGlobally blocks matching category:target', () => {
    pm.denyGlobally('filesystem', '/data/secret');
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/data/secret', operation: 'read' })).toBe(false);
  });

  it('denyGlobally with wildcard blocks entire category', () => {
    pm.denyGlobally('filesystem', '*');
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/data/anything', operation: 'read' })).toBe(false);
  });

  it('allowGlobally restores after deny', () => {
    pm.denyGlobally('filesystem', '/data/secret');
    pm.allowGlobally('filesystem', '/data/secret');
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/data/secret', operation: 'read' })).toBe(true);
  });

  // Security boundary: category:* wildcard deny
  // Ensures that denying "category:*" blocks ALL targets in that category.
  it('category:* wildcard deny blocks all targets in that category', () => {
    pm.initialize('p2', { required: [grant('network', 'a.com', ['connect']), grant('network', 'b.com', ['connect'])], optional: [] });
    pm.denyGlobally('network', '*');
    expect(pm.hasPermission('p2', { category: 'network', target: 'a.com', operation: 'connect' })).toBe(false);
    expect(pm.hasPermission('p2', { category: 'network', target: 'b.com', operation: 'connect' })).toBe(false);
    expect(pm.hasPermission('p2', { category: 'network', target: 'anything.com', operation: 'connect' })).toBe(false);
  });
});

// ─── grantOptional ────────────────────────────────────────────────────

describe('PermissionManager.grantOptional', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
    pm.initialize(PLUGIN_ID, {
      required: [grant('filesystem', '/ro', ['read'])],
      optional: [grant('filesystem', '/rw', ['read', 'write'])],
    });
  });

  it('returns false for unregistered plugin', () => {
    expect(pm.grantOptional('unknown', grant('filesystem', '/rw', ['write']))).toBe(false);
  });

  // Security boundary: prevent privilege escalation
  // A grant NOT in declared.optional must be rejected.
  it('returns false when grant is not in declared optional (prevents escalation)', () => {
    expect(pm.grantOptional(PLUGIN_ID, grant('filesystem', '/secret', ['write']))).toBe(false);
    // Verify it was NOT granted
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/secret', operation: 'write' })).toBe(false);
  });

  it('grants declared optional permission and hasPermission passes', () => {
    expect(pm.grantOptional(PLUGIN_ID, grant('filesystem', '/rw', ['write']))).toBe(true);
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/rw', operation: 'write' })).toBe(true);
  });

  it('does not affect existing granted permissions', () => {
    pm.grantOptional(PLUGIN_ID, grant('filesystem', '/rw', ['write']));
    expect(pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/ro', operation: 'read' })).toBe(true);
  });
});

// ─── Audit Log ────────────────────────────────────────────────────────

describe('PermissionManager audit log', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
    pm.initialize(PLUGIN_ID, {
      required: [grant('filesystem', '/a', ['read'])],
      optional: [],
    });
  });

  it('records one entry per hasPermission call', () => {
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/a', operation: 'read' });
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/b', operation: 'read' });
    expect(pm.getAuditLog()).toHaveLength(2);
  });

  it('getPluginAuditLog filters by pluginId', () => {
    pm.initialize('other', { required: [grant('network', 'x', ['connect'])], optional: [] });
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/a', operation: 'read' });
    pm.hasPermission('other', { category: 'network', target: 'x', operation: 'connect' });
    expect(pm.getPluginAuditLog(PLUGIN_ID)).toHaveLength(1);
    expect(pm.getPluginAuditLog('other')).toHaveLength(1);
  });

  it('clearAuditLog empties the log', () => {
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/a', operation: 'read' });
    expect(pm.getAuditLog()).toHaveLength(1);
    pm.clearAuditLog();
    expect(pm.getAuditLog()).toHaveLength(0);
  });

  it('allowed entry has no reason, denied entry has reason', () => {
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/a', operation: 'read' });
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/nope', operation: 'read' });
    const log = pm.getAuditLog();
    expect(log[0].allowed).toBe(true);
    expect(log[0].reason).toBeUndefined();
    expect(log[1].allowed).toBe(false);
    expect(log[1].reason).toBeDefined();
  });

  it('denied for unregistered plugin logs "Plugin not initialized"', () => {
    pm.hasPermission('ghost', { category: 'ui', target: 'x', operation: 'y' });
    const log = pm.getAuditLog();
    expect(log[0].reason).toBe('Plugin not initialized');
  });

  it('denied by global deny logs "Target is globally denied"', () => {
    pm.denyGlobally('filesystem', '/a');
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/a', operation: 'read' });
    const log = pm.getAuditLog();
    expect(log[0].reason).toBe('Target is globally denied');
  });

  it('per-plugin state auditLog is also updated', () => {
    pm.hasPermission(PLUGIN_ID, { category: 'filesystem', target: '/a', operation: 'read' });
    const state = pm.getState(PLUGIN_ID)!;
    expect(state.auditLog).toHaveLength(1);
  });
});

// ─── validateDeclaration (static) ─────────────────────────────────────

describe('PermissionManager.validateDeclaration', () => {
  it('returns no errors for valid declaration', () => {
    const decl: PermissionDeclaration = {
      required: [grant('filesystem', '/tmp/*', ['read'])],
      optional: [grant('network', 'example.com', ['connect'])],
    };
    expect(PermissionManager.validateDeclaration(decl)).toEqual([]);
  });

  it('reports invalid category', () => {
    const decl = { required: [{ category: 'invalid' as any, target: 'x', operations: ['read'] }], optional: [] };
    const errors = PermissionManager.validateDeclaration(decl);
    expect(errors.some((e) => e.includes("invalid category"))).toBe(true);
  });

  it('reports empty target', () => {
    const decl = { required: [grant('filesystem', '', ['read'])], optional: [] };
    const errors = PermissionManager.validateDeclaration(decl);
    expect(errors.some((e) => e.includes('target cannot be empty'))).toBe(true);
  });

  it('reports empty operations', () => {
    const decl = { required: [grant('filesystem', '/a', [])], optional: [] };
    const errors = PermissionManager.validateDeclaration(decl);
    expect(errors.some((e) => e.includes('operations cannot be empty'))).toBe(true);
  });

  it('validates both required and optional', () => {
    const decl = {
      required: [grant('filesystem', '', ['read'])],
      optional: [grant('network', '', [])],
    };
    const errors = PermissionManager.validateDeclaration(decl);
    expect(errors.some((e) => e.includes('required[0]'))).toBe(true);
    expect(errors.some((e) => e.includes('optional[0]'))).toBe(true);
  });
});

// ─── matchesTarget edge cases (via hasPermission) ─────────────────────

describe('matchesTarget edge cases', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  it('"*" target matches any value', () => {
    pm.initialize('p', { required: [grant('filesystem', '*', ['read'])], optional: [] });
    expect(pm.hasPermission('p', { category: 'filesystem', target: '/anything', operation: 'read' })).toBe(true);
    expect(pm.hasPermission('p', { category: 'filesystem', target: '', operation: 'read' })).toBe(true);
  });

  it('special regex chars in target are escaped (. is literal)', () => {
    pm.initialize('p', { required: [grant('network', '192.168.1.1', ['connect'])], optional: [] });
    expect(pm.hasPermission('p', { category: 'network', target: '192.168.1.1', operation: 'connect' })).toBe(true);
    expect(pm.hasPermission('p', { category: 'network', target: '192.168.11', operation: 'connect' })).toBe(false);
    expect(pm.hasPermission('p', { category: 'network', target: '192.168.1X1', operation: 'connect' })).toBe(false);
  });

  it('*.evil.com does NOT match notevil.com (prefix bypass prevention)', () => {
    pm.initialize('p', { required: [grant('network', '*.evil.com', ['connect'])], optional: [] });
    expect(pm.hasPermission('p', { category: 'network', target: 'api.evil.com', operation: 'connect' })).toBe(true);
    expect(pm.hasPermission('p', { category: 'network', target: 'notevil.com', operation: 'connect' })).toBe(false);
  });

  it('glob with path separators (* is greedy, crosses /)', () => {
    pm.initialize('p', { required: [grant('filesystem', '/data/*/config', ['read'])], optional: [] });
    expect(pm.hasPermission('p', { category: 'filesystem', target: '/data/app/config', operation: 'read' })).toBe(true);
    // * converts to .* which matches across / separators — this is expected behavior
    expect(pm.hasPermission('p', { category: 'filesystem', target: '/data/app/sub/config', operation: 'read' })).toBe(true);
  });
});

// ─── checkPermissions helper ──────────────────────────────────────────

describe('checkPermissions', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
    pm.initialize(PLUGIN_ID, {
      required: [
        grant('filesystem', '/a', ['read']),
        grant('network', 'b.com', ['connect']),
      ],
      optional: [],
    });
  });

  it('returns empty array when all requests pass', () => {
    const violations = checkPermissions(pm, PLUGIN_ID, [
      { category: 'filesystem', target: '/a', operation: 'read' },
      { category: 'network', target: 'b.com', operation: 'connect' },
    ]);
    expect(violations).toEqual([]);
  });

  it('returns violations for denied requests', () => {
    const violations = checkPermissions(pm, PLUGIN_ID, [
      { category: 'filesystem', target: '/a', operation: 'read' },
      { category: 'filesystem', target: '/secret', operation: 'read' },
      { category: 'ui', target: 'canvas', operation: 'modify' },
    ]);
    expect(violations).toHaveLength(2);
    expect(violations[0].type).toBe('filesystem');
    expect(violations[1].type).toBe('ui');
  });

  it('returns all violations when all denied', () => {
    const violations = checkPermissions(pm, PLUGIN_ID, [
      { category: 'process', target: 'x', operation: 'execute' },
      { category: 'ui', target: 'y', operation: 'z' },
    ]);
    expect(violations).toHaveLength(2);
  });

  it('violation message format includes category, operation, target', () => {
    const violations = checkPermissions(pm, PLUGIN_ID, [
      { category: 'process', target: 'shell', operation: 'execute' },
    ]);
    expect(violations[0].message).toContain('process');
    expect(violations[0].message).toContain('execute');
    expect(violations[0].message).toContain('shell');
  });
});

// ─── buildPermissionDeclaration helper ────────────────────────────────

describe('buildPermissionDeclaration', () => {
  it('builds declaration from required grants', () => {
    const r = [grant('filesystem', '/a', ['read'])];
    const decl = buildPermissionDeclaration(r);
    expect(decl.required).toEqual(r);
    expect(decl.optional).toEqual([]);
  });

  it('builds declaration with required and optional', () => {
    const r = [grant('filesystem', '/a', ['read'])];
    const o = [grant('network', 'b.com', ['connect'])];
    const decl = buildPermissionDeclaration(r, o);
    expect(decl.required).toEqual(r);
    expect(decl.optional).toEqual(o);
  });

  it('returns copies, not references', () => {
    const r = [grant('filesystem', '/a', ['read'])];
    const decl = buildPermissionDeclaration(r);
    r.push(grant('network', 'x', ['connect']));
    expect(decl.required).toHaveLength(1);
  });
});
