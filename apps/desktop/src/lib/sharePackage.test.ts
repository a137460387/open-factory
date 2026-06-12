import { describe, expect, it, vi } from 'vitest';
import { createProject, type ExportTask, type FfmpegExportPlan, type MediaAsset } from '@open-factory/editor-core';
import { buildSharePackageRequest, createSharePackageFromProject, type SharePackageWorkflowDependencies } from './sharePackage';

function makeVideoAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: overrides.id ?? 'asset-1',
    type: 'video',
    name: overrides.name ?? 'clip.mp4',
    path: overrides.path ?? 'C:/Media/clip.mp4',
    duration: overrides.duration ?? 4,
    width: overrides.width ?? 1280,
    height: overrides.height ?? 720,
    ...overrides
  };
}

function makeProject() {
  const project = createProject('Share Demo');
  project.media = [makeVideoAsset()];
  return project;
}

function makeTask(status: ExportTask['status'], progress: number): ExportTask {
  return {
    id: 'export-task-1',
    name: 'share.mp4',
    outputPath: 'C:/AppData/open-factory/Share Demo-share-123.mp4',
    plan: makePlan(),
    status,
    progress,
    createdAt: '2026-06-12T00:00:00.000Z'
  };
}

function makePlan(): FfmpegExportPlan {
  return {
    inputs: [],
    filterComplex: '',
    maps: [],
    outputArgs: [],
    fullArgs: ['-y', 'C:/AppData/open-factory/Share Demo-share-123.mp4'],
    passes: [],
    warnings: [],
    textArtifacts: [],
    nestedPlans: [],
    duration: 4
  };
}

function makeDependencies(overrides: Partial<SharePackageWorkflowDependencies> = {}): SharePackageWorkflowDependencies {
  return {
    chooseOutputPath: vi.fn(() => 'C:/Exports/share.zip'),
    getAppDataDir: vi.fn(() => 'C:/AppData/open-factory'),
    enqueueExport: vi.fn(() => makeTask('pending', 0)),
    waitForExportTask: vi.fn(async (_taskId, onProgress) => {
      onProgress?.(makeTask('running', 0.5));
      onProgress?.(makeTask('success', 1));
      return makeTask('success', 1);
    }),
    createSharePackageZip: vi.fn(async (request) => ({ outputPath: request.outputPath, fileCount: 3 + request.mediaFiles.length, durationMs: 7 })),
    removeFile: vi.fn(),
    listenToPackageProgress: vi.fn((handler) => {
      handler({ stage: 'finished', progress: 1, progressPct: 100, current: 3, total: 3, outputPath: 'C:/Exports/share.zip' });
      return () => undefined;
    }),
    now: vi.fn(() => 123),
    ...overrides
  };
}

describe('share package', () => {
  it('builds a package request with a relative project file, media entries, MP4, and README', () => {
    const request = buildSharePackageRequest(makeProject(), 'C:/Exports/share.zip', 'C:/AppData/open-factory/share.mp4');
    const projectFile = JSON.parse(request.projectContents) as { project: { media: Array<{ path: string }> } };

    expect(request.outputPath).toBe('C:/Exports/share.zip');
    expect(request.projectFileName).toBe('Share Demo.cutproj.json');
    expect(projectFile.project.media[0].path).toBe('media/clip.mp4');
    expect(request.mediaFiles).toEqual([{ sourcePath: 'C:/Media/clip.mp4', archivePath: 'media/clip.mp4' }]);
    expect(request.exportedVideo).toEqual({ sourcePath: 'C:/AppData/open-factory/share.mp4', archivePath: 'export/Share Demo.mp4' });
    expect(request.readmeContents).toContain('Share Demo');
    expect(request.readmeContents).toContain('Share Demo.cutproj.json');
  });

  it('returns without exporting when the save dialog is canceled', async () => {
    const dependencies = makeDependencies({ chooseOutputPath: vi.fn(() => undefined) });

    await expect(createSharePackageFromProject(makeProject(), { dependencies })).resolves.toBeUndefined();

    expect(dependencies.enqueueExport).not.toHaveBeenCalled();
    expect(dependencies.createSharePackageZip).not.toHaveBeenCalled();
  });

  it('exports to a temporary MP4, packages it, reports progress, and removes the temporary export', async () => {
    const progressStages: string[] = [];
    const dependencies = makeDependencies();

    const result = await createSharePackageFromProject(makeProject(), {
      dependencies,
      onProgress: (progress) => progressStages.push(progress.stage)
    });

    expect(result?.outputPath).toBe('C:/Exports/share.zip');
    expect(dependencies.enqueueExport).toHaveBeenCalledWith(
      expect.anything(),
      'C:/AppData/open-factory/Share Demo-share-123.mp4',
      expect.objectContaining({ format: 'mp4', outputMode: 'video', hardwareEncoding: false })
    );
    expect(dependencies.createSharePackageZip).toHaveBeenCalledWith(expect.objectContaining({ outputPath: 'C:/Exports/share.zip' }));
    expect(dependencies.removeFile).toHaveBeenCalledWith('C:/AppData/open-factory/Share Demo-share-123.mp4');
    expect(progressStages).toEqual(expect.arrayContaining(['exporting', 'finished']));
  });

  it('does not package when the queued export fails', async () => {
    const dependencies = makeDependencies({
      waitForExportTask: vi.fn(async () => {
        throw new Error('Export failed.');
      })
    });

    await expect(createSharePackageFromProject(makeProject(), { dependencies })).rejects.toThrow('Export failed.');

    expect(dependencies.createSharePackageZip).not.toHaveBeenCalled();
    expect(dependencies.removeFile).toHaveBeenCalledWith('C:/AppData/open-factory/Share Demo-share-123.mp4');
  });
});
