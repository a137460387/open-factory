/**
 * Permission types and constants
 */

import {createId} from '../../model';

// ==================== Type Definitions ====================

/** Permission level */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin' | 'owner';

/** Permission scope */
export type PermissionScope = 'project' | 'folder' | 'file' | 'global';

/** Permission subject type */
export type PermissionSubjectType = 'user' | 'team' | 'role' | 'group';

/** Permission subject */
export interface PermissionSubject {
  type: PermissionSubjectType;
  id: string;
  name: string;
}

/** Permission target */
export interface PermissionTarget {
  type: PermissionScope;
  id: string;
  name: string;
  parentId?: string;
}

/** Permission rule */
export interface PermissionRule {
  id: string;
  subject: PermissionSubject;
  target: PermissionTarget;
  level: PermissionLevel;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  conditions?: PermissionConditions;
  metadata: PermissionRuleMetadata;
}

/** Permission conditions */
export interface PermissionConditions {
  ipWhitelist?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
  deviceRestrictions?: string[];
  requireMFA?: boolean;
  maxConcurrentSessions?: number;
}

/** Permission rule metadata */
export interface PermissionRuleMetadata {
  description?: string;
  tags?: string[];
  priority: number;
  isTemporary: boolean;
  autoRevoke: boolean;
  lastEvaluatedAt?: string;
  evaluationCount: number;
}

/** Permission inheritance config */
export interface PermissionInheritance {
  enabled: boolean;
  mode: 'strict' | 'lenient' | 'override';
  inheritFromParent: boolean;
  propagateToChildren: boolean;
  overrideParent: boolean;
}

/** Permission group */
export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  members: PermissionSubject[];
  rules: string[]; // rule ID list
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Temporary permission */
export interface TemporaryPermission {
  id: string;
  ruleId: string;
  subject: PermissionSubject;
  target: PermissionTarget;
  level: PermissionLevel;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
  reason: string;
  autoRevoke: boolean;
  revokedAt?: string;
  revokedBy?: string;
}

/** Permission audit log */
export interface PermissionAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: PermissionAuditAction;
  subject: PermissionSubject;
  target: PermissionTarget;
  previousLevel?: PermissionLevel;
  newLevel?: PermissionLevel;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** Permission audit action */
export type PermissionAuditAction =
  | 'permission.granted'
  | 'permission.revoked'
  | 'permission.modified'
  | 'permission.expired'
  | 'permission.evaluated'
  | 'permission.denied'
  | 'group.created'
  | 'group.updated'
  | 'group.deleted'
  | 'group.member_added'
  | 'group.member_removed'
  | 'inheritance.enabled'
  | 'inheritance.disabled'
  | 'inheritance.overridden';

/** Permission evaluation result */
export interface PermissionEvaluationResult {
  allowed: boolean;
  level: PermissionLevel;
  reason: string;
  matchedRules: PermissionRule[];
  effectivePermissions: PermissionLevel;
  warnings: string[];
}

/** Permission config */
export interface PermissionConfig {
  inheritance: PermissionInheritance;
  defaultLevel: PermissionLevel;
  requireExplicitDeny: boolean;
  auditEnabled: boolean;
  auditRetentionDays: number;
  maxRulesPerSubject: number;
  maxGroupsPerUser: number;
  enableTemporaryPermissions: boolean;
  maxTemporaryDurationHours: number;
}

/** Permission state */
export interface PermissionState {
  rules: PermissionRule[];
  groups: PermissionGroup[];
  temporaryPermissions: TemporaryPermission[];
  auditLog: PermissionAuditLog[];
  config: PermissionConfig;
  cache: Map<string, PermissionEvaluationResult>;
}

// ==================== Constants ====================

export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  inheritance: {
    enabled: true,
    mode: 'lenient',
    inheritFromParent: true,
    propagateToChildren: true,
    overrideParent: false,
  },
  defaultLevel: 'none',
  requireExplicitDeny: false,
  auditEnabled: true,
  auditRetentionDays: 90,
  maxRulesPerSubject: 100,
  maxGroupsPerUser: 10,
  enableTemporaryPermissions: true,
  maxTemporaryDurationHours: 24 * 7, // 7 days
};

/** Permission level weights */
export const PERMISSION_LEVEL_WEIGHTS: Record<PermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
  owner: 4,
};

/** Permission level list */
export const PERMISSION_LEVELS: PermissionLevel[] = ['none', 'read', 'write', 'admin', 'owner'];

// Re-export createId for internal use by sibling modules
export {createId};
