import { describe, it, expect } from 'vitest';
import { formatDuration } from '../../src/utils/time';
import {
  createDistributionBatch,
  updateDistributionTaskProgress,
  finishDistributionTask,
  failDistributionTask,
  cancelDistributionTask,
  isDistributionBatchComplete,
  getDistributionBatchStats,
  applyDistributionTemplate,
  buildPlatformExportSettings,
  formatFileSize,
} from '../../src/distribution/batch-export';
import { getDistributionPlatform } from '../../src/distribution/platform-presets';
import type { Project } from '../../src/model-types';

// 创建测试用的最小 Project 对象（包含一个视频剪辑以产生非零时长）
function createTestProject(overrides?: Partial<Project>): Project {
  return {
    version: '0.2',
    id: 'test-project',
    name: 'Test Project',
    releaseVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    masterVolume: 1,
    settings: { fps: 30, timecodeFormat: 'hh:mm:ss:ff', width: 1920, height: 1080 },
    media: [{
      id: 'media-1',
      type: 'video',
      name: 'test.mp4',
      path: '/tmp/test.mp4',
      duration: 120,
      width: 1920,
      height: 1080,
    }],
    mediaFolders: [],
    mediaMetadata: {},
    annotations: [],
    reviewAnnotations: [],
    collaborationNotes: [],
    timelineNotes: [],
    bookmarks: [],
    beatMarkers: [],
    exportRanges: [],
    protectedRanges: [],
    clipGroups: [],
    speakers: [],
    documentation: { sections: [] },
    timeline: {
      tracks: [{
        id: 'track-1',
        type: 'video',
        name: 'V1',
        clips: [{
          id: 'clip-1',
          type: 'video',
          name: 'test clip',
          trackId: 'track-1',
          start: 0,
          duration: 120,
          trimStart: 0,
          sourceMediaId: 'media-1',
          speed: 1,
        }],
      }],
      transitions: [],
      markers: [],
    },
    sequences: [],
    activeSequenceId: '',
    ...overrides,
  } as unknown as Project;
}

describe('batch-export', () => {
  const testProject = createTestProject();

  describe('createDistributionBatch', () => {
    it('应为每个平台创建任务', () => {
      const result = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p', 'tiktok', 'bilibili'],
        outputDir: '/tmp/output',
      });

      expect(result.tasks.length).toBe(3);
      expect(result.batchId).toBeTruthy();
    });

    it('每个任务应有正确的平台信息', () => {
      const result = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p'],
        outputDir: '/tmp/output',
      });

      const task = result.tasks[0];
      expect(task.platform.id).toBe('youtube-1080p');
      expect(task.platform.name).toBe('YouTube');
      expect(task.settings.width).toBe(1920);
      expect(task.settings.height).toBe(1080);
    });

    it('每个任务应有初始状态', () => {
      const result = createDistributionBatch({
        project: testProject,
        platforms: ['tiktok'],
        outputDir: '/tmp/output',
      });

      const task = result.tasks[0];
      expect(task.status).toBe('pending');
      expect(task.progress).toBe(0);
    });

    it('应计算预估成本', () => {
      const result = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p', 'tiktok'],
        outputDir: '/tmp/output',
      });

      expect(result.totalEstimatedDurationSecs).toBeGreaterThan(0);
      expect(result.totalEstimatedFileSizeBytes).toBeGreaterThan(0);
    });

    it('应支持自定义模板', () => {
      const result = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p'],
        outputDir: '/tmp/output',
        template: '{project}_{platform}',
      });

      expect(result.tasks[0].settings.outputPath).toContain('Test Project');
      expect(result.tasks[0].settings.outputPath).toContain('YouTube');
    });
  });

  describe('任务状态更新', () => {
    it('应正确更新进度', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p'],
        outputDir: '/tmp/output',
      });

      const updated = updateDistributionTaskProgress(batch.tasks, batch.tasks[0].id, 0.5);
      expect(updated[0].progress).toBe(0.5);
    });

    it('进度应钳制在 0-1 范围', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-10800p' as any].filter(() => false).concat(['youtube-1080p']),
        outputDir: '/tmp/output',
      });

      const updated1 = updateDistributionTaskProgress(batch.tasks, batch.tasks[0].id, 1.5);
      expect(updated1[0].progress).toBe(1);

      const updated2 = updateDistributionTaskProgress(batch.tasks, batch.tasks[0].id, -0.5);
      expect(updated2[0].progress).toBe(0);
    });

    it('应正确标记完成', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p'],
        outputDir: '/tmp/output',
      });

      const updated = finishDistributionTask(batch.tasks, batch.tasks[0].id);
      expect(updated[0].status).toBe('success');
      expect(updated[0].progress).toBe(1);
    });

    it('应正确标记失败', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p'],
        outputDir: '/tmp/output',
      });

      const updated = failDistributionTask(batch.tasks, batch.tasks[0].id, 'FFmpeg error');
      expect(updated[0].status).toBe('error');
      expect(updated[0].error).toBe('FFmpeg error');
    });

    it('应正确取消任务', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p'],
        outputDir: '/tmp/output',
      });

      const updated = cancelDistributionTask(batch.tasks, batch.tasks[0].id);
      expect(updated[0].status).toBe('canceled');
    });
  });

  describe('isDistributionBatchComplete', () => {
    it('全部完成时应返回 true', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p'],
        outputDir: '/tmp/output',
      });
      const finished = finishDistributionTask(batch.tasks, batch.tasks[0].id);
      expect(isDistributionBatchComplete(finished)).toBe(true);
    });

    it('有未完成任务时应返回 false', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p', 'tiktok'],
        outputDir: '/tmp/output',
      });
      const finished = finishDistributionTask(batch.tasks, batch.tasks[0].id);
      expect(isDistributionBatchComplete(finished)).toBe(false);
    });
  });

  describe('getDistributionBatchStats', () => {
    it('应正确统计各状态数量', () => {
      const batch = createDistributionBatch({
        project: testProject,
        platforms: ['youtube-1080p', 'tiktok', 'bilibili'],
        outputDir: '/tmp/output',
      });

      let tasks = finishDistributionTask(batch.tasks, batch.tasks[0].id);
      tasks = failDistributionTask(tasks, batch.tasks[1].id, 'error');

      const stats = getDistributionBatchStats(tasks);
      expect(stats.total).toBe(3);
      expect(stats.success).toBe(1);
      expect(stats.error).toBe(1);
      expect(stats.pending).toBe(1);
    });
  });

  describe('applyDistributionTemplate', () => {
    it('应替换所有占位符', () => {
      const platform = getDistributionPlatform('youtube-1080p');
      const result = applyDistributionTemplate(
        '{project}-{platform}-{resolution}',
        platform,
        'MyVideo',
      );
      expect(result).toContain('MyVideo');
      expect(result).toContain('YouTube');
      expect(result).toContain('1920x1080');
    });

    it('应支持日期占位符', () => {
      const platform = getDistributionPlatform('tiktok');
      const result = applyDistributionTemplate('{date}', platform, 'test');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('应支持宽高比占位符', () => {
      const platform = getDistributionPlatform('tiktok');
      const result = applyDistributionTemplate('{aspect}', platform, 'test');
      expect(result).toBe('9-16');
    });
  });

  describe('buildPlatformExportSettings', () => {
    it('应构建正确的导出设置', () => {
      const platform = getDistributionPlatform('tiktok');
      const settings = buildPlatformExportSettings(
        platform,
        '/tmp/output',
        'TestProject',
      );

      expect(settings.width).toBe(1080);
      expect(settings.height).toBe(1920);
      expect(settings.fps).toBe(60);
      expect(settings.videoCodec).toBe('libx264');
      expect(settings.format).toBe('mp4');
    });

    it('应支持裁剪结果', () => {
      const platform = getDistributionPlatform('tiktok');
      const settings = buildPlatformExportSettings(
        platform,
        '/tmp/output',
        'TestProject',
        undefined,
        {
          platformId: 'tiktok',
          sourceAspectRatio: '16:9',
          targetAspectRatio: '9:16',
          cropX: 0.1,
          cropY: 0,
          cropWidth: 0.4,
          cropHeight: 1,
          scaleFilter: 'scale=1080:1920',
          cropFilter: 'crop=768:1080:192:0',
          confidence: 0.8,
          warnings: [],
        },
      );

      // cropCenterX = 0.1 + 0.4/2 = 0.3, reframeOffsetX = 0.3 - 0.5 = -0.2
      expect(settings.reframeOffsetX).not.toBe(0);
    });
  });

  describe('formatFileSize', () => {
    it('应正确格式化各种大小', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('formatDuration', () => {
    it('应正确格式化各种时长', () => {
      expect(formatDuration(30)).toBe('30秒');
      expect(formatDuration(90)).toBe('1分30秒');
      expect(formatDuration(3661)).toBe('1时1分');
    });
  });
});
