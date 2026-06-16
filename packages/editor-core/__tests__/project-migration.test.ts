import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIP_BORDER, DEFAULT_COLOR_CORRECTION, DEFAULT_CREDITS_ROLL_SPEED, DEFAULT_CREDITS_STYLE, DEFAULT_SUBTITLE_LANGUAGE, DEFAULT_SUBTITLE_STYLE, DEFAULT_VIDEO_RESTORATION, createMulticamSequenceProject, createTrack, migrateProjectFile, serializeProject, type ProjectFileV1 } from '../src';
import { makeAdjustmentClip, makeCreditsClip, makeProject, makeSubtitleClip, makeTextClip, makeVideoClip } from './test-utils';

describe('project schema migration', () => {
  it('serializes schemaVersion 2 project files with media and relativePath', () => {
    const file = serializeProject(makeProject(), 'C:/Videos/project.cutproj.json');

    expect(file.schemaVersion).toBe(2);
    expect(file.project.media[0].relativePath).toBe('sample.mp4');
    expect(file.project.media[0].originalAbsolutePath).toBe('C:/Videos/sample.mp4');
  });

  it('serializes and migrates project timecode settings with legacy fallback', () => {
    const project = makeProject();
    project.settings = { ...project.settings, fps: 29.97, timecodeFormat: 'df', vfrHandling: 'auto-cfr' };
    const file = serializeProject(project);

    expect(file.project.settings).toMatchObject({ fps: 29.97, timecodeFormat: 'df', vfrHandling: 'auto-cfr' });

    delete (file.project.settings as Partial<typeof file.project.settings>).timecodeFormat;
    delete (file.project.settings as Partial<typeof file.project.settings>).vfrHandling;
    file.project.settings.fps = 24;

    const migrated = migrateProjectFile(file);

    expect(migrated.project.settings).toMatchObject({ fps: 24, timecodeFormat: 'ndf', vfrHandling: 'ignore' });
  });

  it('serializes and migrates project color pipeline with SDR fallback', () => {
    const project = makeProject();
    project.settings = { ...project.settings, colorPipeline: 'aces' };
    const file = serializeProject(project);

    expect(file.project.settings.colorPipeline).toBe('aces');
    expect(migrateProjectFile(file).project.settings.colorPipeline).toBe('aces');

    delete (file.project.settings as Partial<typeof file.project.settings>).colorPipeline;
    expect(migrateProjectFile(file).project.settings.colorPipeline).toBe('sdr-srgb');

    file.project.settings.colorPipeline = 'invalid' as never;
    expect(migrateProjectFile(file).project.settings.colorPipeline).toBe('sdr-srgb');
  });

  it('serializes and migrates local clip content analysis while old clips remain unset', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-content',
        contentAnalysis: {
          version: 1,
          analyzedAt: '2026-06-16T00:00:00.000Z',
          sceneTypes: ['dialogue'],
          primarySceneType: 'dialogue',
          segments: [{ start: 0, end: 2, sceneTypes: ['dialogue'], brightness: 0.48, motion: 0.12, loudness: 0.4 }],
          emotionCurve: [{ time: 0, value: 0.3, brightness: 0.48 }],
          dialogueTurns: [{ start: 0.1, end: 1.6, loudness: 0.4 }]
        }
      })
    ];
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];

    const file = serializeProject(project);
    expect(file.project.timeline.tracks[0].clips[0].contentAnalysis?.primarySceneType).toBe('dialogue');
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].contentAnalysis?.sceneTypes).toEqual(['dialogue']);

    delete file.project.timeline.tracks[0].clips[0].contentAnalysis;
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].contentAnalysis).toBeUndefined();

    file.project.timeline.tracks[0].clips[0].contentAnalysis = { sceneTypes: ['invalid'] } as never;
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].contentAnalysis?.sceneTypes).toEqual(['indoor']);
  });

  it('serializes and migrates clip blend mode with normal fallback for old projects', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-blend', blendMode: 'overlay' })];
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];

    const file = serializeProject(project);
    expect(file.project.timeline.tracks[0].clips[0].blendMode).toBe('overlay');
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].blendMode).toBe('overlay');

    delete file.project.timeline.tracks[0].clips[0].blendMode;
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].blendMode).toBe('normal');

    file.project.timeline.tracks[0].clips[0].blendMode = 'invalid' as never;
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].blendMode).toBe('normal');
  });

  it('serializes and migrates export ranges while old project files default to none', () => {
    const project = makeProject();
    project.exportRanges = [
      { id: 'range-b', label: '  Outro  ', start: 8, end: 4 },
      { id: 'range-a', label: '', start: 1, end: 3 }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.exportRanges).toEqual([
      { id: 'range-a', label: 'Export Range', start: 1, end: 3 },
      { id: 'range-b', label: 'Outro', start: 4, end: 8 }
    ]);
    expect(migrated.project.exportRanges).toEqual(file.project.exportRanges);

    delete file.project.exportRanges;
    expect(migrateProjectFile(file).project.exportRanges).toEqual([]);
  });

  it('serializes and migrates protected ranges while old project files default to none', () => {
    const project = makeProject();
    project.protectedRanges = [
      { id: 'protect-b', label: '  Chorus  ', start: 9, end: 4 },
      { id: 'protect-a', label: '', start: 1, end: 3 }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.protectedRanges).toEqual([
      { id: 'protect-a', label: 'Protected Range', start: 1, end: 3 },
      { id: 'protect-b', label: 'Chorus', start: 4, end: 9 }
    ]);
    expect(migrated.project.protectedRanges).toEqual(file.project.protectedRanges);

    delete file.project.protectedRanges;
    expect(migrateProjectFile(file).project.protectedRanges).toEqual([]);
  });

  it('serializes and migrates clip groups while old project files default to none', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 3, duration: 2 })];
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];
    project.clipGroups = [
      { id: 'group-a', name: '  A Roll  ', clipIds: ['clip-a', 'clip-b'], color: 'green' },
      { id: 'group-invalid', name: 'Invalid', clipIds: ['clip-a', 'missing'], color: 'rose' }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.clipGroups).toEqual([{ id: 'group-a', name: 'A Roll', clipIds: ['clip-a', 'clip-b'], color: 'green' }]);
    expect(migrated.project.clipGroups).toEqual(file.project.clipGroups);

    delete file.project.clipGroups;
    expect(migrateProjectFile(file).project.clipGroups).toEqual([]);
  });

  it('serializes and migrates timeline color labels while old projects default to null', () => {
    const project = makeProject();
    project.timeline.tracks[0] = {
      ...project.timeline.tracks[0],
      color: 'purple',
      clips: [{ ...makeVideoClip({ id: 'clip-color' }), colorLabel: 'cyan' }]
    };
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];

    const file = serializeProject(project);
    expect(file.project.timeline.tracks[0].color).toBe('purple');
    expect(file.project.timeline.tracks[0].clips[0].colorLabel).toBe('cyan');

    const migrated = migrateProjectFile(file);
    expect(migrated.project.timeline.tracks[0].color).toBe('purple');
    expect(migrated.project.timeline.tracks[0].clips[0].colorLabel).toBe('cyan');

    delete file.project.timeline.tracks[0].color;
    delete file.project.timeline.tracks[0].clips[0].colorLabel;
    const oldProject = migrateProjectFile(file).project;
    expect(oldProject.timeline.tracks[0].color).toBeNull();
    expect(oldProject.timeline.tracks[0].clips[0].colorLabel).toBeNull();
  });

  it('fills subtitle outline and shadow style defaults for old subtitle clips', () => {
    const project = makeProject();
    project.timeline.tracks.push(createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitles', clips: [makeSubtitleClip({ id: 'subtitle-old' })] }));
    const file = serializeProject(project);
    const subtitle = file.project.timeline.tracks.at(-1)?.clips[0];
    if (subtitle?.type === 'subtitle') {
      delete (subtitle.style as Partial<typeof subtitle.style>).outlineColor;
      delete (subtitle.style as Partial<typeof subtitle.style>).outlineWidth;
      delete (subtitle.style as Partial<typeof subtitle.style>).shadowColor;
      delete (subtitle.style as Partial<typeof subtitle.style>).shadowOffset;
    }

    const migrated = migrateProjectFile(file).project.timeline.tracks.at(-1)?.clips[0];

    expect(migrated).toMatchObject({
      type: 'subtitle',
      style: {
        outlineColor: DEFAULT_SUBTITLE_STYLE.outlineColor,
        outlineWidth: DEFAULT_SUBTITLE_STYLE.outlineWidth,
        shadowColor: DEFAULT_SUBTITLE_STYLE.shadowColor,
        shadowOffset: DEFAULT_SUBTITLE_STYLE.shadowOffset
      }
    });
  });

  it('fills subtitle track language defaults for old subtitle tracks', () => {
    const project = makeProject();
    project.timeline.tracks.push(createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitles', clips: [makeSubtitleClip({ id: 'subtitle-old' })] }));
    const file = serializeProject(project);
    delete file.project.timeline.tracks[file.project.timeline.tracks.length - 1].language;

    const migrated = migrateProjectFile(file).project.timeline.tracks.at(-1);

    expect(migrated).toMatchObject({
      type: 'subtitle',
      language: DEFAULT_SUBTITLE_LANGUAGE
    });
  });

  it('serializes and migrates clip borders while old clips default to disabled borders', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-pip', border: { enabled: true, color: '#ABCDEF', width: 999 } })];

    const file = serializeProject(project);
    expect(file.project.timeline.tracks[0].clips[0].border).toEqual({ enabled: true, color: '#abcdef', width: 80 });
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].border).toEqual(file.project.timeline.tracks[0].clips[0].border);

    delete file.project.timeline.tracks[0].clips[0].border;
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].border).toEqual(DEFAULT_CLIP_BORDER);
  });

  it('serializes and migrates audio channel routing while old clips default to normal', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-routed', audioChannelRouting: 'swap-stereo' })];

    const file = serializeProject(project);
    expect(file.project.timeline.tracks[0].clips[0].audioChannelRouting).toBe('swap-stereo');
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].audioChannelRouting).toBe('swap-stereo');

    delete file.project.timeline.tracks[0].clips[0].audioChannelRouting;
    expect(migrateProjectFile(file).project.timeline.tracks[0].clips[0].audioChannelRouting).toBe('normal');
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
    expect(migrated.project.beatMarkers).toEqual([]);
    expect(migrated.warnings[0]).toContain('legacy');
  });

  it('serializes and migrates media metadata labels ratings and flags', () => {
    const project = makeProject();
    project.mediaMetadata = {
      'asset-1': { labelColor: 'blue', rating: 5, flag: 'green' },
      'missing-asset': { labelColor: 'red' },
      invalid: { labelColor: 'cyan' as never, rating: 9, flag: 'purple' as never }
    };

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.mediaMetadata).toEqual({ 'asset-1': { labelColor: 'blue', rating: 5, flag: 'green' } });
    expect(migrated.project.mediaMetadata).toEqual({ 'asset-1': { labelColor: 'blue', rating: 5, flag: 'green' } });
    expect(migrateProjectFile({ ...file, project: { ...file.project, mediaMetadata: undefined } }).project.mediaMetadata).toEqual({});
  });

  it('serializes and migrates media folders and media folder assignments', () => {
    const project = makeProject();
    project.mediaFolders = [{ id: 'folder-selects', name: 'Selects', parentId: null, collapsed: true, createdAt: '2026-06-13T00:00:00.000Z' }];
    project.media[0] = { ...project.media[0], folderId: 'folder-selects', importedAt: '2026-06-12T00:00:00.000Z' };
    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.mediaFolders).toEqual(project.mediaFolders);
    expect(file.project.media[0]).toMatchObject({ folderId: 'folder-selects', importedAt: '2026-06-12T00:00:00.000Z' });
    expect(migrated.project.mediaFolders).toEqual(project.mediaFolders);
    expect(migrated.project.media[0]).toMatchObject({ folderId: 'folder-selects', importedAt: '2026-06-12T00:00:00.000Z' });
  });

  it('serializes and migrates path masks while keeping older masks compatible', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-path-mask',
        masks: [
          { id: 'mask-old', type: 'rect', x: 0.1, y: 0.1, w: 0.5, h: 0.5, inverted: false, feather: 0, enabled: true },
          {
            id: 'mask-path',
            type: 'path',
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            path: [
              { x: -1, y: 0.25 },
              { x: 0.8, y: 1.2 },
              { x: 0.2, y: 0.2 }
            ],
            inverted: false,
            feather: 0,
            enabled: true
          },
          {
            id: 'mask-privacy',
            type: 'rect',
            x: 0.2,
            y: 0.3,
            w: 0.2,
            h: 0.2,
            keyframes: [{ time: 1, x: 0.25, y: 0.35, w: 0.2, h: 0.2 }],
            privacyBlur: { enabled: true, effect: 'pixelize', color: '#000000' },
            inverted: false,
            feather: 0,
            enabled: true
          }
        ]
      })
    ];

    const migrated = migrateProjectFile(serializeProject(project));
    const masks = migrated.project.timeline.tracks[0].clips[0].masks;

    expect(masks?.[0]).toMatchObject({ id: 'mask-old', type: 'rect' });
    expect(masks?.[0].path).toBeUndefined();
    expect(masks?.[1]).toMatchObject({
      id: 'mask-path',
      type: 'path',
      path: [
        { x: 0, y: 0.25 },
        { x: 0.8, y: 1 },
        { x: 0.2, y: 0.2 }
      ]
    });
    expect(masks?.[2]).toMatchObject({
      id: 'mask-privacy',
      keyframes: [{ time: 1, x: 0.25, y: 0.35, w: 0.2, h: 0.2 }],
      privacyBlur: { enabled: true, effect: 'pixelize', color: '#000000' }
    });
  });

  it('serializes and migrates path text settings while keeping older text clips compatible', () => {
    const project = makeProject();
    project.timeline.tracks[2].clips = [
      makeTextClip({
        id: 'clip-path-text',
        pathText: {
          enabled: true,
          path: [
            { x: 0.2, y: 0.6, handleOut: { x: 0.35, y: 0.3 } },
            { x: 0.8, y: 0.6, handleIn: { x: 0.65, y: 0.3 } }
          ],
          startOffset: 0.25,
          letterSpacing: 12,
          rotateCharacters: false
        }
      }),
      makeTextClip({ id: 'clip-legacy-text' })
    ];
    delete project.timeline.tracks[2].clips[1].pathText;

    const migrated = migrateProjectFile(serializeProject(project));
    const clips = migrated.project.timeline.tracks[2].clips;

    expect(clips[0]).toMatchObject({
      id: 'clip-path-text',
      pathText: {
        enabled: true,
        startOffset: 0.25,
        letterSpacing: 12,
        rotateCharacters: false
      }
    });
    expect(clips[0].pathText?.path).toHaveLength(2);
    expect(clips[1]).toMatchObject({
      id: 'clip-legacy-text',
      pathText: {
        enabled: false,
        startOffset: 0,
        letterSpacing: 4,
        rotateCharacters: true
      }
    });
  });

  it('serializes and migrates advanced keying settings while keeping older chroma key clips compatible', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-old-key',
        duration: 2,
        chromaKey: { enabled: true, color: [0, 255, 0], colors: [[0, 255, 0]], similarity: 0.2, blend: 0.1, spillSuppression: false, erosion: 0 }
      }),
      makeVideoClip({
        id: 'clip-luma-key',
        start: 2,
        duration: 2,
        chromaKey: {
          enabled: true,
          mode: 'luma-key',
          color: [0, 255, 0],
          colors: [[0, 255, 0]],
          similarity: 0.2,
          blend: 0.1,
          spillSuppression: false,
          erosion: 0,
          lumaThreshold: 2,
          lumaTolerance: 0.25,
          lumaSoftness: 0.1,
          differenceReferenceTime: 1.5,
          differenceThreshold: 0.4
        }
      })
    ];

    const migrated = migrateProjectFile(serializeProject(project));
    const [oldKey, lumaKey] = migrated.project.timeline.tracks[0].clips;

    expect(oldKey.chromaKey).toMatchObject({ enabled: true, mode: 'chroma-key', lumaThreshold: 0.4 });
    expect(lumaKey.chromaKey).toMatchObject({
      enabled: true,
      mode: 'luma-key',
      lumaThreshold: 1,
      lumaTolerance: 0.25,
      lumaSoftness: 0.1,
      differenceReferenceTime: 1.5,
      differenceThreshold: 0.4
    });
  });

  it('serializes and migrates project annotations with clamped times and colors', () => {
    const project = makeProject();
    project.annotations = [
      { id: 'annotation-late', time: 99, text: '  Check pacing  ', color: '#A78BFA' },
      { id: 'annotation-early', time: 1, text: '', color: 'not-a-color' }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.annotations).toEqual([
      { id: 'annotation-early', time: 1, text: 'Annotation', color: '#facc15' },
      { id: 'annotation-late', time: 10, text: 'Check pacing', color: '#a78bfa' }
    ]);
    expect(migrated.project.annotations).toEqual(file.project.annotations);
  });

  it('serializes and migrates beat markers with legacy fallback', () => {
    const project = makeProject();
    project.beatMarkers = [
      { id: 'beat-late', time: 99 },
      { id: 'beat-a', time: 1.5 }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.beatMarkers).toEqual([
      { id: 'beat-a', time: 1.5 },
      { id: 'beat-late', time: 10 }
    ]);
    expect(migrated.project.beatMarkers).toEqual(file.project.beatMarkers);

    delete (file.project as Partial<typeof file.project>).beatMarkers;
    expect(migrateProjectFile(file).project.beatMarkers).toEqual([]);
  });

  it('backfills missing project annotations during migration', () => {
    const file = serializeProject(makeProject());
    delete (file.project as Partial<typeof file.project>).annotations;

    expect(migrateProjectFile(file).project.annotations).toEqual([]);
  });

  it('serializes and migrates review annotations while old project files default to none', () => {
    const project = makeProject();
    project.reviewAnnotations = [
      { id: 'review-late', time: 99, type: 'arrow', text: '  Follow motion  ', color: '#38BDF8', x: 1.2, y: -1, width: -0.25, height: 0.4 },
      { id: 'review-text', time: 1, type: 'text', text: '', color: 'invalid', x: 0.25, y: 0.5, width: 0, height: 0 }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.reviewAnnotations).toEqual([
      { id: 'review-text', time: 1, type: 'text', text: 'Review annotation', color: '#facc15', x: 0.25, y: 0.5, width: 0.22, height: 0.08 },
      { id: 'review-late', time: 10, type: 'arrow', text: 'Follow motion', color: '#38bdf8', x: 1, y: 0, width: -0.25, height: 0.4 }
    ]);
    expect(migrated.project.reviewAnnotations).toEqual(file.project.reviewAnnotations);

    delete (file.project as Partial<typeof file.project>).reviewAnnotations;
    expect(migrateProjectFile(file).project.reviewAnnotations).toEqual([]);
  });

  it('serializes and migrates timeline notes while old project files default to none', () => {
    const project = makeProject();
    project.timelineNotes = [
      { id: 'note-late', start: 6, end: 99, text: '  Check ending  ', color: '#FB923C', createdAt: '2026-06-15T00:00:02.000Z' },
      { id: 'note-a', start: 3, end: 1, text: '', color: 'invalid', createdAt: '2026-06-15T00:00:01.000Z' },
      { id: 'note-empty', start: 2, end: 2, text: 'skip', color: '#facc15', createdAt: '2026-06-15T00:00:03.000Z' }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.timelineNotes).toEqual([
      { id: 'note-a', start: 1, end: 3, text: 'Timeline note', color: '#facc15', createdAt: '2026-06-15T00:00:01.000Z' },
      { id: 'note-late', start: 6, end: 10, text: 'Check ending', color: '#fb923c', createdAt: '2026-06-15T00:00:02.000Z' }
    ]);
    expect(migrated.project.timelineNotes).toEqual(file.project.timelineNotes);

    delete (file.project as Partial<typeof file.project>).timelineNotes;
    expect(migrateProjectFile(file).project.timelineNotes).toEqual([]);
  });

  it('serializes and migrates timeline bookmarks with legacy fallback', () => {
    const project = makeProject();
    project.bookmarks = [
      { id: 'bookmark-late', time: 99, note: '  Review ending  ' },
      { id: 'bookmark-a', time: 1, note: '' }
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.bookmarks).toEqual([
      { id: 'bookmark-a', time: 1, note: 'Bookmark' },
      { id: 'bookmark-late', time: 10, note: 'Review ending' }
    ]);
    expect(migrated.project.bookmarks).toEqual(file.project.bookmarks);

    delete (file.project as Partial<typeof file.project>).bookmarks;
    expect(migrateProjectFile(file).project.bookmarks).toEqual([]);
  });

  it('serializes and migrates video codec metadata for proxy decisions', () => {
    const project = makeProject();
    project.media[0].videoCodec = ' hevc ';
    project.media[0].frameRate = 23.976;
    project.media[0].avgFrameRate = '24000/1001';
    project.media[0].realFrameRate = '30/1';

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);

    expect(file.project.media[0].videoCodec).toBe('hevc');
    expect(file.project.media[0].variableFrameRate).toBe(true);
    expect(migrated.project.media[0].videoCodec).toBe('hevc');
    expect(migrated.project.media[0]).toMatchObject({ frameRate: 23.976, avgFrameRate: '24000/1001', realFrameRate: '30/1', variableFrameRate: true });
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

  it('backfills transform axis scale fields during migration', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips[0].transform = { x: 12, y: -8, scale: 0.75, rotation: 15, opacity: 0.8 };

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0].clips[0].transform).toEqual({ x: 12, y: -8, scale: 0.75, scaleX: 0.75, scaleY: 0.75, rotation: 15, opacity: 0.8 });
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

  it('backfills missing credits roll defaults during migration', () => {
    const project = makeProject();
    const creditsClip = makeCreditsClip({ id: 'legacy-credits', text: '导演 | 林青\n演员 | Ada' });
    delete (creditsClip as Partial<typeof creditsClip>).rows;
    delete (creditsClip as Partial<typeof creditsClip>).rollSpeed;
    delete (creditsClip.style as Partial<typeof creditsClip.style>).lineSpacing;
    delete (creditsClip.style as Partial<typeof creditsClip.style>).horizontalMargin;
    project.timeline.tracks[2].clips = [creditsClip];

    const migrated = migrateProjectFile(serializeProject(project));
    const migratedCredits = migrated.project.timeline.tracks[2].clips[0];

    expect(migratedCredits.type).toBe('credits');
    if (migratedCredits.type === 'credits') {
      expect(migratedCredits.rows).toEqual([
        { role: '导演', name: '林青' },
        { role: '演员', name: 'Ada' }
      ]);
      expect(migratedCredits.rollSpeed).toBe(DEFAULT_CREDITS_ROLL_SPEED);
      expect(migratedCredits.style.lineSpacing).toBe(DEFAULT_CREDITS_STYLE.lineSpacing);
      expect(migratedCredits.style.horizontalMargin).toBe(DEFAULT_CREDITS_STYLE.horizontalMargin);
    }
  });

  it('backfills clip speed, color correction, and audio denoise defaults during migration', () => {
    const project = makeProject();
    const legacyClip = { ...project.timeline.tracks[0].clips[0] };
    delete (legacyClip as Partial<typeof legacyClip>).speed;
    delete (legacyClip as Partial<typeof legacyClip>).colorCorrection;
    delete (legacyClip as Partial<typeof legacyClip>).audioDenoise;
    delete (legacyClip as Partial<typeof legacyClip>).videoRestoration;
    delete (legacyClip as Partial<typeof legacyClip>).projection;
    delete (legacyClip as Partial<typeof legacyClip>).panorama;
    project.timeline.tracks[0].clips = [legacyClip as never];

    const migrated = migrateProjectFile(serializeProject(project));
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(clip.speed).toBe(1);
    expect(clip.colorCorrection).toEqual(DEFAULT_COLOR_CORRECTION);
    expect(clip.audioDenoise).toEqual({ enabled: false, strength: 0.5 });
    expect(clip.videoRestoration).toEqual(DEFAULT_VIDEO_RESTORATION);
    expect(clip.projection).toBe('flat');
    expect(clip.panorama).toEqual({ yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' });
  });

  it('serializes and migrates video restoration settings with clamped values', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-repair',
        videoRestoration: {
          deinterlace: { enabled: true, mode: 1 },
          temporalDenoise: { preset: 'custom', lumaSpatial: 5, chromaSpatial: 2.5, lumaTmp: 8 },
          spatialDenoise: { enabled: true, strength: 4, patchSize: 6, researchSize: 10 }
        }
      })
    ];

    const migrated = migrateProjectFile(serializeProject(project));
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(clip.videoRestoration).toEqual({
      deinterlace: { enabled: true, mode: 1 },
      temporalDenoise: { preset: 'custom', lumaSpatial: 5, chromaSpatial: 2.5, lumaTmp: 8 },
      spatialDenoise: { enabled: true, strength: 4, patchSize: 7, researchSize: 11 }
    });
  });

  it('serializes and migrates 360 projection settings with clamped view values', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-360',
        projection: 'equirectangular',
        panorama: { yaw: 270, pitch: -120, roll: 45, fov: 160, outputProjection: 'equirectangular' }
      })
    ];

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(clip.projection).toBe('equirectangular');
    expect(clip.panorama).toEqual({ yaw: 180, pitch: -90, roll: 45, fov: 120, outputProjection: 'equirectangular' });
  });

  it('backfills enhanced chroma key fields during migration', () => {
    const project = makeProject();
    const legacyClip = {
      ...project.timeline.tracks[0].clips[0],
      chromaKey: { enabled: true, color: [0, 128, 255], similarity: 0.24, blend: 0.08 }
    };
    project.timeline.tracks[0].clips = [legacyClip as never];

    const migrated = migrateProjectFile(serializeProject(project));
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(clip.chromaKey).toEqual({
      enabled: true,
      mode: 'chroma-key',
      color: [0, 128, 255],
      colors: [[0, 128, 255]],
      similarity: 0.24,
      blend: 0.08,
      spillSuppression: false,
      erosion: 0,
      lumaThreshold: 0.4,
      lumaTolerance: 0.1,
      lumaSoftness: 0.05,
      differenceReferenceTime: 0,
      differenceThreshold: 0.2
    });
  });

  it('normalizes clip motion tracking points during migration', () => {
    const project = makeProject();
    const legacyClip = {
      ...project.timeline.tracks[0].clips[0],
      duration: 2,
      motionTrack: [
        { time: 1, dx: 0.1, dy: 0.2 },
        { time: 99, dx: -0.1, dy: -0.2 },
        { time: Number.NaN, dx: 1, dy: 1 }
      ]
    };
    project.timeline.tracks[0].clips = [legacyClip as never];

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0].clips[0].motionTrack).toEqual([
      { time: 1, dx: 0.1, dy: 0.2 },
      { time: 2, dx: -0.1, dy: -0.2 }
    ]);
  });

  it('backfills and clamps advanced audio clip defaults during migration', () => {
    const project = makeProject();
    const legacyClip = { ...project.timeline.tracks[0].clips[0] };
    delete (legacyClip as Partial<typeof legacyClip>).pitchSemitones;
    delete (legacyClip as Partial<typeof legacyClip>).reverseAudio;
    delete (legacyClip as Partial<typeof legacyClip>).fadeInDuration;
    delete (legacyClip as Partial<typeof legacyClip>).fadeOutDuration;
    delete (legacyClip as Partial<typeof legacyClip>).fadeInCurve;
    delete (legacyClip as Partial<typeof legacyClip>).fadeOutCurve;
    project.timeline.tracks[0].clips = [legacyClip as never];

    const migrated = migrateProjectFile(serializeProject(project));
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(clip).toMatchObject({
      pitchSemitones: 0,
      reverseAudio: false,
      fadeInDuration: 0,
      fadeOutDuration: 0,
      fadeInCurve: 'linear',
      fadeOutCurve: 'linear'
    });

    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-audio-clamped',
        duration: 4,
        pitchSemitones: 99,
        reverseAudio: true,
        fadeInDuration: 99,
        fadeOutDuration: -5,
        fadeInCurve: 'ease-in',
        fadeOutCurve: 'ease-in-out' as never
      })
    ];
    const clamped = migrateProjectFile(serializeProject(project)).project.timeline.tracks[0].clips[0];

    expect(clamped).toMatchObject({
      pitchSemitones: 12,
      reverseAudio: true,
      fadeInDuration: 4,
      fadeOutDuration: 0,
      fadeInCurve: 'ease-in',
      fadeOutCurve: 'linear'
    });
  });

  it('backfills missing input color space during migration', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips[0].colorCorrection = {
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0,
      lutPath: null
    };

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0].clips[0].colorCorrection.inputColorSpace).toBe('rec709');
  });

  it('serializes and migrates adjustment clips without media references', () => {
    const project = makeProject();
    project.timeline.tracks.push(
      createTrack({
        id: 'track-adjustment',
        type: 'video',
        name: 'Adjustment',
        clips: [makeAdjustmentClip({ id: 'adjustment-legacy', trackId: 'track-adjustment', colorCorrection: { brightness: -0.2 }, transform: { opacity: 0.75 } })]
      })
    );

    const migrated = migrateProjectFile(serializeProject(project));
    const clip = migrated.project.timeline.tracks.at(-1)?.clips[0];

    expect(clip?.type).toBe('adjustment');
    expect('mediaId' in (clip ?? {})).toBe(false);
    expect(clip?.colorCorrection).toMatchObject({ brightness: -0.2, contrast: 1, saturation: 1, hue: 0 });
    expect(clip?.transform.opacity).toBe(0.75);
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
      slowMotionMode: 'invalid-mode',
      sequenceFrameRate: 240
    } as never;

    const file = serializeProject(project);
    const migrated = migrateProjectFile(file);
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(file.project.media[0].imageSequence?.paths[0]).toBe('C:/Media/frame001.png');
    expect(migrated.project.media[0].imageSequence).toMatchObject({ pattern: 'C:/Media/frame%03d.png', frameRate: 24, frameCount: 3 });
    expect(clip.stabilization).toEqual({ enabled: true, smoothing: 100, zoom: 0, analyzed: true, trfPath: 'C:\\Temp\\clip.trf' });
    expect(clip.frameInterpolation).toEqual({ enabled: true, targetFps: 60 });
    expect(clip.slowMotionMode).toBe('none');
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
      inputColorSpace: 'slog3',
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0,
      lutPath: 'C:\\LUTs\\cinematic.cube'
    };

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0].clips[0].colorCorrection.lutPath).toBe('C:\\LUTs\\cinematic.cube');
    expect(migrated.project.timeline.tracks[0].clips[0].colorCorrection.inputColorSpace).toBe('slog3');
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
