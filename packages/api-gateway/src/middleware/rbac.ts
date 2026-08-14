/**
 * RBAC (Role-Based Access Control) middleware
 */

import type {FastifyRequest, FastifyReply} from 'fastify';
import {AuthError} from './auth.js';
import type {UserRole} from '../types.js';
import {ROLE_PERMISSIONS} from '../types.js';

// ============================================================
// Permission Checking
// ============================================================

export function hasPermission(
  userRoles: UserRole[],
  resource: string,
  action: 'read' | 'write' | 'delete'
): boolean {
  for (const role of userRoles) {
    const permissions = ROLE_PERMISSIONS[role] || [];

    for (const permission of permissions) {
      // Wildcard match
      if (permission.resource === '*' && permission.action === '*') {
        return true;
      }

      // Exact resource match
      if (permission.resource === resource) {
        if (permission.action === '*' || permission.action === action) {
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================================
// RBAC Middleware Factory
// ============================================================

export interface RBACOptions {
  resource: string;
  action: 'read' | 'write' | 'delete';
}

export function rbacMiddleware(options: RBACOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AuthError('Authentication required', 'AUTH_REQUIRED', 401);
    }

    const { roles } = request.user;
    const { resource, action } = options;

    if (!hasPermission(roles, resource, action)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions for ${action} on ${resource}`,
        },
      });
      return;
    }
  };
}

// ============================================================
// Ownership Check Helper
// ============================================================

export function isOwner(userId: string, resourceOwnerId: string): boolean {
  return userId === resourceOwnerId;
}


