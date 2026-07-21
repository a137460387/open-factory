import { describe, it, expect } from 'vitest';
import {
  exportTemplate,
  importTemplate,
  addUserTemplate,
  removeUserTemplate,
  getAllTemplates,
  searchTemplates,
} from './template-io';
import type { EditingTemplate } from '../models/template-schema';
import { TEMPLATE_SCHEMA_VERSION } from '../models/template-schema';
import { BUILTIN_VLOG_TEMPLATE } from './builtin-templates';

function makeTemplate(overrides: Partial<EditingTemplate> = {}): EditingTemplate {
  return {
    metadata: {
      id: 'test-io-1',
      version: TEMPLATE_SCHEMA_VERSION,
      name: 'IO Test Template',
      description: 'For testing import/export',
      category: 'custom',
      tags: ['test'],
      author: 'Test',
      createdAt: '2026-07-21T00:00:00Z',
      updatedAt: '2026-07-21T00:00:00Z',
      aspectRatio: '16:9',
      resolutionWidth: 1920,
      resolutionHeight: 1080,
      frameRate: 30,
      estimatedDurationSec: 30,
      difficulty: 'beginner',
    },
    tracks: [
      {
        type: 'video',
        name: 'Main',
        clips: [
          {
            type: 'video',
            durationSec: 10,
            flexibleDuration: true,
            placeholder: 'user-video',
            placeholderParams: {},
            effects: [],
            keyframes: [],
            colorNodes: [],
            opacity: 1,
            speed: 1,
            volume: 1,
          },
        ],
        transitions: [],
        trackEffects: [],
        muted: false,
        locked: false,
      },
    ],
    audioLayout: {
      tracks: [{ role: 'voice', volumeDb: -14, pan: 0, fadeInSec: 0, fadeOutSec: 0 }],
      masterLoudnessTarget: -14,
      masterLimiter: true,
    },
    globalColorNodes: [],
    variables: [],
    ...overrides,
  };
}

describe('Template IO', () => {
  describe('exportTemplate / importTemplate', () => {
    it('round-trips a template through export and import', async () => {
      const original = makeTemplate();
      const json = await exportTemplate(original);
      const imported = await importTemplate(json);

      expect(imported.metadata.id).toBe(original.metadata.id);
      expect(imported.metadata.name).toBe(original.metadata.name);
      expect(imported.tracks.length).toBe(original.tracks.length);
    });

    it('produces valid JSON with format identifier', async () => {
      const json = await exportTemplate(makeTemplate());
      const parsed = JSON.parse(json);
      expect(parsed.format).toBe('open-factory-template');
      expect(parsed.schemaVersion).toBe('1.0');
      expect(parsed.template).toBeDefined();
      expect(parsed.checksum).toBeDefined();
    });

    it('rejects invalid template on export', async () => {
      const invalid = makeTemplate({ metadata: { ...makeTemplate().metadata, id: '' } });
      await expect(exportTemplate(invalid)).rejects.toThrow('Invalid template');
    });

    it('rejects non-JSON on import', async () => {
      await expect(importTemplate('not json')).rejects.toThrow('not valid JSON');
    });

    it('rejects wrong format on import', async () => {
      await expect(importTemplate(JSON.stringify({ format: 'wrong' }))).rejects.toThrow('missing format identifier');
    });

    it('rejects corrupted checksum', async () => {
      const json = await exportTemplate(makeTemplate());
      const parsed = JSON.parse(json);
      parsed.checksum = 'corrupted';
      await expect(importTemplate(JSON.stringify(parsed))).rejects.toThrow('checksum mismatch');
    });
  });

  describe('template library', () => {
    it('getAllTemplates returns built-in templates', () => {
      const all = getAllTemplates();
      expect(all.length).toBeGreaterThanOrEqual(3);
      expect(all.some((e) => e.builtin)).toBe(true);
    });

    it('addUserTemplate adds to library', () => {
      const before = getAllTemplates().length;
      addUserTemplate(makeTemplate({ metadata: { ...makeTemplate().metadata, id: 'user-tpl-1' } }));
      const after = getAllTemplates().length;
      expect(after).toBe(before + 1);
    });

    it('removeUserTemplate removes from library', () => {
      addUserTemplate(makeTemplate({ metadata: { ...makeTemplate().metadata, id: 'user-tpl-2' } }));
      const removed = removeUserTemplate('user-tpl-2');
      expect(removed).toBe(true);
    });

    it('searchTemplates filters by category', () => {
      const results = searchTemplates({ category: 'vlog' });
      expect(results.every((e) => e.template.metadata.category === 'vlog')).toBe(true);
    });

    it('searchTemplates filters by query', () => {
      const results = searchTemplates({ query: 'Vlog' });
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
