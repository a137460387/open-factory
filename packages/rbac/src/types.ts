import { z } from 'zod';

// Resource types
export type ResourceType = 'project' | 'folder' | 'file' | 'plugin' | 'system';

// Action types
export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'export'
  | 'share'
  | 'publish';

// Permission definition
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: ResourceType;
  action: Action;
}

// Role definition
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // permission IDs
  isSystem: boolean; // system roles cannot be deleted
  createdAt: number;
  updatedAt: number;
}

// Resource-level permission binding
export interface ResourcePermission {
  userId: string;
  resourceId: string;
  resourceType: ResourceType;
  roleId: string;
  grantedBy: string;
  grantedAt: number;
  expiresAt?: number;
}

// Permission policy (for complex rules)
export interface PermissionPolicy {
  id: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  effect: 'allow' | 'deny';
  permissions: string[];
  priority: number;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

// Validation schemas
export const permissionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  resource: z.enum(['project', 'folder', 'file', 'plugin', 'system']),
  action: z.enum(['create', 'read', 'update', 'delete', 'manage', 'export', 'share', 'publish']),
});

export const roleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  permissions: z.array(z.string()),
  isSystem: z.boolean().default(false),
});

export const resourcePermissionSchema = z.object({
  userId: z.string().min(1),
  resourceId: z.string().min(1),
  resourceType: z.enum(['project', 'folder', 'file', 'plugin', 'system']),
  roleId: z.string().min(1),
  grantedBy: z.string().min(1),
  expiresAt: z.number().optional(),
});

// Built-in permissions
export const BUILT_IN_PERMISSIONS: Permission[] = [
  { id: 'project:create', name: 'Create Project', description: 'Create new projects', resource: 'project', action: 'create' },
  { id: 'project:read', name: 'Read Project', description: 'View project details', resource: 'project', action: 'read' },
  { id: 'project:update', name: 'Update Project', description: 'Modify project settings', resource: 'project', action: 'update' },
  { id: 'project:delete', name: 'Delete Project', description: 'Delete projects', resource: 'project', action: 'delete' },
  { id: 'project:manage', name: 'Manage Project', description: 'Full project management', resource: 'project', action: 'manage' },
  { id: 'project:share', name: 'Share Project', description: 'Share projects with others', resource: 'project', action: 'share' },
  { id: 'file:create', name: 'Create File', description: 'Upload/create files', resource: 'file', action: 'create' },
  { id: 'file:read', name: 'Read File', description: 'View/download files', resource: 'file', action: 'read' },
  { id: 'file:update', name: 'Update File', description: 'Modify files', resource: 'file', action: 'update' },
  { id: 'file:delete', name: 'Delete File', description: 'Delete files', resource: 'file', action: 'delete' },
  { id: 'file:export', name: 'Export File', description: 'Export files', resource: 'file', action: 'export' },
  { id: 'plugin:manage', name: 'Manage Plugin', description: 'Install/uninstall plugins', resource: 'plugin', action: 'manage' },
  { id: 'plugin:publish', name: 'Publish Plugin', description: 'Publish to marketplace', resource: 'plugin', action: 'publish' },
  { id: 'system:manage', name: 'System Admin', description: 'Full system administration', resource: 'system', action: 'manage' },
];

// Built-in roles
export const BUILT_IN_ROLES: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    permissions: BUILT_IN_PERMISSIONS.map((p) => p.id),
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Can create and edit projects and files',
    permissions: ['project:create', 'project:read', 'project:update', 'project:share', 'file:create', 'file:read', 'file:update', 'file:export'],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['project:read', 'file:read'],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];
