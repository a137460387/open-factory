import { describe, it, expect } from 'vitest';
import {
  serializeProjectAsTemplate,
  parseTemplateCards,
  parseTemplateMarketCache,
  serializeTemplateMarketCache,
  installTemplate,
  isTemplateInstalled,
  getOfflineTemplates,
  type CommunityTemplateCard,
  type TemplateMarketCache,
} from '../src/project/template-sharing';

function makeCard(overrides: Partial<CommunityTemplateCard> = {}): CommunityTemplateCard {
  return {
    id: 'template-1',
    name: '婚礼模板',
    author: '测试作者',
    description: '适合婚礼视频',
    tags: ['婚礼'],
    thumbnailUrl: 'https://example.com/thumb.jpg',
    downloadCount: 100,
    templateData: {
      schemaVersion: 1,
      name: '婚礼模板',
      description: '适合婚礼视频',
      settings: { fps: 30, timecodeFormat: 'ndf', width: 1920, height: 1080 },
      tracks: [],
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    publishedAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('template-sharing', () => {
  describe('serializeProjectAsTemplate', () => {
    it('should serialize project structure without media paths', () => {
      const project = {
        name: '我的项目',
        settings: { fps: 30, timecodeFormat: 'ndf' as const, width: 1920, height: 1080 },
        timeline: {
          tracks: [
            {
              type: 'video' as const,
              name: 'Video 1',
              clips: [
                { name: 'Clip 1', start: 0, duration: 5 },
                { name: 'Clip 2', start: 5, duration: 3 },
              ],
            },
            {
              type: 'audio' as const,
              name: 'Audio 1',
              clips: [{ name: 'Music', start: 0, duration: 8 }],
            },
          ],
        },
      };
      const template = serializeProjectAsTemplate(project, '测试模板');
      expect(template.schemaVersion).toBe(1);
      expect(template.name).toBe('我的项目');
      expect(template.tracks).toHaveLength(2);
      expect(template.tracks[0].clipCount).toBe(2);
      expect(template.tracks[0].clipPlaceholders[0].name).toBe('Clip 1');
      // 不包含真实媒体路径
      expect(JSON.stringify(template)).not.toContain('mediaId');
      expect(JSON.stringify(template)).not.toContain('path');
    });
  });

  describe('parseTemplateCards', () => {
    it('should parse valid template cards JSON', () => {
      const cards = [makeCard(), makeCard({ id: 'template-2', name: 'Vlog模板' })];
      const parsed = parseTemplateCards(JSON.stringify(cards));
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('婚礼模板');
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseTemplateCards('not json')).toHaveLength(0);
    });

    it('should filter out invalid cards', () => {
      const cards = [makeCard(), { invalid: true }];
      const parsed = parseTemplateCards(JSON.stringify(cards));
      expect(parsed).toHaveLength(1);
    });
  });

  describe('parseTemplateMarketCache', () => {
    it('should parse valid cache', () => {
      const cache: TemplateMarketCache = {
        version: 1,
        lastFetched: '2025-01-01T00:00:00.000Z',
        templates: [makeCard()],
      };
      const parsed = parseTemplateMarketCache(JSON.stringify(cache));
      expect(parsed.version).toBe(1);
      expect(parsed.templates).toHaveLength(1);
    });

    it('should return empty cache for invalid JSON', () => {
      const result = parseTemplateMarketCache('not json');
      expect(result.templates).toHaveLength(0);
      expect(result.version).toBe(1);
    });
  });

  describe('serializeTemplateMarketCache', () => {
    it('should round-trip serialize and parse', () => {
      const cache: TemplateMarketCache = {
        version: 1,
        lastFetched: '2025-01-01T00:00:00.000Z',
        templates: [makeCard()],
      };
      const json = serializeTemplateMarketCache(cache);
      const parsed = parseTemplateMarketCache(json);
      expect(parsed.templates).toHaveLength(1);
      expect(parsed.templates[0].id).toBe('template-1');
    });
  });

  describe('installTemplate', () => {
    it('should add template to installed list', () => {
      const result = installTemplate([], 'template-1');
      expect(result.installedIds).toEqual(['template-1']);
      expect(result.result.installed).toBe(true);
    });

    it('should not duplicate already installed template', () => {
      const result = installTemplate(['template-1'], 'template-1');
      expect(result.installedIds).toEqual(['template-1']);
      expect(result.result.installed).toBe(false);
    });

    it('should add to existing list', () => {
      const result = installTemplate(['template-1'], 'template-2');
      expect(result.installedIds).toEqual(['template-1', 'template-2']);
    });
  });

  describe('isTemplateInstalled', () => {
    it('should return true for installed template', () => {
      expect(isTemplateInstalled(['template-1'], 'template-1')).toBe(true);
    });
    it('should return false for not installed template', () => {
      expect(isTemplateInstalled([], 'template-1')).toBe(false);
    });
  });

  describe('getOfflineTemplates', () => {
    it('should return cached templates', () => {
      const cache: TemplateMarketCache = {
        version: 1,
        lastFetched: '2025-01-01',
        templates: [makeCard()],
      };
      expect(getOfflineTemplates(cache)).toHaveLength(1);
    });
  });
});
