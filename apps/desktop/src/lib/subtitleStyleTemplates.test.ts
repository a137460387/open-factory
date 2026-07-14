import { describe, expect, it } from 'vitest';
import { DEFAULT_SUBTITLE_STYLE } from '@open-factory/editor-core';
import {
  deleteCustomSubtitleStyleTemplate,
  getSubtitleStyleTemplatesPath,
  loadSubtitleStyleTemplates,
  parseStoredSubtitleStyleTemplates,
  saveCustomSubtitleStyleTemplate,
  serializeCustomSubtitleStyleTemplates,
  type SubtitleStyleTemplateStorage,
} from './subtitleStyleTemplates';

describe('subtitle style template storage', () => {
  it('stores custom templates under AppData', () => {
    expect(getSubtitleStyleTemplatesPath('C:/Users/E2E/AppData/Roaming/open-factory/')).toBe(
      'C:/Users/E2E/AppData/Roaming/open-factory/subtitle-styles.json',
    );
  });

  it('saves loads and deletes custom templates', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);
    const saved = await saveCustomSubtitleStyleTemplate(
      'Review White',
      { ...DEFAULT_SUBTITLE_STYLE, color: '#ffffff', outlineWidth: 2 },
      storage,
    );
    const custom = saved.find((template) => template.kind === 'custom');

    expect(custom).toMatchObject({
      id: 'custom-review-white',
      name: 'Review White',
      style: { color: '#ffffff', outlineWidth: 2 },
    });
    expect(files.get('C:/Users/E2E/AppData/Roaming/open-factory/subtitle-styles.json')).toContain('Review White');

    const loaded = await loadSubtitleStyleTemplates(storage);
    expect(loaded.some((template) => template.id === 'custom-review-white')).toBe(true);

    await deleteCustomSubtitleStyleTemplate('custom-review-white', storage);
    expect(await loadSubtitleStyleTemplates(storage)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'custom-review-white' })]),
    );
  });

  it('sanitizes stored custom templates and ignores malformed files', () => {
    const parsed = parseStoredSubtitleStyleTemplates(
      JSON.stringify({
        schemaVersion: 1,
        templates: [
          { id: 'custom-a', name: 'A', style: { fontSize: 999, color: 'bad' } },
          { id: 1, name: 'bad', style: {} },
        ],
      }),
    );

    expect(parsed).toEqual([
      expect.objectContaining({
        id: 'custom-a',
        style: expect.objectContaining({ fontSize: 200, color: DEFAULT_SUBTITLE_STYLE.color }),
      }),
    ]);
    expect(parseStoredSubtitleStyleTemplates('not-json')).toEqual([]);
  });

  it('serializes only custom templates', () => {
    const serialized = serializeCustomSubtitleStyleTemplates([
      { id: 'cinema-white', kind: 'builtin', name: 'Built-in', style: DEFAULT_SUBTITLE_STYLE },
      { id: 'custom-a', kind: 'custom', name: 'A', style: { ...DEFAULT_SUBTITLE_STYLE, color: '#abcdef' } },
    ]);

    expect(serialized).toContain('"custom-a"');
    expect(serialized).not.toContain('"cinema-white"');
  });
});

function makeStorage(files: Map<string, string>): SubtitleStyleTemplateStorage {
  return {
    getAppDataDir: () => 'C:/Users/E2E/AppData/Roaming/open-factory',
    fsExists: (path) => files.has(path),
    readFile: (path) => files.get(path) ?? '',
    writeFile: (path, contents) => {
      files.set(path, contents);
    },
  };
}
