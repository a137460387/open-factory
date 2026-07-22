import { z } from 'zod';
import { createHash } from 'node:crypto';

// Audit event types
export type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'project.share'
  | 'file.create'
  | 'file.update'
  | 'file.delete'
  | 'file.export'
  | 'plugin.install'
  | 'plugin.uninstall'
  | 'plugin.update'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'permission.grant'
  | 'permission.revoke'
  | 'sso.configure'
  | 'system.config'
  | 'system.backup';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  severity: AuditSeverity;
  userId: string;
  userName: string;
  resourceId?: string;
  resourceType?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  previousHash: string;
  hash: string;
}

export interface AuditQueryFilter {
  startTime?: number;
  endTime?: number;
  types?: AuditEventType[];
  severity?: AuditSeverity;
  userId?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditReport {
  generatedAt: number;
  startTime: number;
  endTime: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  criticalEvents: AuditEvent[];
}

// Validation schemas
export const auditEventSchema = z.object({
  type: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  userId: z.string().min(1),
  userName: z.string().min(1),
  resourceId: z.string().optional(),
  resourceType: z.string().optional(),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// Hash chain utilities
export function computeEventHash(event: Omit<AuditEvent, 'hash'>): string {
  const content = JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    userId: event.userId,
    resourceId: event.resourceId,
    description: event.description,
    previousHash: event.previousHash,
  });
  return createHash('sha256').update(content).digest('hex');
}

export function verifyHashChain(events: AuditEvent[]): boolean {
  for (let i = 1; i < events.length; i++) {
    const current = events[i];
    const previous = events[i - 1];

    // Verify previous hash link
    if (current.previousHash !== previous.hash) return false;

    // Verify current hash
    const expectedHash = computeEventHash(current);
    if (current.hash !== expectedHash) return false;
  }
  return true;
}
