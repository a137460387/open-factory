import { randomUUID } from 'node:crypto';
import type {
  AuditEvent,
  AuditEventType,
  AuditSeverity,
  AuditQueryFilter,
  AuditReport,
} from './types.js';
import { computeEventHash } from './types.js';

export interface AuditStorage {
  store(event: AuditEvent): Promise<void>;
  query(filter: AuditQueryFilter): Promise<AuditEvent[]>;
  getLastEvent(): Promise<AuditEvent | null>;
  count(filter?: AuditQueryFilter): Promise<number>;
}

export class InMemoryAuditStorage implements AuditStorage {
  private events: AuditEvent[] = [];

  async store(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async query(filter: AuditQueryFilter): Promise<AuditEvent[]> {
    let filtered = this.events;

    if (filter.startTime) {
      filtered = filtered.filter((e) => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      filtered = filtered.filter((e) => e.timestamp <= filter.endTime!);
    }
    if (filter.types?.length) {
      filtered = filtered.filter((e) => filter.types!.includes(e.type));
    }
    if (filter.severity) {
      filtered = filtered.filter((e) => e.severity === filter.severity);
    }
    if (filter.userId) {
      filtered = filtered.filter((e) => e.userId === filter.userId);
    }
    if (filter.resourceId) {
      filtered = filtered.filter((e) => e.resourceId === filter.resourceId);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return filtered.slice(offset, offset + limit);
  }

  async getLastEvent(): Promise<AuditEvent | null> {
    return this.events.length > 0 ? this.events[this.events.length - 1] : null;
  }

  async count(filter?: AuditQueryFilter): Promise<number> {
    if (!filter) return this.events.length;
    const results = await this.query({ ...filter, limit: undefined, offset: undefined });
    return results.length;
  }
}

export class AuditLogger {
  private storage: AuditStorage;

  constructor(storage: AuditStorage) {
    this.storage = storage;
  }

  async log(params: {
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
  }): Promise<AuditEvent> {
    const lastEvent = await this.storage.getLastEvent();
    const previousHash = lastEvent?.hash ?? '0'.repeat(64);

    const event: Omit<AuditEvent, 'hash'> = {
      id: randomUUID(),
      timestamp: Date.now(),
      type: params.type,
      severity: params.severity,
      userId: params.userId,
      userName: params.userName,
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      description: params.description,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      previousHash,
    };

    const hash = computeEventHash(event);
    const completeEvent: AuditEvent = { ...event, hash };

    await this.storage.store(completeEvent);
    return completeEvent;
  }

  async query(filter: AuditQueryFilter): Promise<AuditEvent[]> {
    return this.storage.query(filter);
  }

  async generateReport(startTime: number, endTime: number): Promise<AuditReport> {
    const allEvents = await this.storage.query({
      startTime,
      endTime,
      limit: Number.MAX_SAFE_INTEGER,
    });

    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    for (const event of allEvents) {
      eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] ?? 0) + 1;
      userCounts[event.userId] = (userCounts[event.userId] ?? 0) + 1;
    }

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const criticalEvents = allEvents.filter((e) => e.severity === 'critical');

    return {
      generatedAt: Date.now(),
      startTime,
      endTime,
      totalEvents: allEvents.length,
      eventsByType,
      eventsBySeverity,
      topUsers,
      criticalEvents,
    };
  }

  async verifyIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
    const allEvents = await this.storage.query({
      limit: Number.MAX_SAFE_INTEGER,
    });
    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    const errors: string[] = [];

    for (let i = 1; i < allEvents.length; i++) {
      const current = allEvents[i];
      const previous = allEvents[i - 1];

      if (current.previousHash !== previous.hash) {
        errors.push(`Hash chain broken at event ${current.id}: expected previousHash ${previous.hash}, got ${current.previousHash}`);
      }

      const expectedHash = computeEventHash(current);
      if (current.hash !== expectedHash) {
        errors.push(`Hash mismatch at event ${current.id}: expected ${expectedHash}, got ${current.hash}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
