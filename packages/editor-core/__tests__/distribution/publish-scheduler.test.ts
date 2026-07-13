import { describe, it, expect } from 'vitest';
import {
  createDistributionSchedule,
  createBatchDistributionSchedules,
  updateScheduleStatus,
  canRetrySchedule,
  cancelSchedule,
  isScheduleReady,
  getPendingSchedules,
  getDueSchedules,
  getScheduleStats,
  addHistoryEntry,
  filterHistoryByPlatform,
  getRecentHistory,
  suggestOptimalPublishTime,
  formatScheduledTime,
  getDayOfWeekName,
} from '../../src/distribution/publish-scheduler';

describe('publish-scheduler', () => {
  describe('createDistributionSchedule', () => {
    it('应创建有效的发布计划', () => {
      const schedule = createDistributionSchedule({
        batchId: 'batch-1',
        taskId: 'task-1',
        platformId: 'youtube-1080p',
        platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });

      expect(schedule.id).toBeTruthy();
      expect(schedule.batchId).toBe('batch-1');
      expect(schedule.taskId).toBe('task-1');
      expect(schedule.platformId).toBe('youtube-1080p');
      expect(schedule.platformName).toBe('YouTube');
      expect(schedule.status).toBe('pending');
      expect(schedule.retryCount).toBe(0);
      expect(schedule.maxRetries).toBe(3);
    });
  });

  describe('createBatchDistributionSchedules', () => {
    it('应为每个任务创建计划', () => {
      const schedules = createBatchDistributionSchedules({
        batchId: 'batch-1',
        tasks: [
          { id: 'task-1', platformId: 'youtube-1080p', platformName: 'YouTube' },
          { id: 'task-2', platformId: 'tiktok', platformName: 'TikTok' },
        ],
        scheduledAt: '2026-07-14T15:00:00Z',
      });

      expect(schedules.length).toBe(2);
      expect(schedules[0].platformName).toBe('YouTube');
      expect(schedules[1].platformName).toBe('TikTok');
    });
  });

  describe('updateScheduleStatus', () => {
    it('应正确更新状态', () => {
      const schedule = createDistributionSchedule({
        batchId: 'b1',
        taskId: 't1',
        platformId: 'youtube-1080p',
        platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });

      const updated = updateScheduleStatus(schedule, 'publishing');
      expect(updated.status).toBe('publishing');
    });

    it('失败时应增加重试次数', () => {
      const schedule = createDistributionSchedule({
        batchId: 'b1',
        taskId: 't1',
        platformId: 'youtube-1080p',
        platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });

      const updated = updateScheduleStatus(schedule, 'failed', 'Network error');
      expect(updated.retryCount).toBe(1);
      expect(updated.error).toBe('Network error');
    });
  });

  describe('canRetrySchedule', () => {
    it('失败且未超过最大重试次数时应可重试', () => {
      const schedule = createDistributionSchedule({
        batchId: 'b1',
        taskId: 't1',
        platformId: 'youtube-1080p',
        platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });
      const failed = updateScheduleStatus(schedule, 'failed');
      expect(canRetrySchedule(failed)).toBe(true);
    });

    it('超过最大重试次数时不可重试', () => {
      let schedule = createDistributionSchedule({
        batchId: 'b1',
        taskId: 't1',
        platformId: 'youtube-1080p',
        platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });
      for (let i = 0; i < 3; i++) {
        schedule = updateScheduleStatus(schedule, 'failed');
      }
      expect(canRetrySchedule(schedule)).toBe(false);
    });
  });

  describe('cancelSchedule', () => {
    it('应取消待发布计划', () => {
      const schedule = createDistributionSchedule({
        batchId: 'b1',
        taskId: 't1',
        platformId: 'youtube-1080p',
        platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });

      const canceled = cancelSchedule(schedule);
      expect(canceled.status).toBe('canceled');
    });

    it('不应取消已发布的计划', () => {
      const schedule = createDistributionSchedule({
        batchId: 'b1',
        taskId: 't1',
        platformId: 'youtube-1080p',
        platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });
      const published = updateScheduleStatus(schedule, 'published');
      const result = cancelSchedule(published);
      expect(result.status).toBe('published');
    });
  });

  describe('getPendingSchedules', () => {
    it('应只返回待发布计划并按时间排序', () => {
      const s1 = createDistributionSchedule({
        batchId: 'b1', taskId: 't1', platformId: 'youtube-1080p', platformName: 'YouTube',
        scheduledAt: '2026-07-15T15:00:00Z',
      });
      const s2 = createDistributionSchedule({
        batchId: 'b1', taskId: 't2', platformId: 'tiktok', platformName: 'TikTok',
        scheduledAt: '2026-07-14T15:00:00Z',
      });
      const s3 = updateScheduleStatus(
        createDistributionSchedule({
          batchId: 'b1', taskId: 't3', platformId: 'bilibili', platformName: 'Bilibili',
          scheduledAt: '2026-07-13T15:00:00Z',
        }),
        'published',
      );

      const pending = getPendingSchedules([s1, s2, s3]);
      expect(pending.length).toBe(2);
      expect(pending[0].scheduledAt).toBe('2026-07-14T15:00:00Z');
    });
  });

  describe('getScheduleStats', () => {
    it('应正确统计各状态', () => {
      const s1 = createDistributionSchedule({
        batchId: 'b1', taskId: 't1', platformId: 'youtube-1080p', platformName: 'YouTube',
        scheduledAt: '2026-07-14T15:00:00Z',
      });
      const s2 = updateScheduleStatus(
        createDistributionSchedule({
          batchId: 'b1', taskId: 't2', platformId: 'tiktok', platformName: 'TikTok',
          scheduledAt: '2026-07-14T16:00:00Z',
        }),
        'published',
      );
      const s3 = updateScheduleStatus(
        createDistributionSchedule({
          batchId: 'b1', taskId: 't3', platformId: 'bilibili', platformName: 'Bilibili',
          scheduledAt: '2026-07-14T17:00:00Z',
        }),
        'failed',
      );

      const stats = getScheduleStats([s1, s2, s3]);
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.published).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('addHistoryEntry', () => {
    it('应添加历史记录到列表头部', () => {
      const entry = {
        id: 'h1',
        scheduleId: 's1',
        platformName: 'YouTube',
        status: 'success' as const,
        publishedAt: new Date().toISOString(),
      };

      const history = addHistoryEntry([], entry);
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('h1');
    });

    it('应限制最大历史记录数', () => {
      let history: any[] = [];
      for (let i = 0; i < 210; i++) {
        history = addHistoryEntry(history, {
          id: `h${i}`,
          scheduleId: `s${i}`,
          platformName: 'YouTube',
          status: 'success',
          publishedAt: new Date().toISOString(),
        });
      }
      expect(history.length).toBe(200);
    });
  });

  describe('suggestOptimalPublishTime', () => {
    it('应为已知平台返回建议', () => {
      const suggestion = suggestOptimalPublishTime('youtube-1080p');
      expect(suggestion.platform).toBe('YouTube');
      expect(suggestion.suggestedHour).toBeGreaterThanOrEqual(0);
      expect(suggestion.suggestedHour).toBeLessThanOrEqual(23);
      expect(suggestion.reason).toBeTruthy();
    });

    it('未知平台应返回默认建议', () => {
      const suggestion = suggestOptimalPublishTime('unknown');
      expect(suggestion.suggestedHour).toBe(12);
    });
  });

  describe('formatScheduledTime', () => {
    it('应格式化 ISO 时间为中文格式', () => {
      const formatted = formatScheduledTime('2026-07-14T15:30:00Z');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('getDayOfWeekName', () => {
    it('应返回正确的星期名称', () => {
      expect(getDayOfWeekName(0)).toBe('周日');
      expect(getDayOfWeekName(1)).toBe('周一');
      expect(getDayOfWeekName(6)).toBe('周六');
    });
  });
});
