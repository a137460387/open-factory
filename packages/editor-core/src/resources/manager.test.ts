/**
 * Resource Manager Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateFileHash,
  calculatePerceptualSimilarity,
  getResourceType,
  detectDuplicates,
  identifyUnusedFiles,
  analyzeCache,
  generateProxySpec,
  calculateResourceStats,
  generateCleanupRecommendations,
  generateResourceReport,
  formatSize,
  formatDuration,
} from './manager';

import type {
  ResourceFile,
  ProxyFile,
  CacheEntry,
  ResourceConfig,
} from './types';

import { DEFAULT_RESOURCE_CONFIG } from './types';

describe('Resource Manager', () => {
  describe('generateFileHash', () => {
    it('should generate consistent hash', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash1 = generateFileHash(data);
      const hash2 = generateFileHash(data);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different data', () => {
      const data1 = new Uint8Array([1, 2, 3]);
      const data2 = new Uint8Array([4, 5, 6]);
      const hash1 = generateFileHash(data1);
      const hash2 = generateFileHash(data2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculatePerceptualSimilarity', () => {
    it('should return 1 for identical hashes', () => {
      expect(calculatePerceptualSimilarity('abc', 'abc')).toBe(1);
    });

    it('should return value between 0 and 1', () => {
      const similarity = calculatePerceptualSimilarity('abc', 'def');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('getResourceType', () => {
    it('should detect video files', () => {
      expect(getResourceType('video.mp4')).toBe('video');
      expect(getResourceType('clip.mov')).toBe('video');
    });

    it('should detect audio files', () => {
      expect(getResourceType('audio.mp3')).toBe('audio');
      expect(getResourceType('sound.wav')).toBe('audio');
    });

    it('should detect image files', () => {
      expect(getResourceType('photo.jpg')).toBe('image');
      expect(getResourceType('graphic.png')).toBe('image');
    });

    it('should detect project files', () => {
      expect(getResourceType('project.ofproject')).toBe('project');
    });
  });

  describe('detectDuplicates', () => {
    it('should detect exact duplicates', () => {
      const files: ResourceFile[] = [
        {
          id: '1',
          path: '/path/file1.mp4',
          name: 'file1.mp4',
          type: 'video',
          size: 1000,
          hash: 'abc123',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'active',
        },
        {
          id: '2',
          path: '/path/file2.mp4',
          name: 'file2.mp4',
          type: 'video',
          size: 1000,
          hash: 'abc123',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now() - 1000,
          status: 'active',
        },
      ];

      const duplicates = detectDuplicates(files, 0.95);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].files).toHaveLength(2);
      expect(duplicates[0].similarity).toBe(1);
    });

    it('should not group different files', () => {
      const files: ResourceFile[] = [
        {
          id: '1',
          path: '/path/file1.mp4',
          name: 'file1.mp4',
          type: 'video',
          size: 1000,
          hash: 'abc123',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'active',
        },
        {
          id: '2',
          path: '/path/file2.mp4',
          name: 'file2.mp4',
          type: 'video',
          size: 1000,
          hash: 'def456',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'active',
        },
      ];

      const duplicates = detectDuplicates(files, 0.95);
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('identifyUnusedFiles', () => {
    it('should identify old files', () => {
      const files: ResourceFile[] = [
        {
          id: '1',
          path: '/path/old.mp4',
          name: 'old.mp4',
          type: 'video',
          size: 1000,
          hash: 'abc',
          createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
          modifiedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
          status: 'active',
        },
        {
          id: '2',
          path: '/path/recent.mp4',
          name: 'recent.mp4',
          type: 'video',
          size: 1000,
          hash: 'def',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'active',
        },
      ];

      const unused = identifyUnusedFiles(files, 30, []);
      expect(unused).toHaveLength(1);
      expect(unused[0].id).toBe('1');
    });
  });

  describe('analyzeCache', () => {
    it('should analyze cache entries', () => {
      const entries: CacheEntry[] = [
        {
          id: '1',
          category: 'preview',
          path: '/cache/preview1',
          size: 1000,
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          accessCount: 5,
          isExpired: true,
        },
        {
          id: '2',
          category: 'thumbnail',
          path: '/cache/thumb1',
          size: 500,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          accessCount: 10,
          isExpired: false,
        },
      ];

      const analysis = analyzeCache(entries);
      expect(analysis.totalSize).toBe(1500);
      expect(analysis.expiredCount).toBe(1);
      expect(analysis.expiredSize).toBe(1000);
    });
  });

  describe('generateProxySpec', () => {
    it('should generate proxy for large video', () => {
      const file: ResourceFile = {
        id: '1',
        path: '/path/video.mp4',
        name: 'video.mp4',
        type: 'video',
        size: 200 * 1024 * 1024, // 200MB
        hash: 'abc',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        lastAccessedAt: Date.now(),
        status: 'active',
      };

      const proxy = generateProxySpec(file, DEFAULT_RESOURCE_CONFIG.proxy);
      expect(proxy).not.toBeNull();
      expect(proxy?.originalId).toBe('1');
      expect(proxy?.width).toBe(640);
      expect(proxy?.height).toBe(360);
    });

    it('should not generate proxy for small video', () => {
      const file: ResourceFile = {
        id: '1',
        path: '/path/video.mp4',
        name: 'video.mp4',
        type: 'video',
        size: 50 * 1024 * 1024, // 50MB
        hash: 'abc',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        lastAccessedAt: Date.now(),
        status: 'active',
      };

      const proxy = generateProxySpec(file, DEFAULT_RESOURCE_CONFIG.proxy);
      expect(proxy).toBeNull();
    });

    it('should not generate proxy for audio', () => {
      const file: ResourceFile = {
        id: '1',
        path: '/path/audio.mp3',
        name: 'audio.mp3',
        type: 'audio',
        size: 200 * 1024 * 1024,
        hash: 'abc',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        lastAccessedAt: Date.now(),
        status: 'active',
      };

      const proxy = generateProxySpec(file, DEFAULT_RESOURCE_CONFIG.proxy);
      expect(proxy).toBeNull();
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(1024)).toBe('1.00 KB');
      expect(formatSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatSize(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(3660000)).toBe('1h 1m');
    });
  });

  describe('calculateResourceStats', () => {
    it('should calculate stats correctly', () => {
      const files: ResourceFile[] = [
        {
          id: '1',
          path: '/path/video.mp4',
          name: 'video.mp4',
          type: 'video',
          size: 1000,
          hash: 'abc',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'active',
        },
        {
          id: '2',
          path: '/path/audio.mp3',
          name: 'audio.mp3',
          type: 'audio',
          size: 500,
          hash: 'def',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'active',
        },
      ];

      const stats = calculateResourceStats(files);
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(1500);
      expect(stats.byType.video.count).toBe(1);
      expect(stats.byType.audio.count).toBe(1);
    });
  });

  describe('generateResourceReport', () => {
    it('should generate complete report', () => {
      const files: ResourceFile[] = [
        {
          id: '1',
          path: '/path/video.mp4',
          name: 'video.mp4',
          type: 'video',
          size: 1000,
          hash: 'abc',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'active',
        },
      ];

      const report = generateResourceReport(files, [], [], DEFAULT_RESOURCE_CONFIG);
      expect(report).toBeDefined();
      expect(report.stats).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.proxyStats).toBeDefined();
    });
  });
});
