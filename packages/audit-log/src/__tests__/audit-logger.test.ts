import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger, InMemoryAuditStorage } from '../audit-logger.js';
import { verifyHashChain } from '../types.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let storage: InMemoryAuditStorage;

  beforeEach(() => {
    storage = new InMemoryAuditStorage();
    logger = new AuditLogger(storage);
  });

  describe('logging', () => {
    it('should create audit event with hash', async () => {
      const event = await logger.log({
        type: 'user.login',
        severity: 'info',
        userId: 'user1',
        userName: 'Test User',
        description: 'User logged in',
      });

      expect(event.id).toBeDefined();
      expect(event.hash).toBeDefined();
      expect(event.hash).toHaveLength(64); // SHA-256 hex
      expect(event.previousHash).toBe('0'.repeat(64)); // first event
    });

    it('should chain hashes correctly', async () => {
      const event1 = await logger.log({
        type: 'user.login',
        severity: 'info',
        userId: 'user1',
        userName: 'Test User',
        description: 'User logged in',
      });

      const event2 = await logger.log({
        type: 'project.create',
        severity: 'info',
        userId: 'user1',
        userName: 'Test User',
        description: 'Created project',
      });

      expect(event2.previousHash).toBe(event1.hash);
    });

    it('should store metadata', async () => {
      const event = await logger.log({
        type: 'file.export',
        severity: 'info',
        userId: 'user1',
        userName: 'Test User',
        resourceId: 'file-123',
        resourceType: 'file',
        description: 'Exported file',
        metadata: { format: 'mp4', resolution: '1080p' },
      });

      expect(event.metadata).toEqual({ format: 'mp4', resolution: '1080p' });
      expect(event.resourceId).toBe('file-123');
    });
  });

  describe('querying', () => {
    beforeEach(async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'user1', userName: 'User 1', description: 'Login' });
      await logger.log({ type: 'project.create', severity: 'info', userId: 'user1', userName: 'User 1', description: 'Create project' });
      await logger.log({ type: 'file.delete', severity: 'warning', userId: 'user2', userName: 'User 2', description: 'Delete file' });
      await logger.log({ type: 'system.config', severity: 'critical', userId: 'admin', userName: 'Admin', description: 'Config changed' });
    });

    it('should query by type', async () => {
      const events = await logger.query({ types: ['user.login'] });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('user.login');
    });

    it('should query by severity', async () => {
      const events = await logger.query({ severity: 'critical' });
      expect(events).toHaveLength(1);
      expect(events[0].severity).toBe('critical');
    });

    it('should query by userId', async () => {
      const events = await logger.query({ userId: 'user1' });
      expect(events).toHaveLength(2);
    });

    it('should support pagination', async () => {
      const page1 = await logger.query({ limit: 2, offset: 0 });
      const page2 = await logger.query({ limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('reports', () => {
    it('should generate report', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'user1', userName: 'User 1', description: 'Login' });
      await logger.log({ type: 'user.login', severity: 'info', userId: 'user2', userName: 'User 2', description: 'Login' });
      await logger.log({ type: 'system.config', severity: 'critical', userId: 'admin', userName: 'Admin', description: 'Config' });

      const report = await logger.generateReport(Date.now() - 10000, Date.now() + 10000);
      expect(report.totalEvents).toBe(3);
      expect(report.eventsByType['user.login']).toBe(2);
      expect(report.eventsBySeverity['critical']).toBe(1);
      expect(report.topUsers).toHaveLength(3);
      expect(report.criticalEvents).toHaveLength(1);
    });
  });

  describe('integrity', () => {
    it('should verify valid hash chain', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'user1', userName: 'User 1', description: 'Login' });
      await logger.log({ type: 'project.create', severity: 'info', userId: 'user1', userName: 'User 1', description: 'Create' });
      await logger.log({ type: 'file.delete', severity: 'warning', userId: 'user2', userName: 'User 2', description: 'Delete' });

      const result = await logger.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('InMemoryAuditStorage', () => {
    it('should count events', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'user1', userName: 'User 1', description: 'Login' });
      await logger.log({ type: 'project.create', severity: 'info', userId: 'user1', userName: 'User 1', description: 'Create' });

      const total = await storage.count();
      expect(total).toBe(2);

      const filtered = await storage.count({ types: ['user.login'] });
      expect(filtered).toBe(1);
    });

    it('should return null for last event when empty', async () => {
      const last = await storage.getLastEvent();
      expect(last).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should query with time range', async () => {
      const before = Date.now() - 1000;
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u1', userName: 'U', description: 'Login' });
      const after = Date.now() + 1000;

      const events = await logger.query({ startTime: before, endTime: after });
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for non-matching type', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u1', userName: 'U', description: 'Login' });
      const events = await logger.query({ types: ['system.backup'] });
      expect(events).toHaveLength(0);
    });

    it('should return empty for non-matching userId', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u1', userName: 'U', description: 'Login' });
      const events = await logger.query({ userId: 'other-user' });
      expect(events).toHaveLength(0);
    });

    it('should generate empty report for no events', async () => {
      const report = await logger.generateReport(Date.now() - 10000, Date.now() + 10000);
      expect(report.totalEvents).toBe(0);
      expect(report.topUsers).toHaveLength(0);
      expect(report.criticalEvents).toHaveLength(0);
    });

    it('should verify integrity of single event', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u1', userName: 'U', description: 'Login' });
      const result = await logger.verifyIntegrity();
      expect(result.valid).toBe(true);
    });

    it('should detect tampered hash', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u1', userName: 'U', description: 'Login' });
      await logger.log({ type: 'project.create', severity: 'info', userId: 'u1', userName: 'U', description: 'Create' });
      // Tamper with the previousHash of the second event to break chain
      const allEvents = await storage.query({ limit: 100 });
      (allEvents[1] as { previousHash: string }).previousHash = 'tampered-hash';
      const result = await logger.verifyIntegrity();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle report with multiple users', async () => {
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u1', userName: 'U1', description: 'L1' });
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u2', userName: 'U2', description: 'L2' });
      await logger.log({ type: 'user.login', severity: 'info', userId: 'u1', userName: 'U1', description: 'L3' });

      const report = await logger.generateReport(Date.now() - 10000, Date.now() + 10000);
      expect(report.topUsers[0].userId).toBe('u1');
      expect(report.topUsers[0].count).toBe(2);
    });
  });
});
