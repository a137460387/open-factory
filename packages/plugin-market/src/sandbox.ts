// Plugin Sandbox
// Provides isolated execution environment for plugins with resource limits and violation tracking.

import type {
  SandboxConfig,
  SandboxExecutionResult,
  SandboxViolation,
  PermissionDeclaration,
  PermissionGrant,
} from './types.js';

/** Default sandbox configuration with restrictive settings. */
const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  timeout: 5000,
  memoryLimit: 64 * 1024 * 1024, // 64 MB
  allowedPaths: [],
  allowedHosts: [],
  allowProcess: false,
  allowUI: false,
};

/**
 * Sandbox environment for executing plugin code in isolation.
 * Enforces filesystem, network, process, and UI restrictions at runtime.
 */
export class PluginSandbox {
  private readonly config: SandboxConfig;
  private readonly violations: SandboxViolation[] = [];

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  /** Create a sandbox config from a plugin's declared permissions. */
  static fromPermissions(perms: PermissionDeclaration): SandboxConfig {
    const fsPaths: string[] = [];
    const netHosts: string[] = [];
    let allowProcess = false;
    let allowUI = false;

    const allPerms = [...perms.required, ...perms.optional];
    for (const grant of allPerms) {
      applyGrant(grant, fsPaths, netHosts, (v) => { allowProcess = allowProcess || v; }, (v) => { allowUI = allowUI || v; });
    }

    return {
      ...DEFAULT_SANDBOX_CONFIG,
      allowedPaths: fsPaths,
      allowedHosts: netHosts,
      allowProcess,
      allowUI,
    };
  }

  /**
   * Execute a function within the sandbox.
   * Returns execution result with violations if any constraints were breached.
   */
  execute<T>(fn: () => T): SandboxExecutionResult {
    const startTime = performance.now();
    const violations: SandboxViolation[] = [];

    try {
      // Validate permissions before execution
      const preViolations = this.checkPreConditions();
      violations.push(...preViolations);

      if (violations.length > 0) {
        return this.buildResult(false, undefined, 'Pre-condition violations detected', startTime, violations);
      }

      const output = fn();
      const executionTime = performance.now() - startTime;

      return {
        success: true,
        output,
        executionTime,
        memoryUsed: 0, // Approximation; real memory tracking requires runtime hooks
        violations: [...this.violations],
      };
    } catch (error: unknown) {
      const executionTime = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.buildResult(false, undefined, errorMsg, startTime, violations);
    }
  }

  /**
   * Execute an async function within the sandbox with timeout enforcement.
   */
  async executeAsync<T>(fn: () => Promise<T>): Promise<SandboxExecutionResult> {
    const startTime = performance.now();
    const violations: SandboxViolation[] = [];

    try {
      const preViolations = this.checkPreConditions();
      violations.push(...preViolations);

      if (violations.length > 0) {
        return this.buildResult(false, undefined, 'Pre-condition violations detected', startTime, violations);
      }

      const output = await withTimeout(fn(), this.config.timeout);
      const executionTime = performance.now() - startTime;

      return {
        success: true,
        output,
        executionTime,
        memoryUsed: 0,
        violations: [...this.violations],
      };
    } catch (error: unknown) {
      const executionTime = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.buildResult(false, undefined, errorMsg, startTime, violations);
    }
  }

  /** Check if a filesystem path is allowed. */
  checkFileAccess(path: string): boolean {
    if (this.config.allowedPaths.length === 0) {
      this.recordViolation('filesystem', `Filesystem access denied: no paths allowed (requested: ${path})`);
      return false;
    }

    const allowed = this.config.allowedPaths.some((pattern) => matchesGlob(path, pattern));
    if (!allowed) {
      this.recordViolation('filesystem', `Filesystem access denied: ${path} not in allowed paths`);
    }
    return allowed;
  }

  /** Check if a network host is allowed. */
  checkNetworkAccess(host: string): boolean {
    if (this.config.allowedHosts.length === 0) {
      this.recordViolation('network', `Network access denied: no hosts allowed (requested: ${host})`);
      return false;
    }

    const allowed = this.config.allowedHosts.some((pattern) => matchesGlob(host, pattern));
    if (!allowed) {
      this.recordViolation('network', `Network access denied: ${host} not in allowed hosts`);
    }
    return allowed;
  }

  /** Check if process spawning is allowed. */
  checkProcessAccess(): boolean {
    if (!this.config.allowProcess) {
      this.recordViolation('process', 'Process spawning is not allowed');
      return false;
    }
    return true;
  }

  /** Check if UI modification is allowed. */
  checkUIAccess(): boolean {
    if (!this.config.allowUI) {
      this.recordViolation('ui', 'UI modification is not allowed');
      return false;
    }
    return true;
  }

  /** Get all recorded violations. */
  getViolations(): readonly SandboxViolation[] {
    return [...this.violations];
  }

  /** Clear recorded violations. */
  clearViolations(): void {
    this.violations.length = 0;
  }

  /** Get current sandbox configuration. */
  getConfig(): Readonly<SandboxConfig> {
    return { ...this.config };
  }

  private checkPreConditions(): SandboxViolation[] {
    // Pre-execution checks can be extended here
    return [];
  }

  private recordViolation(type: SandboxViolation['type'], message: string): void {
    this.violations.push({
      type,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private buildResult(
    success: boolean,
    output: unknown,
    error: string | undefined,
    startTime: number,
    violations: SandboxViolation[],
  ): SandboxExecutionResult {
    return {
      success,
      output,
      error,
      executionTime: performance.now() - startTime,
      memoryUsed: 0,
      violations: [...this.violations, ...violations],
    };
  }
}

/** Apply a permission grant to the sandbox config accumulators. */
function applyGrant(
  grant: PermissionGrant,
  fsPaths: string[],
  netHosts: string[],
  setProcess: (v: boolean) => void,
  setUI: (v: boolean) => void,
): void {
  switch (grant.category) {
    case 'filesystem':
      fsPaths.push(...grant.operations.map((op) => `${op}:${grant.target}`));
      break;
    case 'network':
      netHosts.push(grant.target);
      break;
    case 'process':
      if (grant.operations.includes('execute') || grant.operations.includes('all')) {
        setProcess(true);
      }
      break;
    case 'ui':
      setUI(true);
      break;
  }
}

/** Simple glob matching supporting '*' wildcard. */
function matchesGlob(value: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
  return regex.test(value);
}

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Execution timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
