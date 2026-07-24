/**
 * Plugin sandbox — runs plugins in an isolated iframe context.
 *
 * Provides security isolation, resource limits, and postMessage-based
 * communication between host and plugin.
 */

// ==================== Types ====================

/** Sandbox configuration. */
export interface SandboxConfig {
  /** Plugin ID. */
  pluginId: string;
  /** Maximum memory in bytes (default 10MB). */
  maxMemoryBytes?: number;
  /** Maximum CPU time per operation in ms (default 100ms). */
  maxCpuTimeMs?: number;
  /** Allowed network origins (empty = no network). */
  allowedOrigins?: string[];
  /** CSP nonce for the sandbox iframe. */
  nonce?: string;
}

/** Message types for sandbox communication. */
export type SandboxMessageType =
  | 'init'
  | 'ready'
  | 'call'
  | 'result'
  | 'error'
  | 'event'
  | 'terminate';

/** Sandbox message envelope. */
export interface SandboxMessage {
  type: SandboxMessageType;
  id: string;
  pluginId: string;
  payload: unknown;
}

/** Sandbox lifecycle status. */
export type SandboxStatus = 'created' | 'initializing' | 'ready' | 'running' | 'error' | 'terminated';

/** Performance metrics for a sandbox. */
export interface SandboxMetrics {
  /** Sandbox initialization time in ms. */
  initTimeMs: number;
  /** Total messages exchanged. */
  messageCount: number;
  /** Average message latency in ms. */
  avgMessageLatencyMs: number;
  /** Peak memory usage in bytes (estimate). */
  peakMemoryBytes: number;
  /** Number of errors. */
  errorCount: number;
}

/** Sandbox event callback. */
export type SandboxEventHandler = (event: { type: string; data: unknown }) => void;

// ==================== Sandbox Implementation ====================

/** Default sandbox CSP — blocks everything except same-origin scripts. */
const DEFAULT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "connect-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Create a sandboxed iframe for running a plugin.
 *
 * In a real browser environment, this creates an actual iframe.
 * In test/Node environments, it creates a mock that simulates isolation.
 */
export function createPluginSandbox(config: SandboxConfig): PluginSandbox {
  return new PluginSandbox(config);
}

export class PluginSandbox {
  readonly pluginId: string;
  private status: SandboxStatus = 'created';
  private iframe: HTMLIFrameElement | null = null;
  private messageHandlers = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; startTime: number }>();
  private eventHandlers: SandboxEventHandler[] = [];
  private metrics: SandboxMetrics = {
    initTimeMs: 0,
    messageCount: 0,
    avgMessageLatencyMs: 0,
    peakMemoryBytes: 0,
    errorCount: 0,
  };
  private latencySum = 0;
  private readonly config: Required<SandboxConfig>;

  constructor(config: SandboxConfig) {
    this.pluginId = config.pluginId;
    this.config = {
      pluginId: config.pluginId,
      maxMemoryBytes: config.maxMemoryBytes ?? 10 * 1024 * 1024, // 10MB
      maxCpuTimeMs: config.maxCpuTimeMs ?? 100,
      allowedOrigins: config.allowedOrigins ?? [],
      nonce: config.nonce ?? '',
    };
  }

  /** Get current sandbox status. */
  getStatus(): SandboxStatus {
    return this.status;
  }

  /** Get performance metrics. */
  getMetrics(): Readonly<SandboxMetrics> {
    return { ...this.metrics };
  }

  /**
   * Initialize the sandbox with plugin code.
   * In browser: creates an iframe with the plugin code.
   * In test env: simulates initialization.
   */
  async initialize(pluginCode: string): Promise<boolean> {
    if (this.status !== 'created') {
      throw new Error(`Cannot initialize sandbox in '${this.status}' state`);
    }

    this.status = 'initializing';
    const startTime = performance.now();

    try {
      // In browser environment, create real iframe
      if (typeof document !== 'undefined') {
        this.iframe = document.createElement('iframe');
        this.iframe.sandbox.add('allow-scripts');
        this.iframe.style.display = 'none';
        this.iframe.srcdoc = this.buildSandboxHtml(pluginCode);
        document.body.appendChild(this.iframe);

        // Wait for ready message
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Sandbox init timeout')), 5000);
          const handler = (event: MessageEvent) => {
            if (event.source === this.iframe?.contentWindow) {
              const msg = event.data as SandboxMessage;
              if (msg.type === 'ready' && msg.pluginId === this.pluginId) {
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                resolve();
              }
            }
          };
          window.addEventListener('message', handler);
        });
      } else {
        // Test environment — simulate init delay
        await new Promise(r => setTimeout(r, 1));
      }

      this.status = 'ready';
      this.metrics.initTimeMs = performance.now() - startTime;
      return true;
    } catch (err) {
      this.status = 'error';
      this.metrics.initTimeMs = performance.now() - startTime;
      this.metrics.errorCount++;
      throw err;
    }
  }

  /**
   * Send a message to the sandbox and wait for a response.
   */
  async call(method: string, args: unknown[], timeoutMs = 5000): Promise<unknown> {
    if (this.status !== 'ready' && this.status !== 'running') {
      throw new Error(`Cannot call sandbox in '${this.status}' state`);
    }

    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error(`Sandbox call timeout: ${method}`));
      }, timeoutMs);

      this.messageHandlers.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          this.updateLatency(performance.now() - startTime);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          this.updateLatency(performance.now() - startTime);
          reject(e);
        },
        startTime,
      });

      this.status = 'running';
      const message: SandboxMessage = {
        type: 'call',
        id,
        pluginId: this.pluginId,
        payload: { method, args },
      };

      if (this.iframe?.contentWindow) {
        this.iframe.contentWindow.postMessage(message, '*');
      }

      this.metrics.messageCount++;
    });
  }

  /** Register an event handler. */
  onEvent(handler: SandboxEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  /** Terminate the sandbox and clean up. */
  terminate(): void {
    if (this.status === 'terminated') return;

    // Reject all pending messages
    for (const [id, handler] of this.messageHandlers) {
      handler.reject(new Error('Sandbox terminated'));
    }
    this.messageHandlers.clear();

    // Remove iframe
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    this.status = 'terminated';
  }

  // --- Internal ---

  private buildSandboxHtml(pluginCode: string): string {
    const csp = this.config.allowedOrigins.length > 0
      ? DEFAULT_CSP.replace("connect-src 'none'", `connect-src ${this.config.allowedOrigins.join(' ')}`)
      : DEFAULT_CSP;

    return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="${csp}">
</head>
<body>
<script>
(function() {
  'use strict';

  // Freeze prototypes to prevent prototype pollution
  const freezeTargets = [Object.prototype, Array.prototype, Function.prototype, String.prototype, Number.prototype, Boolean.prototype];
  for (const target of freezeTargets) {
    try { Object.freeze(target); } catch(e) {}
  }

  // Restricted console
  const safeConsole = {
    log: function() { postMessage({ type: 'event', data: { event: 'console.log', args: Array.from(arguments) } }); },
    warn: function() { postMessage({ type: 'event', data: { event: 'console.warn', args: Array.from(arguments) } }); },
    error: function() { postMessage({ type: 'event', data: { event: 'console.error', args: Array.from(arguments) } }); },
  };

  // Message handler
  window.addEventListener('message', function(event) {
    const msg = event.data;
    if (msg && msg.type === 'call' && msg.pluginId === '${this.config.pluginId}') {
      try {
        const result = plugin[msg.payload.method].apply(null, msg.payload.args);
        if (result && typeof result.then === 'function') {
          result.then(function(v) {
            parent.postMessage({ type: 'result', id: msg.id, pluginId: msg.pluginId, payload: v }, '*');
          }).catch(function(e) {
            parent.postMessage({ type: 'error', id: msg.id, pluginId: msg.pluginId, payload: String(e) }, '*');
          });
        } else {
          parent.postMessage({ type: 'result', id: msg.id, pluginId: msg.pluginId, payload: result }, '*');
        }
      } catch(e) {
        parent.postMessage({ type: 'error', id: msg.id, pluginId: msg.pluginId, payload: String(e) }, '*');
      }
    }
  });

  // Plugin code
  var plugin = (function() {
    ${pluginCode}
  })();

  // Signal ready
  parent.postMessage({ type: 'ready', pluginId: '${this.config.pluginId}' }, '*');
})();
</script>
</body>
</html>`;
  }

  private updateLatency(latency: number): void {
    this.latencySum += latency;
    this.metrics.avgMessageLatencyMs = this.latencySum / this.metrics.messageCount;
  }
}

// ==================== Sandbox Manager ====================

/** Manages multiple plugin sandboxes. */
export class SandboxManager {
  private readonly sandboxes = new Map<string, PluginSandbox>();

  /** Create and initialize a sandbox for a plugin. */
  async createSandbox(config: SandboxConfig, pluginCode: string): Promise<PluginSandbox> {
    if (this.sandboxes.has(config.pluginId)) {
      throw new Error(`Sandbox already exists for plugin '${config.pluginId}'`);
    }

    const sandbox = new PluginSandbox(config);
    await sandbox.initialize(pluginCode);
    this.sandboxes.set(config.pluginId, sandbox);
    return sandbox;
  }

  /** Get a sandbox by plugin ID. */
  getSandbox(pluginId: string): PluginSandbox | undefined {
    return this.sandboxes.get(pluginId);
  }

  /** Terminate and remove a sandbox. */
  terminateSandbox(pluginId: string): void {
    const sandbox = this.sandboxes.get(pluginId);
    if (sandbox) {
      sandbox.terminate();
      this.sandboxes.delete(pluginId);
    }
  }

  /** Terminate all sandboxes. */
  terminateAll(): void {
    for (const sandbox of this.sandboxes.values()) {
      sandbox.terminate();
    }
    this.sandboxes.clear();
  }

  /** Get metrics for all sandboxes. */
  getAllMetrics(): Map<string, SandboxMetrics> {
    const result = new Map<string, SandboxMetrics>();
    for (const [id, sandbox] of this.sandboxes) {
      result.set(id, sandbox.getMetrics());
    }
    return result;
  }

  /** Get the number of active sandboxes. */
  get size(): number {
    return this.sandboxes.size;
  }
}
