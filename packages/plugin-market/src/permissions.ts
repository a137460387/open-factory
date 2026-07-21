// Permission Control System
// Declarative permission management with runtime validation and audit logging.

import type {
  PermissionCategory,
  PermissionDeclaration,
  PermissionGrant,
  PluginManifest,
  SandboxViolation,
} from './types.js';

/** Represents the runtime permission state for a loaded plugin. */
export interface PermissionState {
  readonly pluginId: string;
  readonly declared: PermissionDeclaration;
  readonly granted: readonly PermissionGrant[];
  readonly denied: readonly PermissionGrant[];
  readonly auditLog: readonly PermissionAuditEntry[];
}

export interface PermissionAuditEntry {
  readonly timestamp: string;
  readonly pluginId: string;
  readonly category: PermissionCategory;
  readonly target: string;
  readonly operation: string;
  readonly allowed: boolean;
  readonly reason?: string;
}

/** Permission request submitted by a plugin at runtime. */
export interface PermissionRequest {
  readonly category: PermissionCategory;
  readonly target: string;
  readonly operation: string;
}

/**
 * Manages plugin permissions: declaration parsing, runtime checks, and audit logging.
 */
export class PermissionManager {
  private readonly states = new Map<string, PermissionState>();
  private readonly globalDeniedTargets = new Set<string>();
  private readonly auditLog: PermissionAuditEntry[] = [];

  /** Initialize permissions for a plugin from its manifest. */
  initialize(pluginId: string, declaration: PermissionDeclaration): PermissionState {
    const granted = [...declaration.required];
    const state: PermissionState = {
      pluginId,
      declared: declaration,
      granted,
      denied: [],
      auditLog: [],
    };
    this.states.set(pluginId, state);
    return state;
  }

  /** Remove all permissions for a plugin. */
  revokeAll(pluginId: string): void {
    this.states.delete(pluginId);
  }

  /** Check if a plugin has a specific permission. */
  hasPermission(pluginId: string, request: PermissionRequest): boolean {
    const state = this.states.get(pluginId);
    if (!state) {
      this.log(pluginId, request, false, 'Plugin not initialized');
      return false;
    }

    // Check global deny list
    const globalKey = `${request.category}:${request.target}`;
    if (this.globalDeniedTargets.has(globalKey) || this.globalDeniedTargets.has(`${request.category}:*`)) {
      this.log(pluginId, request, false, 'Target is globally denied');
      return false;
    }

    // Check granted permissions
    const matching = state.granted.filter(
      (g) => g.category === request.category && matchesTarget(g.target, request.target),
    );

    if (matching.length === 0) {
      this.log(pluginId, request, false, 'No matching permission grant');
      return false;
    }

    // Check if the operation is allowed
    const opAllowed = matching.some(
      (g) => g.operations.includes('all') || g.operations.includes(request.operation),
    );

    this.log(pluginId, request, opAllowed, opAllowed ? undefined : 'Operation not in allowed list');
    return opAllowed;
  }

  /** Request an optional permission to be granted at runtime. */
  grantOptional(pluginId: string, grant: PermissionGrant): boolean {
    const state = this.states.get(pluginId);
    if (!state) return false;

    // Only grants declared as optional can be elevated
    const isOptional = state.declared.optional.some(
      (o) => o.category === grant.category && o.target === grant.target,
    );
    if (!isOptional) return false;

    // Grant it: create a new state with the additional grant
    const newGranted = [...state.granted, grant];
    const newState: PermissionState = {
      ...state,
      granted: newGranted,
    };
    this.states.set(pluginId, newState);
    return true;
  }

  /** Add a target to the global deny list. */
  denyGlobally(category: PermissionCategory, target: string): void {
    this.globalDeniedTargets.add(`${category}:${target}`);
  }

  /** Remove a target from the global deny list. */
  allowGlobally(category: PermissionCategory, target: string): void {
    this.globalDeniedTargets.delete(`${category}:${target}`);
  }

  /** Get the permission state for a plugin. */
  getState(pluginId: string): PermissionState | undefined {
    return this.states.get(pluginId);
  }

  /** Get the full audit log. */
  getAuditLog(): readonly PermissionAuditEntry[] {
    return [...this.auditLog];
  }

  /** Get the audit log for a specific plugin. */
  getPluginAuditLog(pluginId: string): readonly PermissionAuditEntry[] {
    return this.auditLog.filter((e) => e.pluginId === pluginId);
  }

  /** Clear the audit log. */
  clearAuditLog(): void {
    this.auditLog.length = 0;
  }

  /** Validate a manifest's permission declarations for well-formedness. */
  static validateDeclaration(declaration: PermissionDeclaration): string[] {
    const errors: string[] = [];
    const validCategories: PermissionCategory[] = ['filesystem', 'network', 'process', 'ui'];

    const validateGrant = (grant: PermissionGrant, prefix: string) => {
      if (!validCategories.includes(grant.category)) {
        errors.push(`${prefix}: invalid category '${grant.category}'`);
      }
      if (!grant.target || grant.target.length === 0) {
        errors.push(`${prefix}: target cannot be empty`);
      }
      if (!grant.operations || grant.operations.length === 0) {
        errors.push(`${prefix}: operations cannot be empty`);
      }
    };

    declaration.required.forEach((g, i) => validateGrant(g, `required[${i}]`));
    declaration.optional.forEach((g, i) => validateGrant(g, `optional[${i}]`));

    return errors;
  }

  private log(
    pluginId: string,
    request: PermissionRequest,
    allowed: boolean,
    reason?: string,
  ): void {
    const entry: PermissionAuditEntry = {
      timestamp: new Date().toISOString(),
      pluginId,
      category: request.category,
      target: request.target,
      operation: request.operation,
      allowed,
      reason,
    };
    this.auditLog.push(entry);

    const state = this.states.get(pluginId);
    if (state) {
      // Immutably update the state's audit log
      const updated: PermissionState = {
        ...state,
        auditLog: [...state.auditLog, entry],
      };
      this.states.set(pluginId, updated);
    }
  }
}

/** Check if a target value matches a pattern (supports '*' wildcard). */
function matchesTarget(pattern: string, target: string): boolean {
  if (pattern === '*') return true;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
  return regex.test(target);
}

/** Build a PermissionDeclaration from a flat list of grants, categorized. */
export function buildPermissionDeclaration(
  required: PermissionGrant[],
  optional: PermissionGrant[] = [],
): PermissionDeclaration {
  return { required: [...required], optional: [...optional] };
}

/** Check a batch of permission requests and return any violations. */
export function checkPermissions(
  manager: PermissionManager,
  pluginId: string,
  requests: PermissionRequest[],
): SandboxViolation[] {
  const violations: SandboxViolation[] = [];
  for (const req of requests) {
    if (!manager.hasPermission(pluginId, req)) {
      violations.push({
        type: req.category,
        message: `Permission denied: ${req.category}:${req.operation} on ${req.target}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
  return violations;
}
