import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — fs/promises for template read & project write, headless-renderer for
// the optional render branch. headless-renderer is a project-local module with
// no concurrent dynamic imports, so vi.mock intercepts it reliably.
// ---------------------------------------------------------------------------

const { readFileMock, writeFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({ readFile: readFileMock, writeFile: writeFileMock }));

const { headlessRenderMock } = vi.hoisted(() => ({ headlessRenderMock: vi.fn() }));
vi.mock('../../src/headless/headless-renderer', () => ({ headlessRender: headlessRenderMock }));

import { loadTemplate, applyTemplate } from '../../src/headless/template-apply';
import type { TemplateDefinition } from '../../src/headless/template-apply';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function buildTemplate(overrides: Partial<TemplateDefinition> = {}): TemplateDefinition {
  return {
    name: 'Test Template',
    version: '1.0',
    description: 'A test template',
    aspectRatio: { width: 1920, height: 1080 },
    fps: 30,
    timeline: {
      tracks: [
        {
          id: 'track-0',
          type: 'video',
          name: 'Video Track',
          clips: [
            { id: 'clip-0', name: 'Placeholder 0', trackId: 'track-0' },
            { id: 'clip-1', name: 'Placeholder 1', trackId: 'track-0' },
          ],
        },
      ],
    },
    slots: [
      { id: 'slot-0', type: 'video', trackIndex: 0, clipIndex: 0, description: 'Main video' },
      { id: 'slot-1', type: 'video', trackIndex: 0, clipIndex: 1, description: 'B-roll' },
    ],
    ...overrides,
  };
}

function setTemplateFile(template: TemplateDefinition) {
  readFileMock.mockResolvedValue(JSON.stringify(template));
}

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    templatePath: '/tmpl.json',
    mediaFiles: ['/media/clipA.mp4', '/media/clipB.mp4'],
    outputProjectPath: '/out/project.json',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadTemplate
// ---------------------------------------------------------------------------

describe('loadTemplate', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset();
  });

  test('loads a valid template definition', async () => {
    setTemplateFile(buildTemplate());
    const tmpl = await loadTemplate('/tmpl.json');
    expect(tmpl.name).toBe('Test Template');
    expect(tmpl.slots).toHaveLength(2);
    expect(tmpl.fps).toBe(30);
  });

  test('throws when readFile fails', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    await expect(loadTemplate('/missing.json')).rejects.toThrow('ENOENT');
  });

  test('throws when content is not valid JSON', async () => {
    readFileMock.mockResolvedValue('not json');
    await expect(loadTemplate('/tmpl.json')).rejects.toThrow();
  });

  test('throws "Invalid template file" when required fields are missing', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ name: 'No timeline or slots' }));
    await expect(loadTemplate('/tmpl.json')).rejects.toThrow('Invalid template file: /tmpl.json');
  });
});

// ---------------------------------------------------------------------------
// applyTemplate — basic flow (no render)
// ---------------------------------------------------------------------------

describe('applyTemplate (no render)', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset();
    headlessRenderMock.mockReset();
  });

  test('applies template and writes project file', async () => {
    setTemplateFile(buildTemplate());
    const result = await applyTemplate(baseRequest());

    expect(result.success).toBe(true);
    expect(result.projectPath).toBe('/out/project.json');
    expect(result.warnings).toEqual([]);
    expect(result.renderResult).toBeUndefined();
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock.mock.calls[0][0]).toBe('/out/project.json');
  });

  test('invokes onProgress with loading → analyzing → done phases', async () => {
    setTemplateFile(buildTemplate());
    const phases: Array<{ phase: string; percent: number }> = [];
    await applyTemplate({ ...baseRequest(), onProgress: (p) => phases.push({ phase: p.phase, percent: p.percent }) });

    expect(phases.map((p) => p.phase)).toEqual(['loading', 'analyzing', 'analyzing', 'done']);
    expect(phases[0]).toMatchObject({ phase: 'loading', percent: 0 });
    expect(phases[3]).toMatchObject({ phase: 'done', percent: 100 });
  });

  test('warns when mediaFiles fewer than slots', async () => {
    setTemplateFile(buildTemplate());
    const result = await applyTemplate(baseRequest({ mediaFiles: ['/media/only.mp4'] }));

    expect(result.warnings).toContain(
      'Template expects 2 media files but only 1 provided',
    );
  });

  test('does not warn when mediaFiles exceed slots', async () => {
    setTemplateFile(buildTemplate());
    const result = await applyTemplate(
      baseRequest({ mediaFiles: ['/a.mp4', '/b.mp4', '/c.mp4'] }),
    );
    expect(result.warnings).toEqual([]);
  });

  test('writeFile receives a ProjectFileV2 with schemaVersion 2', async () => {
    setTemplateFile(buildTemplate());
    await applyTemplate(baseRequest());
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    expect(written.schemaVersion).toBe(2);
    expect(written.project.name).toBe('Template: Test Template');
  });

  test('returns failure when template loading fails', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    const result = await applyTemplate(baseRequest());

    expect(result.success).toBe(false);
    expect(result.projectPath).toBe('');
    expect(result.error).toContain('Failed to load template');
    expect(result.error).toContain('ENOENT');
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyTemplate — render branch
// ---------------------------------------------------------------------------

describe('applyTemplate (render branch)', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset();
    headlessRenderMock.mockReset();
    setTemplateFile(buildTemplate());
  });

  test('renders when render=true and renderOutputPath is set', async () => {
    headlessRenderMock.mockResolvedValue({ success: true, outputPath: '/out/render.mp4', duration: 10, fileSize: 100, warnings: [] });
    const result = await applyTemplate(baseRequest({ render: true, renderOutputPath: '/out/render.mp4' }));

    expect(result.renderResult).toBeDefined();
    expect(result.renderResult!.success).toBe(true);
    expect(result.renderResult!.outputPath).toBe('/out/render.mp4');
    expect(headlessRenderMock).toHaveBeenCalledTimes(1);
  });

  test('propagates render failure into renderResult', async () => {
    headlessRenderMock.mockResolvedValue({ success: false, outputPath: '', duration: 0, fileSize: 0, warnings: [], error: 'FFmpeg not found' });
    const result = await applyTemplate(baseRequest({ render: true, renderOutputPath: '/out/render.mp4' }));

    expect(result.renderResult!.success).toBe(false);
    expect(result.renderResult!.error).toBe('FFmpeg not found');
  });

  test('does not render when render is false', async () => {
    const result = await applyTemplate(baseRequest({ render: false }));
    expect(result.renderResult).toBeUndefined();
    expect(headlessRenderMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// buildProjectFromTemplate (exercised via applyTemplate)
// ---------------------------------------------------------------------------

describe('buildProjectFromTemplate (via applyTemplate)', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset();
    headlessRenderMock.mockReset();
    setTemplateFile(buildTemplate());
  });

  test('project settings derive from template aspectRatio and fps', async () => {
    await applyTemplate(baseRequest());
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    expect(written.project.settings).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      timecodeFormat: 'ndf',
    });
  });

  test('creates one media asset per file with id/name/path/type', async () => {
    await applyTemplate(baseRequest({ mediaFiles: ['/media/clipA.mp4', '/media/song.mp3'] }));
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    expect(written.project.media).toHaveLength(2);
    expect(written.project.media[0]).toMatchObject({ id: 'media-0', name: 'clipA.mp4', path: '/media/clipA.mp4', type: 'video' });
    expect(written.project.media[1]).toMatchObject({ id: 'media-1', name: 'song.mp3', path: '/media/song.mp3', type: 'audio' });
  });

  test('extracts file name from Windows-style backslash paths', async () => {
    await applyTemplate(baseRequest({ mediaFiles: ['C:\\media\\clipB.mp4'] }));
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    expect(written.project.media[0].name).toBe('clipB.mp4');
  });

  test('deep-clones the template timeline (mutations do not leak back)', async () => {
    const template = buildTemplate();
    setTemplateFile(template);
    await applyTemplate(baseRequest());
    // The original template object's timeline should remain untouched
    expect(template.timeline.tracks[0].clips[0]).not.toHaveProperty('mediaPath');
  });
});

// ---------------------------------------------------------------------------
// detectMediaType (exercised via applyTemplate)
// ---------------------------------------------------------------------------

describe('detectMediaType (via applyTemplate)', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset();
    headlessRenderMock.mockReset();
    setTemplateFile(buildTemplate());
  });

  test('classifies .mp3/.wav as audio', async () => {
    await applyTemplate(baseRequest({ mediaFiles: ['/a.mp3', '/b.wav'] }));
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    expect(written.project.media.map((m: { type: string }) => m.type)).toEqual(['audio', 'audio']);
  });

  test('classifies .jpg/.png as image', async () => {
    await applyTemplate(baseRequest({ mediaFiles: ['/a.jpg', '/b.png'] }));
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    expect(written.project.media.map((m: { type: string }) => m.type)).toEqual(['image', 'image']);
  });

  test('classifies .mp4 and unknown extensions as video', async () => {
    await applyTemplate(baseRequest({ mediaFiles: ['/a.mp4', '/b.unknownext'] }));
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    expect(written.project.media.map((m: { type: string }) => m.type)).toEqual(['video', 'video']);
  });
});

// ---------------------------------------------------------------------------
// replaceTimelineMedia (exercised via applyTemplate)
// ---------------------------------------------------------------------------

describe('replaceTimelineMedia (via applyTemplate)', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset();
    headlessRenderMock.mockReset();
    setTemplateFile(buildTemplate());
  });

  test('replaces placeholder clips with mediaId and mediaPath', async () => {
    await applyTemplate(baseRequest({ mediaFiles: ['/media/clipA.mp4', '/media/clipB.mp4'] }));
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    const clips = written.project.timeline.tracks[0].clips;
    expect(clips[0]).toMatchObject({ mediaId: 'media-0', mediaPath: '/media/clipA.mp4' });
    expect(clips[1]).toMatchObject({ mediaId: 'media-1', mediaPath: '/media/clipB.mp4' });
  });

  test('skips slots pointing to non-existent track/clip without error', async () => {
    // Slots point to track 5 / clip 9 which don't exist in the template timeline
    setTemplateFile(buildTemplate({
      slots: [
        { id: 'slot-0', type: 'video', trackIndex: 5, clipIndex: 0, description: 'bad track' },
        { id: 'slot-1', type: 'video', trackIndex: 0, clipIndex: 9, description: 'bad clip' },
      ],
    }));
    const result = await applyTemplate(baseRequest());
    expect(result.success).toBe(true);
    const written = JSON.parse(writeFileMock.mock.calls[0][1] as string);
    // Original clips remain unchanged (no mediaId/mediaPath added)
    expect(written.project.timeline.tracks[0].clips[0]).not.toHaveProperty('mediaPath');
  });
});
