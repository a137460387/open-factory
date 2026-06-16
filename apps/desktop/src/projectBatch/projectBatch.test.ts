import { describe, expect, it } from 'vitest';
import { DEFAULT_SUBTITLE_MODE, DEFAULT_SUBTITLE_STYLE, createProject, createTrack, type Project } from '@open-factory/editor-core';
import {
  buildProjectBatchQueue,
  replaceProjectMediaPathPrefix,
  runProjectBatchQueue,
  serializeProjectBatchReport,
  updateProjectSubtitleStyle
} from './projectBatch';

describe('project batch processing helpers', () => {
  it('replaces media path prefixes for portable project repair', () => {
    const project = makeProject();
    const result = replaceProjectMediaPathPrefix(project, 'D:/OldRoot', 'E:/NewRoot');

    expect(result.changedCount).toBe(2);
    expect(result.project.media[0].path).toBe('E:/NewRoot/media/a.mp4');
    expect(result.project.media[0].proxyPath).toBe('E:/NewRoot/proxy/a.mp4');
    expect(result.project.media[0].missing).toBe(false);
    expect(result.project.media[1].imageSequence?.paths[0]).toBe('E:/NewRoot/seq/frame001.png');
  });

  it('builds one queue task per unique project path', () => {
    const tasks = buildProjectBatchQueue(['C:/Projects/A.cutproj.json', 'C:/Projects/A.cutproj.json', 'C:/Projects/B.json'], {
      operation: 'batch-export',
      outputDirectory: 'C:/Exports/'
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ id: 'project-batch-batch-export-1', outputPath: 'C:/Exports/A.mp4' });
    expect(tasks[1]).toMatchObject({ id: 'project-batch-batch-export-2', outputPath: 'C:/Exports/B.mp4' });
  });

  it('continues processing when one project fails', async () => {
    const tasks = buildProjectBatchQueue(['C:/Projects/ok.cutproj.json', 'C:/Projects/bad.cutproj.json', 'C:/Projects/later.cutproj.json'], {
      operation: 'cover-frame',
      outputDirectory: 'C:/Covers'
    });
    const report = await runProjectBatchQueue(tasks, async (task) => {
      if (task.projectPath.includes('bad')) {
        throw new Error('read failed');
      }
      return { projectName: task.projectPath, outputPath: task.outputPath };
    });

    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.results[2].status).toBe('success');
  });

  it('serializes report counts and failure reasons', async () => {
    const tasks = buildProjectBatchQueue(['C:/Projects/ok.cutproj.json', 'C:/Projects/skip.cutproj.json'], {
      operation: 'replace-media-prefix',
      pathPrefix: { from: 'D:/Old', to: 'E:/New' }
    });
    const report = await runProjectBatchQueue(tasks, (task) =>
      task.projectPath.includes('skip')
        ? { status: 'skipped', message: '没有匹配路径' }
        : { projectName: 'OK', changedCount: 2 }
    );
    const parsed = JSON.parse(serializeProjectBatchReport(report)) as {
      summary: { total: number; succeeded: number; failed: number; skipped: number };
      results: Array<{ status: string; message?: string }>;
    };

    expect(parsed.summary).toEqual({ total: 2, succeeded: 1, failed: 0, skipped: 1 });
    expect(parsed.results[1]).toMatchObject({ status: 'skipped', message: '没有匹配路径' });
  });

  it('updates subtitle styles in every subtitle clip', () => {
    const project = makeProject();
    const result = updateProjectSubtitleStyle(project, { fontSize: 52, color: '#ffcc00', bold: true });

    expect(result.changedCount).toBe(1);
    const subtitle = result.project.timeline.tracks[1].clips[0];
    expect(subtitle.type).toBe('subtitle');
    if (subtitle.type === 'subtitle') {
      expect(subtitle.style.fontSize).toBe(52);
      expect(subtitle.style.color).toBe('#ffcc00');
      expect(subtitle.style.bold).toBe(true);
    }
  });
});

function makeProject(): Project {
  const base = createProject('Batch Project');
  return {
    ...base,
    media: [
      {
        id: 'media-a',
        type: 'video',
        name: 'a.mp4',
        path: 'D:/OldRoot/media/a.mp4',
        originalAbsolutePath: 'D:/OldRoot/media/a.mp4',
        proxyPath: 'D:/OldRoot/proxy/a.mp4',
        duration: 4,
        width: 1280,
        height: 720,
        missing: true
      },
      {
        id: 'media-seq',
        type: 'image',
        name: 'frame001.png',
        path: 'D:/OldRoot/seq/frame001.png',
        duration: 1,
        width: 1280,
        height: 720,
        missing: true,
        imageSequence: {
          pattern: 'D:/OldRoot/seq/frame%03d.png',
          startNumber: 1,
          frameCount: 2,
          frameRate: 24,
          paths: ['D:/OldRoot/seq/frame001.png', 'D:/OldRoot/seq/frame002.png']
        }
      }
    ],
    timeline: {
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video', clips: [] }),
        createTrack({
          id: 'track-subtitle',
          type: 'subtitle',
          name: 'Subtitles',
          clips: [
            {
              id: 'subtitle-1',
              type: 'subtitle',
              name: '字幕 1',
              trackId: 'track-subtitle',
              start: 0,
              duration: 2,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
              transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
              text: '字幕',
              style: { ...DEFAULT_SUBTITLE_STYLE },
              subtitleMode: DEFAULT_SUBTITLE_MODE
            }
          ]
        })
      ]
    }
  };
}
