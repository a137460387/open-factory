import { describe, expect, it } from 'vitest';
import {
  buildVersionedExportReportRows,
  countRunningVersionedBatchTasks,
  createExportTask,
  createVersionedExportJobs,
  expandVersionedExportVariables,
  mergeVersionedExportSettings,
  parseVersionedBatchTemplate,
  serializeVersionedBatchTemplate,
  startExportTaskSlots,
  type FfmpegExportPlan,
  type VersionedExportDefinition
} from '../src';

const plan: FfmpegExportPlan = {
  inputs: [],
  filterComplex: '',
  maps: [],
  outputArgs: ['out.mp4'],
  fullArgs: ['-y', 'out.mp4'],
  warnings: [],
  textArtifacts: [],
  nestedPlans: [],
  duration: 12,
  settings: {
    width: 1920,
    height: 1080,
    fps: 30,
    sampleRate: 44_100,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    outputPath: 'out.mp4',
    format: 'mp4'
  }
};

describe('versioned batch export helpers', () => {
  it('expands version variables in output names and metadata templates', () => {
    const jobs = createVersionedExportJobs({
      batchId: 'batch-a',
      outputPathTemplate: 'C:/Exports/{version_name}-{platform}-{language}.mp4',
      defaultSettings: { width: 1920, height: 1080, format: 'mp4' },
      metadata: { title: '{version_name}', description: '{platform}/{language}' },
      versions: [
        {
          id: 'shorts',
          name: 'Shorts Vertical',
          platform: 'TikTok',
          language: 'zh',
          settings: { width: 1080, height: 1920 }
        }
      ]
    });

    expect(jobs[0]).toMatchObject({
      outputPath: 'C:/Exports/Shorts Vertical-TikTok-zh.mp4',
      metadata: {
        title: 'Shorts Vertical',
        description: 'TikTok/zh'
      }
    });
  });

  it('merges version overrides over the selected preset defaults', () => {
    const settings = mergeVersionedExportSettings(
      { width: 1280, height: 720, format: 'mp4', videoBitrate: '4M' },
      { width: 1920, height: 1080, videoBitrate: '8M' },
      { settings: { height: 1920, watermark: null, subtitleLanguages: ['en'] } }
    );

    expect(settings).toMatchObject({
      width: 1920,
      height: 1920,
      videoBitrate: '8M',
      watermark: null,
      subtitleLanguages: ['en']
    });
  });

  it('serializes reusable .ofbatch templates and parses sanitized versions', () => {
    const versions: VersionedExportDefinition[] = [
      { id: 'a', name: 'A', platform: 'YouTube', language: 'en', presetId: 'web-1080p', settings: { width: 1920, height: 1080 } }
    ];

    const serialized = serializeVersionedBatchTemplate('Campaign', 'D:/Exports/{version_name}.mp4', versions, '2026-06-18T00:00:00.000Z');
    const parsed = parseVersionedBatchTemplate(serialized);

    expect(parsed).toMatchObject({
      version: 1,
      name: 'Campaign',
      outputPathTemplate: 'D:/Exports/{version_name}.mp4',
      versions
    });
  });

  it('counts running versioned tasks after concurrent queue scheduling', () => {
    const tasks = startExportTaskSlots(
      [
        createExportTask({ id: 'a', name: 'A', outputPath: 'a.mp4', plan, versionedBatch: { batchId: 'batch-a', versionId: 'a', versionName: 'A' } }),
        createExportTask({ id: 'b', name: 'B', outputPath: 'b.mp4', plan, versionedBatch: { batchId: 'batch-a', versionId: 'b', versionName: 'B' } }),
        createExportTask({ id: 'c', name: 'C', outputPath: 'c.mp4', plan, versionedBatch: { batchId: 'batch-a', versionId: 'c', versionName: 'C' } })
      ],
      2,
      '2026-06-18T00:00:00.000Z'
    );

    expect(countRunningVersionedBatchTasks(tasks, 'batch-a')).toBe(2);
  });

  it('builds complete comparison report rows for finished versions', () => {
    const [task] = startExportTaskSlots(
      [createExportTask({ id: 'a', name: 'A', outputPath: 'C:/Exports/a.mp4', plan, versionedBatch: { batchId: 'batch-a', versionId: 'a', versionName: 'A', platform: 'YouTube', language: 'en' } })],
      1,
      '2026-06-18T00:00:00.000Z'
    );
    const rows = buildVersionedExportReportRows([{ ...task, status: 'success', finishedAt: '2026-06-18T00:00:03.500Z' }], {
      batchId: 'batch-a',
      fileSizes: { 'C:/Exports/a.mp4': 2048 }
    });

    expect(rows[0]).toEqual({
      batchId: 'batch-a',
      versionId: 'a',
      versionName: 'A',
      platform: 'YouTube',
      language: 'en',
      outputPath: 'C:/Exports/a.mp4',
      status: 'success',
      fileSizeBytes: 2048,
      durationSeconds: 12,
      elapsedMs: 3500,
      width: 1920,
      height: 1080
    });
  });

  it('keeps unknown template variables untouched for user-defined later expansion', () => {
    expect(expandVersionedExportVariables('{version_name}-{missing}', { version_name: 'Main' })).toBe('Main-{missing}');
  });

  it('uses safe path tokens, trims metadata, skips disabled versions, and falls back to defaults', () => {
    const jobs = createVersionedExportJobs({
      batchId: 'batch-safe',
      outputPathTemplate: 'C:/Exports/{version_name}-{platform}-{index}.mp4',
      defaultSettings: { width: 1280, height: 720, format: 'mp4' },
      defaultRange: { start: 2, duration: 5 },
      presetSettingsById: new Map([['vertical', { width: 1080, height: 1920 }]]),
      metadata: { title: ' {version_name} ', author: 'Open Factory' },
      versions: [
        {
          id: 'enabled',
          name: 'Bad:/Name. ',
          platform: '  Shorts  ',
          language: ' zh ',
          presetId: 'vertical',
          metadata: { description: ' Platform {platform} ', copyright: ' ' }
        },
        { id: 'disabled', name: 'Disabled', enabled: false }
      ]
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      outputPath: 'C:/Exports/Bad-Name-Shorts-1.mp4',
      range: { start: 2, duration: 5 },
      settings: { width: 1080, height: 1920, format: 'mp4' },
      metadata: { title: 'Bad:/Name.', author: 'Open Factory', description: 'Platform Shorts' },
      batch: { platform: 'Shorts', language: 'zh' },
      presetId: 'vertical'
    });
  });

  it('sanitizes parsed templates with defaults and drops malformed version entries', () => {
    const parsed = parseVersionedBatchTemplate(
      JSON.stringify({
        version: 1,
        name: ' ',
        outputPathTemplate: '',
        versions: [
          null,
          { id: ' messy ', name: ' ', platform: ' YouTube ', variables: { ' custom ': 'A', empty: 1 }, metadata: { title: ' Title ', author: '' }, settings: { width: 720 } }
        ],
        exportedAt: ''
      })
    );

    expect(parsed).toMatchObject({
      version: 1,
      name: 'Versioned Batch Export',
      outputPathTemplate: './{version_name}.mp4',
      exportedAt: '1970-01-01T00:00:00.000Z',
      versions: [
        {
          id: 'messy',
          name: 'Version',
          enabled: true,
          platform: 'YouTube',
          variables: { custom: 'A' },
          metadata: { title: 'Title' },
          settings: { width: 720 }
        }
      ]
    });
    expect(() => parseVersionedBatchTemplate(JSON.stringify({ version: 2, versions: [] }))).toThrow('Unsupported versioned batch export template.');
  });

  it('reports null comparison fields for incomplete or filtered tasks', () => {
    const task = createExportTask({
      id: 'other',
      name: 'Other',
      outputPath: 'other.mp4',
      plan: { ...plan, duration: Number.NaN, settings: { ...plan.settings, width: Number.NaN, height: Number.NaN } },
      versionedBatch: { batchId: 'batch-b', versionId: 'other', versionName: 'Other' }
    });

    expect(buildVersionedExportReportRows([task], { batchId: 'batch-a' })).toEqual([]);
    expect(buildVersionedExportReportRows([task])).toEqual([
      {
        batchId: 'batch-b',
        versionId: 'other',
        versionName: 'Other',
        outputPath: 'other.mp4',
        status: 'pending',
        fileSizeBytes: null,
        durationSeconds: null,
        elapsedMs: null,
        width: null,
        height: null
      }
    ]);
  });
});
