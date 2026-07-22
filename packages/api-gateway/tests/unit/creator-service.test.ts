/**
 * Creator service tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreatorService } from '../../src/services/creator-service.js';
import { NotFoundError } from '../../src/utils/errors.js';

describe('CreatorService', () => {
  let service: CreatorService;

  beforeEach(() => {
    service = new CreatorService();
  });

  describe('getCreatorByUserId', () => {
    it('should return creator profile for valid user', async () => {
      const creator = await service.getCreatorByUserId('user-001');

      expect(creator).toBeDefined();
      expect(creator.userId).toBe('user-001');
      expect(creator.displayName).toBe('Open Factory Team');
      expect(creator.tier).toBe('flagship');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      await expect(service.getCreatorByUserId('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getCreatorById', () => {
    it('should return creator profile for valid ID', async () => {
      const creator = await service.getCreatorById('creator-001');

      expect(creator).toBeDefined();
      expect(creator.id).toBe('creator-001');
    });

    it('should throw NotFoundError for non-existent creator', async () => {
      await expect(service.getCreatorById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getCreatorStats', () => {
    it('should return creator statistics', async () => {
      const stats = await service.getCreatorStats('creator-001');

      expect(stats).toBeDefined();
      expect(stats.totalRevenue).toBeGreaterThan(0);
      expect(stats.monthlyRevenue).toBeGreaterThan(0);
      expect(stats.totalDownloads).toBeGreaterThan(0);
      expect(stats.totalPlugins).toBeGreaterThan(0);
      expect(stats.averageRating).toBeGreaterThan(0);
    });
  });

  describe('getCreatorRevenue', () => {
    it('should return revenue breakdown', async () => {
      const revenue = await service.getCreatorRevenue('creator-001');

      expect(revenue).toBeDefined();
      expect(revenue.total).toBeGreaterThan(0);
      expect(revenue.monthly).toBeGreaterThan(0);
      expect(revenue.breakdown).toBeDefined();
      expect(revenue.breakdown.length).toBeGreaterThan(0);

      revenue.breakdown.forEach((item) => {
        expect(item.pluginId).toBeDefined();
        expect(item.pluginName).toBeDefined();
        expect(item.revenue).toBeGreaterThanOrEqual(0);
        expect(item.downloads).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getDashboardData', () => {
    it('should return complete dashboard data', async () => {
      const dashboard = await service.getDashboardData('user-001');

      expect(dashboard).toBeDefined();
      expect(dashboard.profile).toBeDefined();
      expect(dashboard.stats).toBeDefined();
      expect(dashboard.revenue).toBeDefined();
      expect(dashboard.recentPlugins).toBeDefined();
      expect(dashboard.notifications).toBeDefined();
    });
  });

  describe('updateCreatorProfile', () => {
    it('should update creator profile', async () => {
      const updated = await service.updateCreatorProfile('user-001', {
        displayName: 'Updated Name',
        bio: 'New bio',
      });

      expect(updated.displayName).toBe('Updated Name');
      expect(updated.bio).toBe('New bio');
      expect(updated.userId).toBe('user-001');
    });
  });

});
