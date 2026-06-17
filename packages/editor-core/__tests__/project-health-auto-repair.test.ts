import { describe, expect, it } from 'vitest';
import {
  addMediaFolderToProject,
  applyProjectHealthAutoRepair,
  AutoRepairProjectHealthCommand,
  buildProjectHealthSearchRoots,
  createProject,
  createTrack,
  planMissingMediaAutoRelinks,
  runProjectHealthCheck,
  summarizeProjectHealthRepair,
  type Clip,
  type DuplicateMediaIssue,
  type MediaAsset,
  type Project,
  type ProjectAccessor,
  type ProjectHealthReport
} from '../src';

function asset(input: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'path'>): MediaAsset {
  return {
    id: input.id,
    type: input.type ?? 'video',
    name: input.name ?? input.path.split(/[\\/]/).pop() ?? input.id,
    path: input.path,
    duration: input.duration ?? 6,
    width: input.width ?? 1280,
    height: input.height ?? 720,
    missing: input.missing,
    size: input.size ?? 4096,
    mtimeMs: input.mtimeMs ?? 1000,
    frameRate: input.frameRate,
    variableFrameRate: input.variableFrameRate,
    hasAudio: input.hasAudio ?? true,
    audioChannels: input.audioChannels ?? 2,
    audioSampleRate: input.audioSampleRate ?? 44_100,
    audioCodec: input.audioCodec ?? 'aac',
    videoCodec: input.videoCodec ?? 'h264',
    proxyStatus: input.proxyStatus
  };
}

function clip(id: string, mediaId: string): Clip {
  return {
    id,
    type: 'video',
    name: id,
    trackId: 'track-video',
    mediaId,
    start: 0,
    duration: 6,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    volume: 1,
    muted: false,
    colorCorrection: {},
    transform: { scale: 1, scaleX: 1, scaleY: 1, x: 0, y: 0, rotation: 0, opacity: 1 },
    chromaKey: { enabled: false, color: '#00ff00', similarity: 0.1, blend: 0, spill: 0, mode: 'green' },
    stabilization: { enabled: false, smoothing: 0.3, crop: 0.05 },
    frameInterpolation: { enabled: false, targetFps: 60, mode: 'blend' },
    slowMotionMode: 'off',
    audioDenoise: { enabled: false, strength: 0.5 },
    audioChannelRouting: { mode: 'stereo' },
    videoRestoration: { denoise: false, sharpen: false, deinterlace: false, spatialDenoise: 'off', temporalDenoise: 'off', deinterlaceMode: 'auto' },
    qualityEnhancement: { superResolution: false, deblock: false, colorBoost: false, frameCompensation: false },
    projection: { type: 'rectilinear' },
    panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90 },
    masks: [],
    motionTrack: [],
    border: { enabled: false, color: '#ffffff', width: 0, radius: 0 },
    keyframes: {},
    effects: [],
    fadeInDuration: 0,
    fadeOutDuration: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
    pitchSemitones: 0,
    reverseAudio: false,
    spatialAudio: { enabled: false, x: 0, y: 0, z: 0, roomSize: 0, dampening: 0 }
  } as Clip;
}

function projectFixture(): Project {
  const project = createProject('Health');
  const timeline = {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: 'track-video',
        type: 'video',
        name: 'Video 1',
        clips: [clip('missing-clip', 'missing'), clip('duplicate-clip', 'dup-b')]
      })
    ]
  };
  return {
    ...project,
    media: [
      asset({ id: 'missing', name: 'tiny-video.mp4', path: 'C:/Project/old/tiny-video.mp4', missing: true }),
      asset({ id: 'dup-a', path: 'C:/Project/cam-a/shot.mp4', size: 8000, mtimeMs: 2000 }),
      asset({ id: 'dup-b', path: 'C:/Project/cam-b/shot.mp4', size: 8000, mtimeMs: 2000 }),
      asset({ id: 'orphan', type: 'audio', name: 'unused.wav', path: 'C:/Project/audio/unused.wav', width: 0, height: 0 })
    ],
    timeline,
    sequences: [{ id: project.activeSequenceId, name: 'Main', timeline }]
  };
}

describe('project health auto repair', () => {
  it('builds same-name search roots in original, sibling, then recent priority', () => {
    const roots = buildProjectHealthSearchRoots(projectFixture(), ['D:/RecentMedia']);

    expect(roots.map((root) => [root.kind, root.path])).toEqual([
      ['original', 'C:/Project/old'],
      ['sibling', 'C:/Project'],
      ['recent', 'D:/RecentMedia']
    ]);
  });

  it('plans same-name relinks from candidate paths', () => {
    const project = projectFixture();
    const report = runProjectHealthCheck(project);
    const roots = buildProjectHealthSearchRoots(project, ['D:/RecentMedia']);
    const plan = planMissingMediaAutoRelinks(project, report, ['D:/Other/nope.mov', 'D:/RecentMedia/tiny-video.mp4'], roots);

    expect(plan.replacements).toEqual([
      expect.objectContaining({
        assetId: 'missing',
        candidatePath: 'D:/RecentMedia/tiny-video.mp4',
        rootKind: 'recent'
      })
    ]);
    expect(plan.manualEntries).toHaveLength(0);
  });

  it('reports manual entries when relink planning cannot resolve a missing asset', () => {
    const project = projectFixture();
    const report = runProjectHealthCheck(project);
    const roots = buildProjectHealthSearchRoots(project, ['D:/RecentMedia']);
    const noCandidate = planMissingMediaAutoRelinks(project, report, ['D:/Other/nope.mov'], roots);
    const staleReport: ProjectHealthReport = {
      ...report,
      missingMedia: [{ ...report.missingMedia[0], assetId: 'gone', id: 'missing:gone', name: 'gone.mp4' }]
    };
    const missingRecord = planMissingMediaAutoRelinks(project, staleReport, ['D:/RecentMedia/gone.mp4'], roots);

    expect(noCandidate.replacements).toHaveLength(0);
    expect(noCandidate.manualEntries[0]).toMatchObject({ type: 'missing-media', status: 'manual', assetId: 'missing' });
    expect(missingRecord.replacements).toHaveLength(0);
    expect(missingRecord.manualEntries[0].message).toContain('media record is missing');
  });

  it('applies a batch repair through a command and undoes the whole project change', () => {
    let project = projectFixture();
    const accessor: ProjectAccessor = {
      getProject: () => project,
      setProject: (nextProject) => {
        project = nextProject;
      }
    };
    const report = runProjectHealthCheck(project);
    const command = new AutoRepairProjectHealthCommand(accessor, {
      relinkedAssets: [{ assetId: 'missing', asset: asset({ id: 'replacement', path: 'C:/Relink/tiny-video.mp4' }) }],
      duplicateIssues: report.duplicateMedia,
      orphanAssetIds: report.orphanMedia.map((issue) => issue.assetId),
      unusedFolderName: 'Unused'
    });

    command.execute();

    expect(project.media.find((item) => item.id === 'missing')?.path).toBe('C:/Relink/tiny-video.mp4');
    expect(project.media.some((item) => item.id === 'dup-b')).toBe(false);
    expect(project.timeline.tracks[0].clips.find((item) => item.id === 'duplicate-clip' && 'mediaId' in item)?.mediaId).toBe('dup-a');
    expect(project.mediaFolders.find((folder) => folder.name === 'Unused')).toBeTruthy();
    expect(project.media.find((item) => item.id === 'orphan')?.folderId).toBeTruthy();
    expect(command.report).toMatchObject({ successCount: 4, skippedCount: 0, manualCount: 0 });

    command.undo();

    expect(project.media.find((item) => item.id === 'missing')?.path).toBe('C:/Project/old/tiny-video.mp4');
    expect(project.media.some((item) => item.id === 'dup-b')).toBe(true);
    expect(project.media.find((item) => item.id === 'orphan')?.folderId).toBeUndefined();
  });

  it('summarizes repair report status counts', () => {
    expect(
      summarizeProjectHealthRepair([
        { type: 'missing-media', status: 'success', assetId: 'a', message: 'fixed' },
        { type: 'duplicate-media', status: 'skipped', message: 'skipped' },
        { type: 'orphan-media', status: 'manual', assetId: 'b', message: 'manual' }
      ])
    ).toEqual({
      successCount: 1,
      skippedCount: 1,
      manualCount: 1,
      entries: [
        { type: 'missing-media', status: 'success', assetId: 'a', message: 'fixed' },
        { type: 'duplicate-media', status: 'skipped', message: 'skipped' },
        { type: 'orphan-media', status: 'manual', assetId: 'b', message: 'manual' }
      ]
    });
  });

  it('records skipped duplicate merges and queued proxy repairs', () => {
    const withUnusedFolder = addMediaFolderToProject(projectFixture(), { name: 'Unused' }, '2026-01-01T00:00:00.000Z').project;
    const duplicateWithoutRemovals: DuplicateMediaIssue = {
      type: 'duplicate-media',
      id: 'duplicate:single',
      size: 8000,
      mtimeMs: 2000,
      keepAssetId: 'dup-a',
      assets: [{ assetId: 'dup-a', name: 'shot.mp4', path: 'C:/Project/cam-a/shot.mp4', fileName: 'shot.mp4', references: [] }]
    };
    const result = applyProjectHealthAutoRepair(
      withUnusedFolder,
      {
        duplicateIssues: [duplicateWithoutRemovals],
        orphanAssetIds: ['orphan', 'not-in-project'],
        proxyAssetIds: ['missing'],
        frameRateProxyAssetIds: ['dup-a'],
        manualEntries: [{ type: 'missing-media', assetId: 'ghost', message: 'manual relink required' }],
        unusedFolderName: 'Unused'
      },
      '2026-01-01T00:00:01.000Z'
    );

    expect(result.report).toMatchObject({ successCount: 3, skippedCount: 1, manualCount: 1 });
    expect(result.project.mediaFolders.filter((folder) => folder.name === 'Unused')).toHaveLength(1);
    expect(result.project.media.find((item) => item.id === 'orphan')?.folderId).toBe(
      result.project.mediaFolders.find((folder) => folder.name === 'Unused')?.id
    );
    expect(result.report.entries.map((entry) => entry.type)).toEqual([
      'duplicate-media',
      'orphan-media',
      'proxy-missing',
      'frame-rate-proxy',
      'missing-media'
    ]);
  });
});
