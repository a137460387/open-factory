import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR_CORRECTION, createMulticamSequenceProject, createTrack, migrateProjectFile, serializeProject, type ProjectFileV1 } from '../src';
import { makeProject, makeSubtitleClip, makeVideoClip } from './test-utils';

describe('project schema migration', () => {
  it('serializes schemaVersion 2 project files with media and relativePath', () => {
    const file = serializeProject(makeProject(), 'C:/Videos/project.cutproj.json');

    expect(file.schemaVersion).toBe(2);
    expect(file.project.media[0].relativePath).toBe('sample.mp4');
    expect(file.project.media[0].originalAbsolutePath).toBe('C:/Videos/sample.mp4');
  });

  it('keeps absolute path and warning when media is on another drive', () => {
    const file = serializeProject(makeProject(), 'D:/Projects/project.cutproj.json');

    expect(file.project.media[0].relativePath).toBeNull();
    expect(file.warnings?.[0]).toContain('different drive');
  });

  it('migrates legacy assets to project media', () => {
    const project = makeProject();
    const legacy: ProjectFileV1 = {
      version: '0.1',
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        settings: project.settings
      },
      assets: project.media,
      timeline: project.timeline
    };

    const migrated = migrateProjectFile(legacy);
    expect(migrated.project.version).toBe('0.2');
    expect(migrated.project.media[0].path).toBe('C:/Videos/sample.mp4');
    expect(migrated.project.mediaMetadata).toEqual({});
    expect(migrated.warnings[0]).toContain('legacy');
  });

  it('serializes and migrates media metadata labels', () => {
    const project = makeProject();
    project.mediaMetadata = {
      'asset-1': { labelColor: 'blue' },
      'missing-asset': { labelColor: 'red' },
      invalid: { labelColor: 'cyan' as never }
    };

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.mediaMetadata).toEqual({ 'asset-1': { labelColor: 'blue' } });
    expect(migrated.project.mediaMetadata).toEqual({ 'asset-1': { labelColor: 'blue' } });
  });

  it('backfills missing text background style defaults during migration', () => {
    const project = makeProject();
    const textClip = {
      id: 'legacy-text',
      type: 'text' as const,
      name: 'Legacy Text',
      trackId: 'track-text',
      start: 0,
      duration: 2,
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      text: 'Legacy',
      style: {
        fontSize: 32,
        color: '#ffffff',
        fontFamily: 'Arial',
        bold: false,
        italic: false
      }
    };
    project.timeline.tracks[2].clips = [textClip as never];

    const migrated = migrateProjectFile(serializeProject(project));
    const migratedText = migrated.project.timeline.tracks[2].clips[0];

    expect(migratedText.type).toBe('text');
    if (migratedText.type === 'text') {
      expect(migratedText.style.backgroundColor).toBe('#000000');
      expect(migratedText.style.backgroundOpacity).toBe(0);
    }
  });

  it('backfills missing subtitle style and mode defaults during migration', () => {
    const project = makeProject();
    const subtitleClip = makeSubtitleClip({ id: 'legacy-subtitle', text: 'Legacy subtitle' });
    delete (subtitleClip as Partial<typeof subtitleClip>).subtitleMode;
    delete (subtitleClip.style as Partial<typeof subtitleClip.style>).backgroundOpacity;
    delete (subtitleClip.style as Partial<typeof subtitleClip.style>).yOffset;
    project.timeline.tracks.push(createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitles 1', clips: [subtitleClip] }));

    const migrated = migrateProjectFile(serializeProject(project));
    const migratedSubtitle = migrated.project.timeline.tracks.at(-1)?.clips[0];

    expect(migratedSubtitle?.type).toBe('subtitle');
    if (migratedSubtitle?.type === 'subtitle') {
      expect(migratedSubtitle.subtitleMode).toBe('burn-in');
      expect(migratedSubtitle.style.backgroundOpacity).toBe(0.55);
      expect(migratedSubtitle.style.yOffset).toBe(72);
    }
  });

  it('backfills clip speed and color correction defaults during migration', () => {
    const project = makeProject();
    const legacyClip = { ...project.timeline.tracks[0].clips[0] };
    delete (legacyClip as Partial<typeof legacyClip>).speed;
    delete (legacyClip as Partial<typeof legacyClip>).colorCorrection;
    project.timeline.tracks[0].clips = [legacyClip as never];

    const migrated = migrateProjectFile(serializeProject(project));
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(clip.speed).toBe(1);
    expect(clip.colorCorrection).toEqual(DEFAULT_COLOR_CORRECTION);
  });

  it('serializes and migrates stabilization and PNG sequence metadata', () => {
    const project = makeProject();
    project.media[0] = {
      id: 'asset-sequence',
      type: 'image',
      name: 'frame001.png 序列',
      path: 'C:\\Media\\frame001.png',
      duration: 0.1,
      width: 640,
      height: 360,
      imageSequence: {
        pattern: 'C:\\Media\\frame%03d.png',
        startNumber: 1,
        frameCount: 3,
        frameRate: 24,
        paths: ['C:\\Media\\frame001.png', 'C:\\Media\\frame002.png', 'C:\\Media\\frame003.png']
      }
    };
    project.timeline.tracks[0].clips[0] = {
      ...project.timeline.tracks[0].clips[0],
      type: 'image',
      mediaId: 'asset-sequence',
      stabilization: { enabled: true, smoothing: 120, zoom: -1, analyzed: true, trfPath: ' C:\\Temp\\clip.trf ' },
      frameInterpolation: { enabled: true, targetFps: 999 },
      sequenceFrameRate: 240
    } as never;

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(file.project.media[0].imageSequence?.paths[0]).toBe('C:/Media/frame001.png');
    expect(migrated.project.media[0].imageSequence).toMatchObject({ pattern: 'C:/Media/frame%03d.png', frameRate: 24, frameCount: 3 });
    expect(clip.stabilization).toEqual({ enabled: true, smoothing: 100, zoom: 0, analyzed: true, trfPath: 'C:\\Temp\\clip.trf' });
    expect(clip.frameInterpolation).toEqual({ enabled: true, targetFps: 60 });
    expect(clip.sequenceFrameRate).toBe(120);
  });

  it('serializes and migrates multicam metadata on nested sequence clips', () => {
    const project = makeProject();
    project.media.push({
      id: 'asset-b',
      type: 'video',
      name: 'camera-b.mp4',
      path: 'C:\\Videos\\camera-b.mp4',
      duration: 20,
      width: 1920,
      height: 1080,
      hasAudio: true
    });
    project.timeline.tracks = [
      createTrack({ id: 'track-a', type: 'video', name: 'Camera A', clips: [makeVideoClip({ id: 'clip-a', trackId: 'track-a', mediaId: 'asset-1', duration: 4 })] }),
      createTrack({ id: 'track-b', type: 'video', name: 'Camera B', clips: [makeVideoClip({ id: 'clip-b', trackId: 'track-b', mediaId: 'asset-b', duration: 4 })] })
    ];
    const multicamProject = createMulticamSequenceProject(project, ['clip-a', 'clip-b'], { sequenceName: 'Multicam' }).project;
    const multicamClip = multicamProject.timeline.tracks[0].clips[0];
    if (multicamClip.type !== 'nested-sequence' || !multicamClip.multicam) {
      throw new Error('Expected multicam nested clip');
    }
    multicamClip.multicam.switches.push({ id: 'switch-out-of-range', time: 99, angleId: 'missing-angle' });

    const migrated = migrateProjectFile(serializeProject(multicamProject));
    const migratedClip = migrated.project.timeline.tracks[0].clips[0];

    expect(migratedClip.type).toBe('nested-sequence');
    if (migratedClip.type === 'nested-sequence') {
      expect(migratedClip.multicam?.angles).toHaveLength(2);
      expect(migratedClip.multicam?.switches).toEqual([
        expect.objectContaining({ time: 0, angleId: 'angle-1' }),
        { id: 'switch-out-of-range', time: 4, angleId: 'angle-1' }
      ]);
    }
  });

  it('resolves archived relative PNG sequence paths from the project file directory', () => {
    const project = makeProject();
    project.media[0] = {
      id: 'asset-sequence',
      type: 'image',
      name: 'frame001.png',
      path: 'media/frame001.png',
      relativePath: 'media/frame001.png',
      duration: 0.1,
      width: 640,
      height: 360,
      imageSequence: {
        pattern: 'media/frame%03d.png',
        startNumber: 1,
        frameCount: 2,
        frameRate: 24,
        paths: ['media/frame001.png', 'media/frame002.png']
      }
    };

    const migrated = migrateProjectFile(serializeProject(project), 'C:/Projects/Demo_archive/Demo.cutproj.json');

    expect(migrated.project.media[0].path).toBe('C:/Projects/Demo_archive/media/frame001.png');
    expect(migrated.project.media[0].imageSequence?.pattern).toBe('C:/Projects/Demo_archive/media/frame%03d.png');
    expect(migrated.project.media[0].imageSequence?.paths).toEqual([
      'C:/Projects/Demo_archive/media/frame001.png',
      'C:/Projects/Demo_archive/media/frame002.png'
    ]);
  });

  it('normalizes timeline markers during migration', () => {
    const project = makeProject();
    project.timeline.markers = [
      { id: 'marker-late', time: 99, label: '  ', color: 'orange' },
      { id: 'marker-early', time: 1, label: 'Intro', color: '#3366FF' }
    ];

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.markers).toEqual([
      { id: 'marker-early', time: 1, label: 'Intro', color: '#3366ff' },
      { id: 'marker-late', time: 10, label: 'Marker', color: '#f97316' }
    ]);
  });

  it('preserves clip LUT paths during migration', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips[0].colorCorrection = {
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0,
      lutPath: 'C:\\LUTs\\cinematic.cube'
    };

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0].clips[0].colorCorrection.lutPath).toBe('C:\\LUTs\\cinematic.cube');
  });

  it('backfills track control defaults during migration', () => {
    const project = makeProject();
    const legacyTrack = { ...project.timeline.tracks[0] };
    delete (legacyTrack as Partial<typeof legacyTrack>).muted;
    delete (legacyTrack as Partial<typeof legacyTrack>).solo;
    delete (legacyTrack as Partial<typeof legacyTrack>).locked;
    delete (legacyTrack as Partial<typeof legacyTrack>).volume;
    delete (legacyTrack as Partial<typeof legacyTrack>).pan;
    delete (legacyTrack as Partial<typeof legacyTrack>).eq;
    delete (legacyTrack as Partial<typeof legacyTrack>).compressor;
    project.timeline.tracks[0] = legacyTrack;

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0]).toMatchObject({ muted: false, solo: false, locked: false, volume: 1, pan: 0 });
    expect(migrated.project.timeline.tracks[0].eq).toMatchObject({ enabled: true, bands: expect.arrayContaining([expect.objectContaining({ type: 'lowshelf', gain: 0 })]) });
    expect(migrated.project.timeline.tracks[0].compressor).toMatchObject({ enabled: false, threshold: -18, ratio: 3, attack: 10, release: 120, makeupGain: 0 });
  });

  it('normalizes track EQ and compressor data during migration', () => {
    const project = makeProject();
    project.timeline.tracks[0].eq = {
      enabled: true,
      bands: [
        { id: 'low', type: 'lowshelf', frequency: 1, gain: 50, q: 0.01 },
        { id: 'mid', type: 'peaking', frequency: 1000, gain: -5, q: 1 },
        { id: 'presence', type: 'peaking', frequency: 2500, gain: 0, q: 1 },
        { id: 'high', type: 'highshelf', frequency: 100000, gain: -50, q: 9 }
      ]
    };
    project.timeline.tracks[0].compressor = { enabled: true, threshold: 9, ratio: 99, attack: -1, release: 99_999, makeupGain: 99 };

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0].eq?.bands[0]).toMatchObject({ frequency: 20, gain: 24, q: 0.1 });
    expect(migrated.project.timeline.tracks[0].eq?.bands[3]).toMatchObject({ frequency: 20000, gain: -24, q: 4 });
    expect(migrated.project.timeline.tracks[0].compressor).toMatchObject({ threshold: 0, ratio: 20, attack: 0.01, release: 9000, makeupGain: 24 });
  });

  it('backfills and clamps project master volume during migration', () => {
    const project = makeProject();
    project.masterVolume = 3;

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.masterVolume).toBe(2);
    expect(migrateProjectFile({ ...serializeProject(project), project: { ...serializeProject(project).project, masterVolume: undefined } }).project.masterVolume).toBe(1);
  });

  it('backfills and clamps transition data during migration', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips[0].duration = 2;
    project.timeline.tracks[0].clips.push({ ...project.timeline.tracks[0].clips[0], id: 'clip-2', start: 2 });
    project.timeline.transitions = [{ id: 'transition-1', type: 'dissolve', duration: 3, fromClipId: 'clip-1', toClipId: 'clip-2' }];

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.transitions).toEqual([{ id: 'transition-1', type: 'dissolve', duration: 1, fromClipId: 'clip-1', toClipId: 'clip-2' }]);
  });

  it('preserves transition data that cannot be matched during migration', () => {
    const project = makeProject();
    project.timeline.transitions = [{ id: 'orphan-transition', type: 'dissolve', duration: 0.25, fromClipId: 'missing-a', toClipId: 'missing-b' }];

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.transitions).toEqual(project.timeline.transitions);
  });
});
