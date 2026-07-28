/**
 * Permission manager factory and serialization functions
 */

import {type PermissionConfig, type PermissionState} from './types';
import {AdvancedPermissionManager} from './permission-manager';

/**
 * Create permission manager
 */
export function createPermissionManager(config?: Partial<PermissionConfig>): AdvancedPermissionManager {
  return new AdvancedPermissionManager(config);
}

/**
 * Restore permission manager from state
 */
export function restorePermissionManager(stateJson: string): AdvancedPermissionManager | null {
  try {
    const manager = new AdvancedPermissionManager();
    if (manager.importState(stateJson)) {
      return manager;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Serialize permission state
 */
export function serializePermissionState(state: PermissionState): string {
  return JSON.stringify({
    ...state,
    cache: undefined,
  });
}

/**
 * Parse permission state
 */
export function parsePermissionState(json: string): PermissionState | null {
  try {
    return JSON.parse(json) as PermissionState;
  } catch {
    return null;
  }
}
