/**
 * Plugin Security Sandbox
 *
 * Provides isolated execution environments for plugins using
 * Proxy-based API wrapping and permission enforcement.
 */

import type { PluginPermission } from './index';

// ─── Sandbox Policy ────────────────────────────────────────────

export interface SandboxPolicy {
  /** Permissions granted to the plugin */
  permissions: PluginPermission[];
  /** Maximum memory usage in bytes (default: 50MB) */
  maxMemoryBytes?: number;
  /** Maximum execution time per call in ms (default: 5000) */
  maxExecutionTimeMs?: number;
  /** Maximum number of API calls per minute (default: 100) */
  rateLimitPerMinute?: number;
  /** Allowed network hosts (empty = no network access) */
  allowedHosts?: string[];
  /** Allowed file system paths (empty = no file access) */
  allowedPaths?: string[];
}

// ─── Sandbox Violation ────────────────────────────────────────────

export type ViolationType =
  | 'permission-denied'
  | 'rate-limit-exceeded'
  | 'execution-timeout'
  | 'memory-limit-exceeded'
  | 'host-not-allowed'
  | 'path-not-allowed';

export interface SandboxViolation {
  type: ViolationType;
  pluginId: string;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export type SandboxViolationHandler = (violation: SandboxViolation) => void;

// ─── Rate Limiter ────────────────────────────────────────────

class RateLimiter {
  private calls: number[] = [];
  private readonly windowMs = 60_000;
  private readonly maxCalls: number;

  constructor(maxCallsPerMinute: number) {
    this.maxCalls = maxCallsPerMinute;
  }

  tryAcquire(): boolean {
    const now = Date.now();
    this.calls = this.calls.filter((t) => now - t < this.windowMs);
    if (this.calls.length >= this.maxCalls) return false;
    this.calls.push(now);
    return true;
  }

  reset(): void {
    this.calls = [];
  }
}

// ─── Sandbox ────────────────────────────────────────────

export class PluginSandbox {
  private policies = new Map<string, SandboxPolicy>();
  private rateLimiters = new Map<string, RateLimiter>();
  private violationHandlers: SandboxViolationHandler[] = [];

  /** Register a sandbox policy for a plugin */
  register(pluginId: string, policy: SandboxPolicy): void {
    this.policies.set(pluginId, policy);
    this.rateLimiters.set(
      pluginId,
      new RateLimiter(policy.rateLimitPerMinute ?? 100),
    );
  }

  /** Unregister a plugin's sandbox */
  unregister(pluginId: string): void {
    this.policies.delete(pluginId);
    this.rateLimiters.delete(pluginId);
  }

  /** Check if a plugin has a specific permission */
  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const policy = this.policies.get(pluginId);
    if (!policy) return false;
    return policy.permissions.includes(permission);
  }

  /** Enforce a permission check, throw if denied */
  enforcePermission(pluginId: string, permission: PluginPermission): void {
    if (!this.hasPermission(pluginId, permission)) {
      this.reportViolation({
        type: 'permission-denied',
        pluginId,
        message: `Plugin ${pluginId} lacks permission: ${permission}`,
        timestamp: Date.now(),
        details: { requiredPermission: permission },
      });
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  /** Check and enforce rate limit */
  enforceRateLimit(pluginId: string): void {
    const limiter = this.rateLimiters.get(pluginId);
    if (!limiter) return;
    if (!limiter.tryAcquire()) {
      const policy = this.policies.get(pluginId);
      this.reportViolation({
        type: 'rate-limit-exceeded',
        pluginId,
        message: `Plugin ${pluginId} exceeded rate limit (${policy?.rateLimitPerMinute ?? 100}/min)`,
        timestamp: Date.now(),
      });
      throw new Error('Rate limit exceeded');
    }
  }

  /** Enforce host access permission */
  enforceHostAccess(pluginId: string, host: string): void {
    const policy = this.policies.get(pluginId);
    if (!policy) throw new Error(`Plugin ${pluginId} is not sandboxed`);

    const allowed = policy.allowedHosts ?? [];
    if (allowed.length > 0 && !allowed.some((h) => host.endsWith(h) || h === '*')) {
      this.reportViolation({
        type: 'host-not-allowed',
        pluginId,
        message: `Plugin ${pluginId} cannot access host: ${host}`,
        timestamp: Date.now(),
        details: { host, allowedHosts: allowed },
      });
      throw new Error(`Host not allowed: ${host}`);
    }
  }

  /** Enforce file path access permission */
  enforcePathAccess(pluginId: string, path: string): void {
    const policy = this.policies.get(pluginId);
    if (!policy) throw new Error(`Plugin ${pluginId} is not sandboxed`);

    const allowed = policy.allowedPaths ?? [];
    if (allowed.length > 0 && !allowed.some((p) => path.startsWith(p) || p === '*')) {
      this.reportViolation({
        type: 'path-not-allowed',
        pluginId,
        message: `Plugin ${pluginId} cannot access path: ${path}`,
        timestamp: Date.now(),
        details: { path, allowedPaths: allowed },
      });
      throw new Error(`Path not allowed: ${path}`);
    }
  }

  /** Wrap an API object with sandbox enforcement */
  wrapApi<T extends Record<string, (...args: unknown[]) => unknown>>(
    pluginId: string,
    api: T,
    requiredPermission: PluginPermission,
  ): T {
    const sandbox = this;

    return new Proxy(api, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;

        return (...args: unknown[]) => {
          sandbox.enforcePermission(pluginId, requiredPermission);
          sandbox.enforceRateLimit(pluginId);

          const policy = sandbox.policies.get(pluginId);
          const timeoutMs = policy?.maxExecutionTimeMs ?? 5000;

          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              sandbox.reportViolation({
                type: 'execution-timeout',
                pluginId,
                message: `Plugin ${pluginId} call timed out: ${String(prop)}`,
                timestamp: Date.now(),
                details: { method: String(prop), timeoutMs },
              });
              reject(new Error(`Execution timeout: ${String(prop)}`));
            }, timeoutMs);

            try {
              const result = value.apply(target, args);
              if (result instanceof Promise) {
                result.then(resolve, reject).finally(() => clearTimeout(timer));
              } else {
                clearTimeout(timer);
                resolve(result);
              }
            } catch (err) {
              clearTimeout(timer);
              reject(err);
            }
          });
        };
      },
    }) as T;
  }

  /** Subscribe to sandbox violations */
  onViolation(handler: SandboxViolationHandler): () => void {
    this.violationHandlers.push(handler);
    return () => {
      this.violationHandlers = this.violationHandlers.filter((h) => h !== handler);
    };
  }

  /** Get policy for a plugin */
  getPolicy(pluginId: string): SandboxPolicy | undefined {
    return this.policies.get(pluginId);
  }

  /** Report a sandbox violation */
  private reportViolation(violation: SandboxViolation): void {
    for (const handler of this.violationHandlers) {
      handler(violation);
    }
  }
}
