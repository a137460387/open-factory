import { describe, expect, it } from 'vitest';
import {
  AddAdjustmentLayerCommand,
  AddClipCommand,
  AddCreditsClipCommand,
  AddEffectCommand,
  AddKeyframeCommand,
  AddMaskCommand,
  AddMotionGraphicCommand,
  AddProjectAnnotationCommand,
  AddReviewAnnotationCommand,
  AddCollaborationNoteCommand,
  AddTimelineNoteCommand,
  AddProjectBookmarkCommand,
  AddSpeakerDiarizationTracksCommand,
  AddSubtitleClipCommand,
  AddTrackCommand,
  AddTimelineMarkerCommand,
  AddMediaFolderCommand,
  ApplyEffectPresetCommand,
  ApplyTextAnimationCommand,
  BatchKeyframeEditCommand,
  BatchProofreadSubtitleCommand,
  BatchUpdateSubtitleTextCommand,
  BatchUpdateClipCommand,
  BatchUpdateClipGroupClipsCommand,
  BatchUpdateTrackCommand,
  AddTransitionCommand,
  ApplyStyleCommand,
  BatchAlignSubtitleCommand,
  BatchAlignToBeatCommand,
  BatchAddMarkersCommand,
  BatchShiftClipsCommand,
  BatchShiftSubtitleCommand,
  BatchSplitAtSceneCutsCommand,
  BatchUpdateKeyframeCommand,
  DEFAULT_COLOR_CORRECTION,
  type Command,
  CommandManager,
  CloseGapCommand,
  CreateClipGroupCommand,
  DeleteGroupCommand,
  DeleteClipCommand,
  DeleteClipsCommand,
  ImportEDLCommand,
  LoadProjectCommand,
  MoveMediaToFolderCommand,
  MigrateProxiesCommand,
  MoveClipCommand,
  MoveClipsCommand,
  PackNestedSequenceCommand,
  PiPLayoutCommand,
  ReplaceMediaCommand,
  RemoveEffectCommand,
  DeleteMediaFolderCommand,
  RemoveMaskCommand,
  RenameMediaFolderCommand,
  RemoveProjectAnnotationCommand,
  RemoveReviewAnnotationCommand,
  RemoveCollaborationNoteCommand,
  RemoveTimelineNoteCommand,
  RemoveProjectBookmarkCommand,
  RemoveKeyframeCommand,
  RemoveMediaCommand,
  RemoveTimelineMarkerCommand,
  RemoveTransitionCommand,
  ReorderEffectsCommand,
  RemoveSilenceCommand,
  RippleDeleteCommand,
  RollingTrimCommand,
  SlideClipCommand,
  SlipClipCommand,
  SplitClipCommand,
  SplitClipAtTimesCommand,
  SnapToBeatsCommand,
  SwitchMediaVersionCommand,
  TrimClipCommand,
  UpdateKeyframeCommand,
  UngroupCommand,
  UpdateClipGroupCommand,
  UpdateClipCommand,
  UpdateEffectCommand,
  UpdateProjectBeatMarkersCommand,
  UpdateProjectExportRangesCommand,
  UpdateProjectProtectedRangesCommand,
  UpdateProjectAnnotationCommand,
  UpdateReviewAnnotationCommand,
  UpdateCollaborationNoteCommand,
  UpdateTimelineNoteCommand,
  UpdateProjectBookmarkCommand,
  UpdateProjectBookmarksCommand,
  UpdateTimelineMarkerCommand,
  UpdateMaskCommand,
  UpdateProjectAudioCommand,
  UpdateProjectCoverCommand,
  UpdateProjectDocumentationCommand,
  UpdateProjectReleaseVersionCommand,
  UpdateProjectSpeakersCommand,
  UpdateProjectSettingsCommand,
  UpdateTrackCommand,
  calculateReplaceMediaPatch,
  calculateBeatSplitTimesForClip,
  calculateClipGroupMoveStarts,
  createTrack,
  calculateStyleSummary,
  findCompleteClipGroup,
  getReplaceMediaCompatibilityWarnings
} from '../src';
import {
  UpdateSequenceSettingsCommand,
  BatchUpdateTrackHeightCommand,
  NewProjectCommand,
  PRIMARY_SEQUENCE_ID,
  BatchAddClipsCommand,
  ApplyMulticamAiCutSuggestionsCommand,
  ApplyShakeStabilizationCommand,
  ApplyPipPlacementCommand,
  ApplyPlatformFitCommand,
  RestorePlatformFitClipCommand,
  PasteKeyframesCommand,
  BatchImportSubtitleCommand,
  AddSubclipCommand,
  UpdateSubclipCommand,
  DeleteSubclipCommand,
  UpdateProjectBeatSnapSuggestionsCommand,
  UpdateProjectMediaCollectionsCommand,
  SetMediaFolderCollapsedCommand,
  type Subclip,
  type MediaFolder
} from '../src';
import { makeAccessor, makeAdjustmentClip, makeAudioClip, makeCreditsClip, makeMotionGraphicClip, makeProject, makeSubtitleClip, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline commands', () => {
  it('loads a project with undo and redo support', () => {
    let project = makeProject();
    const beforeId = project.id;
    const restored = { ...makeProject(), id: 'project-restored', name: 'Restored Snapshot' };
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new LoadProjectCommand(accessor, restored));
    expect(project.id).toBe('project-restored');
    expect(project.name).toBe('Restored Snapshot');

    manager.undo();
    expect(project.id).toBe(beforeId);

    manager.redo();
    expect(project.id).toBe('project-restored');
  });

  it('updates project frame-rate settings with undo and normalizes invalid drop-frame format', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new UpdateProjectSettingsCommand(accessor, { fps: 24, timecodeFormat: 'df' }));
    expect(project.settings.fps).toBe(24);
    expect(project.settings.timecodeFormat).toBe('ndf');

    manager.execute(new UpdateProjectSettingsCommand(accessor, { fps: 29.97, timecodeFormat: 'df' }));
    expect(project.settings.fps).toBe(29.97);
    expect(project.settings.timecodeFormat).toBe('df');

    manager.undo();
    expect(project.settings.fps).toBe(24);
    expect(project.settings.timecodeFormat).toBe('ndf');
  });

  it('mutates media folders through undoable project commands', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();
    const addCommand = new AddMediaFolderCommand(accessor, { id: 'folder-selects', name: 'Selects' });

    manager.execute(addCommand);
    manager.execute(new RenameMediaFolderCommand(accessor, 'folder-selects', 'B-roll'));
    manager.execute(new MoveMediaToFolderCommand(accessor, ['asset-1'], 'folder-selects'));

    expect(project.mediaFolders[0]).toMatchObject({ id: 'folder-selects', name: 'B-roll' });
    expect(project.media[0].folderId).toBe('folder-selects');

    manager.execute(new DeleteMediaFolderCommand(accessor, 'folder-selects'));
    expect(project.mediaFolders).toEqual([]);
    expect(project.media[0].folderId).toBeNull();

    manager.undo();
    expect(project.mediaFolders[0].id).toBe('folder-selects');
    expect(project.media[0].folderId).toBe('folder-selects');
  });

  it('imports an EDL as an undoable active sequence with missing media placeholders', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();
    const command = new ImportEDLCommand(
      accessor,
      [
        'TITLE: Command Import',
        '001  AX       V     C        00:00:00:00 00:00:01:00 00:00:00:00 00:00:01:00',
        '* FROM CLIP NAME: sample.mp4',
        '002  AX       V     C        00:00:00:00 00:00:01:00 00:00:01:00 00:00:02:00',
        '* FROM CLIP NAME: Offline.mov'
      ].join('\n')
    );

    manager.execute(command);

    expect(command.result).toMatchObject({ matchedCount: 1, missingCount: 1 });
    expect(project.activeSequenceId).toBe(command.result?.sequence.id);
    expect(project.timeline.tracks[0].clips).toHaveLength(2);
    expect(project.media.some((asset) => asset.name === 'Offline.mov' && asset.missing)).toBe(true);

    manager.undo();
    expect(project.activeSequenceId).not.toBe(command.result?.sequence.id);
    expect(project.media.some((asset) => asset.name === 'Offline.mov')).toBe(false);

    manager.redo();
    expect(project.activeSequenceId).toBe(command.result?.sequence.id);
    expect(project.timeline.tracks[0].clips).toHaveLength(2);
  });

  it('adds tracks and clips with undo/redo', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();
    const clip = makeVideoClip();

    manager.execute(new AddTrackCommand(accessor, { id: 'track-extra', type: 'video', name: 'Video 2', clips: [] }));
    expect(accessor.current().tracks).toHaveLength(4);
    manager.undo();
    expect(accessor.current().tracks).toHaveLength(3);
    manager.redo();
    expect(accessor.current().tracks).toHaveLength(4);

    manager.execute(new AddClipCommand(accessor, clip));
    expect(accessor.current().tracks[0].clips).toHaveLength(1);
    manager.undo();
    expect(accessor.current().tracks[0].clips).toHaveLength(0);
    manager.redo();
    expect(accessor.current().tracks[0].clips[0].id).toBe(clip.id);
  });

  it('adds adjustment layers as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-base', duration: 4 })]));
    const manager = new CommandManager();
    const track = createTrack({ id: 'track-adjustment', type: 'video', name: 'Adjustment', clips: [] });
    const clip = makeAdjustmentClip({ id: 'adjustment-a', trackId: 'track-adjustment', duration: 4 });

    manager.execute(new AddAdjustmentLayerCommand(accessor, track, clip));
    expect(accessor.current().tracks.at(-1)?.id).toBe('track-adjustment');
    expect(accessor.current().tracks.at(-1)?.clips.map((item) => item.id)).toEqual(['adjustment-a']);

    manager.undo();
    expect(accessor.current().tracks.some((item) => item.id === 'track-adjustment')).toBe(false);

    manager.redo();
    expect(accessor.current().tracks.at(-1)?.clips[0].type).toBe('adjustment');
  });

  it('adds adjustment layers to existing tracks and rejects overlaps', () => {
    const track = createTrack({ id: 'track-adjustment', type: 'video', name: 'Adjustment', clips: [] });
    const accessor = makeAccessor({ ...makeTimeline(), tracks: [...makeTimeline().tracks, track] });
    const manager = new CommandManager();

    manager.execute(new AddAdjustmentLayerCommand(accessor, track, makeAdjustmentClip({ id: 'adjustment-a', trackId: 'track-adjustment', start: 0, duration: 2 })));
    expect(accessor.current().tracks.find((item) => item.id === 'track-adjustment')?.clips).toHaveLength(1);
    expect(() =>
      manager.execute(new AddAdjustmentLayerCommand(accessor, track, makeAdjustmentClip({ id: 'adjustment-b', trackId: 'track-adjustment', start: 1, duration: 2 })))
    ).toThrow('overlaps');

    manager.undo();
    expect(accessor.current().tracks.find((item) => item.id === 'track-adjustment')?.clips).toHaveLength(0);
  });

  it('updates project release version with undo and semver normalization', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new UpdateProjectReleaseVersionCommand(accessor, '02.003.004'));
    expect(project.releaseVersion).toBe('2.3.4');

    manager.undo();
    expect(project.releaseVersion).toBe('0.1.0');

    manager.redo();
    expect(project.releaseVersion).toBe('2.3.4');
  });

  it('migrates proxy path references and undoes without moving files back', () => {
    let project = {
      ...makeProject(),
      media: [
        {
          ...makeProject().media[0],
          id: 'asset-proxy',
          proxyPath: 'C:/Proxy/source.mp4',
          proxyStatus: 'ready' as const
        }
      ]
    };
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new MigrateProxiesCommand(accessor, [
        {
          assetId: 'asset-proxy',
          fromPath: 'C:/Proxy/source.mp4',
          toPath: 'D:/ProxyArchive/asset-proxy-source.mp4'
        }
      ])
    );
    expect(project.media[0].proxyPath).toBe('D:/ProxyArchive/asset-proxy-source.mp4');

    manager.undo();
    expect(project.media[0].proxyPath).toBe('C:/Proxy/source.mp4');
  });

  it('adds motion graphics as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-base', duration: 4 })]));
    const manager = new CommandManager();
    const track = createTrack({ id: 'track-motion-graphics', type: 'video', name: 'Motion Graphics', clips: [] });
    const clip = makeMotionGraphicClip({ id: 'motion-countdown', trackId: 'track-motion-graphics', duration: 4 });

    manager.execute(new AddMotionGraphicCommand(accessor, track, clip));
    expect(accessor.current().tracks.at(-1)?.id).toBe('track-motion-graphics');
    expect(accessor.current().tracks.at(-1)?.clips[0]).toMatchObject({ id: 'motion-countdown', type: 'motion-graphic' });

    manager.undo();
    expect(accessor.current().tracks.some((item) => item.id === 'track-motion-graphics')).toBe(false);

    manager.redo();
    expect(accessor.current().tracks.at(-1)?.clips[0].type).toBe('motion-graphic');
  });

  it('adds subtitle clips only to subtitle tracks with undo and redo', () => {
    const accessor = makeAccessor({
      ...makeTimeline(),
      tracks: [
        ...makeTimeline().tracks,
        createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitle 1', clips: [] })
      ]
    });
    const manager = new CommandManager();
    const subtitle = makeSubtitleClip({ id: 'subtitle-a', trackId: 'track-subtitle', start: 0, duration: 1.5 });

    manager.execute(new AddSubtitleClipCommand(accessor, subtitle));
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips).toHaveLength(1);

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips).toHaveLength(0);

    manager.redo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => clip.id)).toEqual(['subtitle-a']);
    expect(() => manager.execute(new AddSubtitleClipCommand(accessor, makeSubtitleClip({ id: 'subtitle-overlap', trackId: 'track-subtitle', start: 0.5, duration: 1 })))).toThrow('overlaps');
    expect(() => manager.execute(new AddSubtitleClipCommand(accessor, makeSubtitleClip({ id: 'subtitle-wrong-track', trackId: 'track-text' })))).toThrow('subtitle tracks');
  });

  it('adds credits clips only to text tracks with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();
    const credits = makeCreditsClip({ id: 'credits-a', start: 0, duration: 2 });

    manager.execute(new AddCreditsClipCommand(accessor, credits));
    expect(accessor.current().tracks.find((track) => track.id === 'track-text')?.clips).toHaveLength(1);

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-text')?.clips).toHaveLength(0);

    manager.redo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-text')?.clips.map((clip) => clip.id)).toEqual(['credits-a']);
    expect(() => manager.execute(new AddCreditsClipCommand(accessor, makeCreditsClip({ id: 'credits-overlap', start: 1, duration: 2 })))).toThrow('overlaps');
    expect(() => manager.execute(new AddCreditsClipCommand(accessor, makeCreditsClip({ id: 'credits-wrong-track', trackId: 'track-video' })))).toThrow('text tracks');
  });

  it('shifts subtitle clips as one undoable command', () => {
    const timeline = makeTimeline();
    timeline.tracks.push(
      createTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles',
        clips: [makeSubtitleClip({ id: 'sub-a', start: 0.5, duration: 1 }), makeSubtitleClip({ id: 'sub-b', start: 2.5, duration: 1 })]
      })
    );
    const accessor = makeAccessor(timeline);
    const manager = new CommandManager();

    manager.execute(new BatchShiftSubtitleCommand(accessor, ['sub-a', 'sub-b'], 1, 5));
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => [clip.id, clip.start, clip.duration])).toEqual([
      ['sub-a', 1.5, 1],
      ['sub-b', 3.5, 1]
    ]);

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => [clip.id, clip.start, clip.duration])).toEqual([
      ['sub-a', 0.5, 1],
      ['sub-b', 2.5, 1]
    ]);
  });

  it('batch shifts media clips as one undoable command', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeAudioClip({ id: 'audio-a', start: 1, duration: 1 }),
        makeAudioClip({ id: 'audio-b', start: 4, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new BatchShiftClipsCommand(accessor, { 'audio-a': 0.25, 'audio-b': -0.5 }));
    expect(accessor.current().tracks.find((track) => track.id === 'track-audio')?.clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['audio-a', 1.25],
      ['audio-b', 3.5]
    ]);

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-audio')?.clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['audio-a', 1],
      ['audio-b', 4]
    ]);
  });

  it('aligns subtitle clips to waveform peaks as one undoable command', () => {
    const timeline = makeTimeline();
    timeline.tracks.push(
      createTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles',
        clips: [makeSubtitleClip({ id: 'sub-a', start: 0, duration: 1 }), makeSubtitleClip({ id: 'sub-b', start: 1.4, duration: 1 })]
      })
    );
    const accessor = makeAccessor(timeline);
    const manager = new CommandManager();
    const command = new BatchAlignSubtitleCommand(accessor, ['sub-a', 'sub-b'], [0.2, 1.55], 4, { maxDistance: 0.3 });

    manager.execute(command);

    expect(command.report).toMatchObject({ correctedCount: 2, averageOffsetMs: 175 });
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => [clip.id, clip.start, clip.duration])).toEqual([
      ['sub-a', 0.2, 1],
      ['sub-b', 1.55, 1]
    ]);

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => [clip.id, clip.start, clip.duration])).toEqual([
      ['sub-a', 0, 1],
      ['sub-b', 1.4, 1]
    ]);
  });

  it('fixes subtitle proofreading issues as one undoable command', () => {
    const timeline = makeTimeline();
    timeline.tracks.push(
      createTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles',
        clips: [
          makeSubtitleClip({ id: 'short', start: 0, duration: 0.4, text: '短' }),
          makeSubtitleClip({ id: 'long', start: 2, duration: 9, text: 'Long subtitle' }),
          makeSubtitleClip({ id: 'blank', start: 12, duration: 2, text: '   ' })
        ]
      })
    );
    const accessor = makeAccessor(timeline);
    const manager = new CommandManager();

    manager.execute(
      new BatchProofreadSubtitleCommand(accessor, [
        { clipId: 'short', duration: 1 },
        { clipId: 'long', duration: 7 },
        { clipId: 'blank', delete: true }
      ])
    );
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => [clip.id, clip.duration])).toEqual([
      ['short', 1],
      ['long', 7]
    ]);

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => [clip.id, clip.duration])).toEqual([
      ['short', 0.4],
      ['long', 9],
      ['blank', 2]
    ]);
  });

  it('updates track controls with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(new UpdateTrackCommand(accessor, 'track-video', { muted: true, solo: true, locked: true, volume: 0.5, pan: -0.75 }));
    expect(accessor.current().tracks[0]).toMatchObject({ muted: true, solo: true, locked: true, volume: 0.5, pan: -0.75 });

    manager.undo();
    expect(accessor.current().tracks[0]).toMatchObject({ muted: false, solo: false, locked: false, volume: 1, pan: 0 });

    manager.redo();
    expect(accessor.current().tracks[0]).toMatchObject({ muted: true, solo: true, locked: true, volume: 0.5, pan: -0.75 });
  });

  it('batch updates track controls with undo and redo', () => {
    const timeline = makeTimeline();
    timeline.tracks.push(createTrack({ id: 'track-empty', type: 'audio', name: 'Audio 2', clips: [] }));
    const accessor = makeAccessor(timeline);
    const manager = new CommandManager();

    manager.execute(
      new BatchUpdateTrackCommand(accessor, {
        patches: {
          'track-video': { muted: true },
          'track-audio': { muted: true }
        }
      })
    );
    expect(accessor.current().tracks.find((track) => track.id === 'track-video')).toMatchObject({ muted: true });
    expect(accessor.current().tracks.find((track) => track.id === 'track-audio')).toMatchObject({ muted: true });

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-video')).toMatchObject({ muted: false });
    expect(accessor.current().tracks.find((track) => track.id === 'track-audio')).toMatchObject({ muted: false });

    manager.redo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-video')).toMatchObject({ muted: true });
    expect(accessor.current().tracks.find((track) => track.id === 'track-audio')).toMatchObject({ muted: true });
  });

  it('batch moves track order and deletes selected empty tracks', () => {
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-non-empty' })]);
    timeline.tracks.push(createTrack({ id: 'track-empty', type: 'audio', name: 'Audio 2', clips: [] }));
    const accessor = makeAccessor(timeline);
    const manager = new CommandManager();

    manager.execute(
      new BatchUpdateTrackCommand(accessor, {
        order: ['track-audio', 'track-video', 'track-text', 'track-empty'],
        deleteEmptyTrackIds: ['track-empty', 'track-video']
      })
    );
    expect(accessor.current().tracks.map((track) => track.id)).toEqual(['track-audio', 'track-video', 'track-text']);

    manager.undo();
    expect(accessor.current().tracks.map((track) => track.id)).toEqual(['track-video', 'track-audio', 'track-text', 'track-empty']);
  });

  it('updates timeline color labels with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-color' })]));
    const manager = new CommandManager();

    manager.execute(new UpdateTrackCommand(accessor, 'track-video', { color: 'teal' }));
    expect(accessor.current().tracks[0].color).toBe('teal');

    manager.execute(new UpdateClipCommand(accessor, 'clip-color', { colorLabel: 'pink' }));
    expect(accessor.current().tracks[0].clips[0].colorLabel).toBe('pink');

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].colorLabel).toBeUndefined();

    manager.execute(new UpdateClipCommand(accessor, 'clip-color', { colorLabel: 'invalid' as never }));
    expect(accessor.current().tracks[0].clips[0].colorLabel).toBeNull();

    manager.undo();
    manager.undo();
    expect(accessor.current().tracks[0].color).toBeNull();
  });

  it('updates track EQ and compressor controls with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(
      new UpdateTrackCommand(accessor, 'track-video', {
        eq: {
          enabled: true,
          bands: [
            { id: 'eq-low', type: 'lowshelf', frequency: 90, gain: 3, q: 0.8 },
            { id: 'eq-low-mid', type: 'peaking', frequency: 450, gain: -2, q: 1.2 },
            { id: 'eq-high-mid', type: 'peaking', frequency: 3000, gain: 0, q: 1 },
            { id: 'eq-high', type: 'highshelf', frequency: 9000, gain: 1.5, q: 0.7 }
          ]
        },
        compressor: { enabled: true, threshold: -24, ratio: 4, attack: 12, release: 180, makeupGain: 6 }
      })
    );
    expect(accessor.current().tracks[0].eq?.bands.map((band) => band.gain)).toEqual([3, -2, 0, 1.5]);
    expect(accessor.current().tracks[0].compressor).toMatchObject({ enabled: true, threshold: -24, ratio: 4, attack: 12, release: 180, makeupGain: 6 });

    manager.undo();
    expect(accessor.current().tracks[0].eq?.bands.every((band) => band.gain === 0)).toBe(true);
    expect(accessor.current().tracks[0].compressor?.enabled).toBe(false);

    manager.redo();
    expect(accessor.current().tracks[0].eq?.bands[1]).toMatchObject({ frequency: 450, gain: -2, q: 1.2 });
    expect(accessor.current().tracks[0].compressor?.ratio).toBe(4);
  });

  it('adds and removes adjacent clip transitions with undo and redo', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 2 }), makeVideoClip({ id: 'b', start: 2, duration: 2 })])
    );
    const manager = new CommandManager();

    manager.execute(new AddTransitionCommand(accessor, { id: 'transition-1', type: 'dissolve', duration: 5, fromClipId: 'a', toClipId: 'b' }));
    expect(accessor.current().transitions).toEqual([{ id: 'transition-1', type: 'dissolve', duration: 1, fromClipId: 'a', toClipId: 'b' }]);

    manager.undo();
    expect(accessor.current().transitions).toEqual([]);

    manager.redo();
    expect(accessor.current().transitions?.[0].duration).toBe(1);

    manager.execute(new RemoveTransitionCommand(accessor, 'transition-1'));
    expect(accessor.current().transitions).toEqual([]);

    manager.undo();
    expect(accessor.current().transitions?.[0].id).toBe('transition-1');
  });

  it('rejects transitions between non-adjacent clips', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 2 }), makeVideoClip({ id: 'b', start: 3, duration: 2 })])
    );
    const manager = new CommandManager();

    expect(() => manager.execute(new AddTransitionCommand(accessor, { type: 'dissolve', duration: 0.5, fromClipId: 'a', toClipId: 'b' }))).toThrow(
      'adjacent'
    );
  });

  it('rejects duplicate transitions and keeps transition undo guards as no-ops', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 2 }), makeVideoClip({ id: 'b', start: 2, duration: 2 })])
    );
    const manager = new CommandManager();
    const add = new AddTransitionCommand(accessor, { id: 'transition-1', type: 'dissolve', duration: 0.5, fromClipId: 'a', toClipId: 'b' });
    const remove = new RemoveTransitionCommand(accessor, 'transition-1');

    add.undo();
    remove.undo();
    expect(accessor.current().transitions).toEqual([]);

    manager.execute(add);
    expect(() => manager.execute(new AddTransitionCommand(accessor, { type: 'fade-black', duration: 0.25, fromClipId: 'a', toClipId: 'b' }))).toThrow(
      'already exists'
    );
    expect(() => manager.execute(new RemoveTransitionCommand(accessor, 'missing-transition'))).toThrow('not found');
  });

  it('adds, updates, removes, and restores timeline markers', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 5 })]));
    const manager = new CommandManager();

    manager.execute(new AddTimelineMarkerCommand(accessor, { id: 'marker-b', time: 4, label: 'Outro', color: '#00aa55' }));
    manager.execute(new AddTimelineMarkerCommand(accessor, { id: 'marker-a', time: 1, label: 'Intro', color: '#3366ff' }));
    expect(accessor.current().markers).toEqual([
      { id: 'marker-a', time: 1, label: 'Intro', color: '#3366ff' },
      { id: 'marker-b', time: 4, label: 'Outro', color: '#00aa55' }
    ]);

    manager.execute(new UpdateTimelineMarkerCommand(accessor, 'marker-b', { time: 99, label: 'End', color: 'not-a-color' }));
    expect(accessor.current().markers?.at(-1)).toEqual({ id: 'marker-b', time: 5, label: 'End', color: '#f97316' });

    manager.execute(new RemoveTimelineMarkerCommand(accessor, 'marker-a'));
    expect(accessor.current().markers?.map((marker) => marker.id)).toEqual(['marker-b']);

    manager.undo();
    expect(accessor.current().markers?.map((marker) => marker.id)).toEqual(['marker-a', 'marker-b']);
    manager.undo();
    expect(accessor.current().markers?.find((marker) => marker.id === 'marker-b')?.label).toBe('Outro');
  });

  it('adds, updates, removes, and restores project annotations', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new AddProjectAnnotationCommand(accessor, { id: 'annotation-a', time: 99, text: '  Needs trim  ', color: '#A78BFA' }));
    expect(project.annotations).toEqual([{ id: 'annotation-a', time: 10, text: 'Needs trim', color: '#a78bfa' }]);

    manager.execute(new UpdateProjectAnnotationCommand(accessor, 'annotation-a', { time: 2, text: 'Keep this beat', color: 'invalid' }));
    expect(project.annotations[0]).toEqual({ id: 'annotation-a', time: 2, text: 'Keep this beat', color: '#facc15' });

    manager.execute(new RemoveProjectAnnotationCommand(accessor, 'annotation-a'));
    expect(project.annotations).toEqual([]);

    manager.undo();
    expect(project.annotations[0].text).toBe('Keep this beat');
    manager.undo();
    expect(project.annotations[0].text).toBe('Needs trim');
    manager.undo();
    expect(project.annotations).toEqual([]);
    manager.redo();
    expect(project.annotations[0].id).toBe('annotation-a');
  });

  it('adds review annotations at the playhead time without touching project annotations', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new AddReviewAnnotationCommand(accessor, {
        id: 'review-a',
        time: 99,
        type: 'rectangle',
        text: '  Reframe this area  ',
        color: '#38BDF8',
        x: 0.2,
        y: 0.3,
        width: 0.4,
        height: 0.2
      })
    );
    expect(project.annotations).toEqual([]);
    expect(project.reviewAnnotations).toEqual([
      { id: 'review-a', time: 10, type: 'rectangle', text: 'Reframe this area', color: '#38bdf8', x: 0.2, y: 0.3, width: 0.4, height: 0.2 }
    ]);

    manager.execute(new UpdateReviewAnnotationCommand(accessor, 'review-a', { time: 2, type: 'text', text: '', width: 0, height: 0 }));
    expect(project.reviewAnnotations[0]).toMatchObject({ id: 'review-a', time: 2, type: 'text', text: 'Review annotation', width: 0.22, height: 0.08 });

    manager.execute(new RemoveReviewAnnotationCommand(accessor, 'review-a'));
    expect(project.reviewAnnotations).toEqual([]);

    manager.undo();
    expect(project.reviewAnnotations[0].time).toBe(2);
    manager.undo();
    expect(project.reviewAnnotations[0].text).toBe('Reframe this area');
    manager.undo();
    expect(project.reviewAnnotations).toEqual([]);
    manager.redo();
    expect(project.reviewAnnotations[0].id).toBe('review-a');
  });

  it('adds, updates, removes, and restores collaboration notes', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new AddCollaborationNoteCommand(accessor, {
        id: 'collab-a',
        type: 'highlight',
        authorName: 'Alice',
        authorColor: '#38BDF8',
        start: 2,
        end: 4,
        text: '  Check this range  ',
        resolved: false
      })
    );
    expect(project.collaborationNotes).toEqual([
      {
        id: 'collab-a',
        type: 'highlight',
        authorName: 'Alice',
        authorColor: '#38bdf8',
        start: 2,
        end: 4,
        text: 'Check this range',
        resolved: false,
        createdAt: project.collaborationNotes[0].createdAt
      }
    ]);

    manager.execute(new UpdateCollaborationNoteCommand(accessor, 'collab-a', { resolved: true, text: 'Resolved range' }));
    expect(project.collaborationNotes[0]).toMatchObject({ id: 'collab-a', resolved: true, text: 'Resolved range' });

    manager.execute(new RemoveCollaborationNoteCommand(accessor, 'collab-a'));
    expect(project.collaborationNotes).toEqual([]);

    manager.undo();
    expect(project.collaborationNotes[0]).toMatchObject({ id: 'collab-a', resolved: true });
    manager.undo();
    expect(project.collaborationNotes[0]).toMatchObject({ id: 'collab-a', resolved: false, text: 'Check this range' });
    manager.undo();
    expect(project.collaborationNotes).toEqual([]);
    manager.redo();
    expect(project.collaborationNotes[0].id).toBe('collab-a');
  });

  it('adds, updates, removes, and restores timeline notes', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new AddTimelineNoteCommand(accessor, {
        id: 'note-a',
        start: 3,
        end: 1,
        text: '  Check alt take  ',
        color: '#38BDF8',
        createdAt: '2026-06-15T00:00:01.000Z'
      })
    );
    expect(project.timelineNotes).toEqual([
      { id: 'note-a', start: 1, end: 3, text: 'Check alt take', color: '#38bdf8', createdAt: '2026-06-15T00:00:01.000Z' }
    ]);

    manager.execute(new UpdateTimelineNoteCommand(accessor, 'note-a', { start: 2, end: 99, text: '', color: 'invalid' }));
    expect(project.timelineNotes[0]).toMatchObject({ id: 'note-a', start: 2, end: 10, text: 'Timeline note', color: '#facc15' });

    manager.execute(new RemoveTimelineNoteCommand(accessor, 'note-a'));
    expect(project.timelineNotes).toEqual([]);

    manager.undo();
    expect(project.timelineNotes[0].start).toBe(2);
    manager.undo();
    expect(project.timelineNotes[0].text).toBe('Check alt take');
    manager.undo();
    expect(project.timelineNotes).toEqual([]);
    manager.redo();
    expect(project.timelineNotes[0].id).toBe('note-a');
  });

  it('adds, updates, removes, and restores timeline bookmarks', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new AddProjectBookmarkCommand(accessor, { id: 'bookmark-b', time: 99, note: '  Outro  ' }));
    manager.execute(new AddProjectBookmarkCommand(accessor, { id: 'bookmark-a', time: 1, note: 'Intro' }));
    expect(project.bookmarks).toEqual([
      { id: 'bookmark-a', time: 1, note: 'Intro' },
      { id: 'bookmark-b', time: 10, note: 'Outro' }
    ]);

    manager.execute(new UpdateProjectBookmarkCommand(accessor, 'bookmark-b', { time: 2, note: '' }));
    expect(project.bookmarks).toEqual([
      { id: 'bookmark-a', time: 1, note: 'Intro' },
      { id: 'bookmark-b', time: 2, note: 'Bookmark' }
    ]);

    manager.execute(new RemoveProjectBookmarkCommand(accessor, 'bookmark-a'));
    expect(project.bookmarks.map((bookmark) => bookmark.id)).toEqual(['bookmark-b']);

    manager.undo();
    expect(project.bookmarks.map((bookmark) => bookmark.id)).toEqual(['bookmark-a', 'bookmark-b']);
    manager.undo();
    expect(project.bookmarks.find((bookmark) => bookmark.id === 'bookmark-b')?.note).toBe('Outro');
    manager.undo();
    manager.undo();
    expect(project.bookmarks).toEqual([]);
    manager.redo();
    expect(project.bookmarks[0].id).toBe('bookmark-b');
  });

  it('updates imported bookmarks as one undoable project command', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new UpdateProjectBookmarksCommand(accessor, [
        { id: 'bookmark-late', time: 99, note: 'Late' },
        { id: 'bookmark-a', time: 1.25, note: 'A' }
      ])
    );

    expect(project.bookmarks).toEqual([
      { id: 'bookmark-a', time: 1.25, note: 'A' },
      { id: 'bookmark-late', time: 10, note: 'Late' }
    ]);
    manager.undo();
    expect(project.bookmarks).toEqual([]);
    manager.redo();
    expect(project.bookmarks.map((bookmark) => bookmark.id)).toEqual(['bookmark-a', 'bookmark-late']);
  });

  it('rejects bookmark updates and removals when the bookmark is missing', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    expect(() => manager.execute(new UpdateProjectBookmarkCommand(accessor, 'missing-bookmark', { note: 'Missing' }))).toThrow('Timeline bookmark missing-bookmark not found');
    expect(() => manager.execute(new RemoveProjectBookmarkCommand(accessor, 'missing-bookmark'))).toThrow('Timeline bookmark missing-bookmark not found');
    expect(project.bookmarks).toEqual([]);
  });

  it('updates beat markers as one undoable project command', () => {
    let project = makeProject();
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-1', duration: 5 })]);
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new UpdateProjectBeatMarkersCommand(accessor, [
        { id: 'beat-late', time: 99 },
        { id: 'beat-a', time: 1.25 }
      ])
    );

    expect(project.beatMarkers).toEqual([
      { id: 'beat-a', time: 1.25 },
      { id: 'beat-late', time: 5 }
    ]);

    manager.undo();
    expect(project.beatMarkers).toEqual([]);
    manager.redo();
    expect(project.beatMarkers.map((marker) => marker.id)).toEqual(['beat-a', 'beat-late']);
  });

  it('updates export ranges as one undoable project command', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new UpdateProjectExportRangesCommand(accessor, [
        { id: 'range-late', label: 'Late', start: 99, end: 2 },
        { id: 'range-a', label: '  A roll  ', start: 1, end: 3 }
      ])
    );

    expect(project.exportRanges).toEqual([
      { id: 'range-a', label: 'A roll', start: 1, end: 3 },
      { id: 'range-late', label: 'Late', start: 2, end: 10 }
    ]);

    manager.undo();
    expect(project.exportRanges).toEqual([]);
    manager.redo();
    expect(project.exportRanges.map((range) => range.id)).toEqual(['range-a', 'range-late']);
  });

  it('updates protected ranges as one undoable project command', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(
      new UpdateProjectProtectedRangesCommand(accessor, [
        { id: 'protect-late', label: '  Chorus lock  ', start: 99, end: 4 },
        { id: 'protect-a', label: '', start: 1, end: 3 }
      ])
    );

    expect(project.protectedRanges).toEqual([
      { id: 'protect-a', label: 'Protected Range', start: 1, end: 3 },
      { id: 'protect-late', label: 'Chorus lock', start: 4, end: 10 }
    ]);

    manager.undo();
    expect(project.protectedRanges).toEqual([]);
    manager.redo();
    expect(project.protectedRanges.map((range) => range.id)).toEqual(['protect-a', 'protect-late']);
  });

  it('blocks protected range moves and ripple shifts', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'delete-me', start: 0, duration: 2 }),
        makeVideoClip({ id: 'protected', start: 4, duration: 2 })
      ])
    );
    const protectedRanges = [{ id: 'protect-a', label: 'Beat', start: 4, end: 6 }];

    expect(() => new MoveClipCommand(accessor, 'protected', 7, protectedRanges).execute()).toThrow('protected range');

    new RippleDeleteCommand(accessor, ['delete-me'], protectedRanges).execute();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([['protected', 4]]);
  });

  it('creates and ungroups clip groups with undo and redo', () => {
    let project = makeProject();
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 3, duration: 2 })]);
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new CreateClipGroupCommand(accessor, ['clip-b', 'clip-a'], { id: 'group-a', name: '  A Roll  ', color: 'green' }));
    expect(project.clipGroups).toEqual([{ id: 'group-a', name: 'A Roll', clipIds: ['clip-b', 'clip-a'], color: 'green' }]);
    expect(findCompleteClipGroup(project.clipGroups, ['clip-a', 'clip-b'])?.id).toBe('group-a');

    manager.execute(new UngroupCommand(accessor, 'group-a'));
    expect(project.clipGroups).toEqual([]);

    manager.undo();
    expect(project.clipGroups[0]?.id).toBe('group-a');
    manager.undo();
    expect(project.clipGroups).toEqual([]);
    manager.redo();
    expect(project.clipGroups[0]?.clipIds).toEqual(['clip-b', 'clip-a']);
  });

  it('calculates clip group move starts with a shared clamped delta', () => {
    const starts = calculateClipGroupMoveStarts(
      [makeVideoClip({ id: 'clip-a', start: 2 }), makeVideoClip({ id: 'clip-b', start: 5 })],
      ['clip-a', 'clip-b'],
      'clip-b',
      6.5
    );
    expect(starts).toEqual({ 'clip-a': 3.5, 'clip-b': 6.5 });

    const clamped = calculateClipGroupMoveStarts(
      [makeVideoClip({ id: 'clip-a', start: 2 }), makeVideoClip({ id: 'clip-b', start: 5 })],
      ['clip-a', 'clip-b'],
      'clip-b',
      -10
    );
    expect(clamped).toEqual({ 'clip-a': 0, 'clip-b': 3 });
  });

  it('batch updates grouped clip volume, speed, and color correction with undo', () => {
    let project = makeProject();
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 3, duration: 2 })]);
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];
    project.clipGroups = [{ id: 'group-a', name: 'A Roll', clipIds: ['clip-a', 'clip-b'], color: 'blue' }];
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new BatchUpdateClipGroupClipsCommand(accessor, 'group-a', { volume: 0.4, speed: 2, colorCorrection: { brightness: 0.25 } }));

    const clips = project.timeline.tracks[0].clips;
    expect(clips.map((clip) => ({ id: clip.id, volume: 'volume' in clip ? clip.volume : undefined, speed: clip.speed, duration: clip.duration, brightness: clip.colorCorrection.brightness }))).toEqual([
      { id: 'clip-a', volume: 0.4, speed: 2, duration: 1, brightness: 0.25 },
      { id: 'clip-b', volume: 0.4, speed: 2, duration: 1, brightness: 0.25 }
    ]);

    manager.undo();
    expect(project.timeline.tracks[0].clips.map((clip) => ({ id: clip.id, volume: 'volume' in clip ? clip.volume : undefined, speed: clip.speed, duration: clip.duration, brightness: clip.colorCorrection.brightness }))).toEqual([
      { id: 'clip-a', volume: 1, speed: 1, duration: 2, brightness: 0 },
      { id: 'clip-b', volume: 1, speed: 1, duration: 2, brightness: 0 }
    ]);
  });

  it('deletes clip groups as one undoable project command', () => {
    let project = makeProject();
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 3, duration: 2 })]);
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];
    project.clipGroups = [{ id: 'group-a', name: 'A Roll', clipIds: ['clip-a', 'clip-b'], color: 'blue' }];
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new DeleteGroupCommand(accessor, 'group-a'));
    expect(project.clipGroups).toEqual([]);
    expect(project.timeline.tracks[0].clips).toEqual([]);

    manager.undo();
    expect(project.clipGroups[0]?.id).toBe('group-a');
    expect(project.timeline.tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-a', 'clip-b']);
  });

  it('packs selected clips into a nested sequence with undo and redo', () => {
    let project = makeProject();
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 2, duration: 2 })]);
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new PackNestedSequenceCommand(accessor, ['clip-a', 'clip-b'], 'Nested A'));

    const nestedClip = project.timeline.tracks[0].clips[0];
    expect(nestedClip).toMatchObject({ type: 'nested-sequence', name: 'Nested A', start: 0, duration: 4 });
    expect(project.sequences).toHaveLength(2);
    expect(project.sequences[1].timeline.tracks[0].clips.map((clip) => ({ id: clip.id, start: clip.start }))).toEqual([
      { id: 'clip-a', start: 0 },
      { id: 'clip-b', start: 2 }
    ]);

    manager.undo();
    expect(project.timeline.tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-a', 'clip-b']);
    expect(project.sequences).toHaveLength(1);

    manager.redo();
    expect(project.timeline.tracks[0].clips[0].type).toBe('nested-sequence');
    expect(project.sequences).toHaveLength(2);
  });

  it('rejects updates and removals for missing timeline markers', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    expect(() => manager.execute(new UpdateTimelineMarkerCommand(accessor, 'missing-marker', { label: 'Missing' }))).toThrow('missing-marker not found');
    expect(() => manager.execute(new RemoveTimelineMarkerCommand(accessor, 'missing-marker'))).toThrow('missing-marker not found');
  });

  it('clamps track volume updates', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(new UpdateTrackCommand(accessor, 'track-video', { volume: 9, pan: 9 }));
    expect(accessor.current().tracks[0].volume).toBe(2);
    expect(accessor.current().tracks[0].pan).toBe(1);
  });

  it('clamps track EQ and compressor updates', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(
      new UpdateTrackCommand(accessor, 'track-video', {
        eq: {
          enabled: true,
          bands: [
            { id: 'eq-low', type: 'lowshelf', frequency: 5, gain: 99, q: 0.01 },
            { id: 'eq-low-mid', type: 'peaking', frequency: 50_000, gain: -99, q: 9 },
            { id: 'eq-high-mid', type: 'peaking', frequency: 2500, gain: 0, q: 1 },
            { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: 0, q: 1 }
          ]
        },
        compressor: { enabled: true, threshold: -90, ratio: 99, attack: -1, release: 99_999, makeupGain: 99 }
      })
    );

    expect(accessor.current().tracks[0].eq?.bands[0]).toMatchObject({ frequency: 20, gain: 24, q: 0.1 });
    expect(accessor.current().tracks[0].eq?.bands[1]).toMatchObject({ frequency: 20000, gain: -24, q: 4 });
    expect(accessor.current().tracks[0].compressor).toMatchObject({ threshold: -60, ratio: 20, attack: 0.01, release: 9000, makeupGain: 24 });
  });

  it('updates project audio controls with undo and redo', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new UpdateProjectAudioCommand(accessor, { masterVolume: 3 }));
    expect(project.masterVolume).toBe(2);

    manager.undo();
    expect(project.masterVolume).toBe(1);

    manager.redo();
    expect(project.masterVolume).toBe(2);
  });

  it('updates project cover path with undo and redo', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new UpdateProjectCoverCommand(accessor, 'C:\\Projects\\cover.png'));
    expect(project.coverPath).toBe('C:/Projects/cover.png');

    manager.undo();
    expect(project.coverPath).toBeUndefined();

    manager.redo();
    expect(project.coverPath).toBe('C:/Projects/cover.png');
  });

  it('manages project speaker library with undo and redo', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new UpdateProjectSpeakersCommand(accessor, [{ id: 'speaker-a', name: 'Alice', color: '#FF0000' }]));
    expect(project.speakers).toEqual([{ id: 'speaker-a', name: 'Alice', color: '#ff0000' }]);

    manager.execute(new UpdateProjectSpeakersCommand(accessor, [{ id: 'speaker-a', name: 'Alice Cooper', color: '#00ff00' }]));
    expect(project.speakers).toEqual([{ id: 'speaker-a', name: 'Alice Cooper', color: '#00ff00' }]);

    manager.execute(new UpdateProjectSpeakersCommand(accessor, []));
    expect(project.speakers).toEqual([]);

    manager.undo();
    expect(project.speakers).toEqual([{ id: 'speaker-a', name: 'Alice Cooper', color: '#00ff00' }]);

    manager.undo();
    expect(project.speakers).toEqual([{ id: 'speaker-a', name: 'Alice', color: '#ff0000' }]);
  });

  it('updates project documentation with undo and redo', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new UpdateProjectDocumentationCommand(accessor, { description: '# Brief', notes: 'Cut v1' }));
    expect(project.documentation).toEqual({ description: '# Brief', notes: 'Cut v1' });

    manager.undo();
    expect(project.documentation).toEqual({});

    manager.redo();
    expect(project.documentation).toEqual({ description: '# Brief', notes: 'Cut v1' });
  });

  it('moves, trims, splits, deletes, and updates clips', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 10 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);

    manager.execute(new TrimClipCommand(accessor, 'clip-1', 1, 1));
    expect(accessor.current().tracks[0].clips[0].duration).toBe(8);

    manager.execute(new UpdateClipCommand(accessor, 'clip-1', { name: 'Renamed', transform: { opacity: 0.5 } }));
    expect(accessor.current().tracks[0].clips[0].name).toBe('Renamed');
    expect(accessor.current().tracks[0].clips[0].transform.opacity).toBe(0.5);

    manager.execute(new SplitClipCommand(accessor, 'clip-1', 5));
    expect(accessor.current().tracks[0].clips).toHaveLength(2);

    const firstSplitId = accessor.current().tracks[0].clips[0].id;
    manager.execute(new DeleteClipCommand(accessor, firstSplitId));
    expect(accessor.current().tracks[0].clips).toHaveLength(1);

    manager.undo();
    expect(accessor.current().tracks[0].clips).toHaveLength(2);
    manager.undo();
    expect(accessor.current().tracks[0].clips).toHaveLength(1);
  });

  it('snaps selected clip starts to nearby beats with undo and rejects overlaps', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-a', start: 0.9, duration: 0.5 }),
        makeVideoClip({ id: 'clip-b', start: 2.12, duration: 0.5 }),
        makeAudioClip({ id: 'audio-a', start: 4.08, duration: 1 })
      ])
    );
    const manager = new CommandManager();
    const command = new SnapToBeatsCommand(accessor, ['clip-a', 'clip-b', 'audio-a'], [1, 2, 4], 0.2);

    manager.execute(command);

    expect(command.appliedUpdates).toEqual([
      { clipId: 'clip-a', from: 0.9, to: 1 },
      { clipId: 'clip-b', from: 2.12, to: 2 },
      { clipId: 'audio-a', from: 4.08, to: 4 }
    ]);
    expect(accessor.current().tracks[0].clips.map((clip) => clip.start)).toEqual([1, 2]);
    expect(accessor.current().tracks[1].clips[0].start).toBe(4);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.start)).toEqual([0.9, 2.12]);
    expect(accessor.current().tracks[1].clips[0].start).toBe(4.08);

    const overlapping = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-a', start: 0.9, duration: 1 }),
        makeVideoClip({ id: 'clip-b', start: 1.2, duration: 1 })
      ])
    );
    expect(() => new SnapToBeatsCommand(overlapping, ['clip-a'], [1.1], 0.3).execute()).toThrow('overlaps');
  });

  it('aligns selected video clip starts and ends to nearby beats as one undoable batch', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-a', start: 0.97, duration: 1.06 }),
        makeVideoClip({ id: 'clip-b', start: 3.02, duration: 0.96 }),
        makeAudioClip({ id: 'audio-a', start: 4.02, duration: 1 })
      ])
    );
    const manager = new CommandManager();
    const command = new BatchAlignToBeatCommand(accessor, ['clip-a', 'clip-b', 'audio-a'], [1, 2, 3, 4], { maxDistance: 0.05 });

    manager.execute(command);

    expect(command.appliedUpdates).toEqual([
      { clipId: 'clip-a', fromStart: 0.97, toStart: 1, fromEnd: 2.03, toEnd: 2, startError: 0.03, endError: 0.03 },
      { clipId: 'clip-b', fromStart: 3.02, toStart: 3, fromEnd: 3.98, toEnd: 4, startError: 0.02, endError: 0.02 }
    ]);
    expect(accessor.current().tracks[0].clips.map((clip) => ({ id: clip.id, start: clip.start, duration: clip.duration }))).toEqual([
      { id: 'clip-a', start: 1, duration: 1 },
      { id: 'clip-b', start: 3, duration: 1 }
    ]);

    manager.undo();

    expect(accessor.current().tracks[0].clips.map((clip) => ({ id: clip.id, start: clip.start, duration: clip.duration }))).toEqual([
      { id: 'clip-a', start: 0.97, duration: 1.06 },
      { id: 'clip-b', start: 3.02, duration: 0.96 }
    ]);
    expect(accessor.current().tracks[1].clips[0].start).toBe(4.02);
  });

  it('updates clip uniform and independent canvas scale values', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', transform: { scale: 1, scaleX: 1, scaleY: 1 } })]));
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-1', { transform: { scale: 0.5 } }));
    expect(accessor.current().tracks[0].clips[0].transform).toMatchObject({ scale: 0.5, scaleX: 0.5, scaleY: 0.5 });

    manager.execute(new UpdateClipCommand(accessor, 'clip-1', { transform: { scaleX: 1.25, scaleY: 0.75 } }));
    expect(accessor.current().tracks[0].clips[0].transform).toMatchObject({ scale: 1, scaleX: 1.25, scaleY: 0.75 });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].transform).toMatchObject({ scale: 0.5, scaleX: 0.5, scaleY: 0.5 });
  });

  it('updates and normalizes spatial audio through clip commands', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-1', { spatialAudio: { x: -2, y: 0.25, z: 4, distance: 'far' } }));

    expect(accessor.current().tracks[0].clips[0].spatialAudio).toMatchObject({ x: -1, y: 0.25, z: 1, distance: 'far' });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].spatialAudio).toMatchObject({ x: 0, y: 0, z: 0, distance: 'medium' });
  });

  it('applies PiP layout to two visual clips as one undoable command', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-main', transform: { x: 40, y: 30, scaleX: 0.7, scaleY: 0.7 } }),
        makeVideoClip({ id: 'clip-pip', transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 }, border: { enabled: false, color: '#000000', width: 2 } })
      ])
    );
    const manager = new CommandManager();

    manager.execute(
      new PiPLayoutCommand(accessor, 'clip-main', 'clip-pip', {
        position: 'bottom-right',
        canvasWidth: 1280,
        canvasHeight: 720,
        pipSourceWidth: 1280,
        pipSourceHeight: 720
      })
    );

    const [main, pip] = accessor.current().tracks[0].clips;
    expect(main.transform).toMatchObject({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    expect(main.border).toMatchObject({ enabled: false });
    expect(pip.transform).toMatchObject({ x: 448, y: 238, scaleX: 0.25, scaleY: 0.25 });
    expect(pip.border).toMatchObject({ enabled: true, color: '#ffffff', width: 6 });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].transform).toMatchObject({ x: 40, y: 30, scaleX: 0.7, scaleY: 0.7 });
    expect(accessor.current().tracks[0].clips[1].transform).toMatchObject({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    expect(accessor.current().tracks[0].clips[1].border).toMatchObject({ enabled: false, color: '#000000', width: 2 });
  });

  it('calculates media replacement duration modes', () => {
    const clip = makeVideoClip({ id: 'clip-replace', duration: 4 });
    const media = { id: 'media-new', duration: 10 };

    expect(calculateReplaceMediaPatch(clip, media, 'trim-to-original')).toMatchObject({ mediaId: 'media-new', duration: 4, trimStart: 0, trimEnd: 6, speed: 1 });
    expect(calculateReplaceMediaPatch(clip, media, 'stretch-to-fit')).toMatchObject({ mediaId: 'media-new', duration: 4, trimStart: 0, trimEnd: 0, speed: 2.5 });
    expect(calculateReplaceMediaPatch(clip, media, 'use-new-duration')).toMatchObject({ mediaId: 'media-new', duration: 10, trimStart: 0, trimEnd: 0, speed: 1 });
  });

  it('replaces media while preserving clip properties and undoing original media', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-replace',
          mediaId: 'media-old',
          duration: 4,
          colorCorrection: { ...DEFAULT_COLOR_CORRECTION, brightness: 0.25 },
          keyframes: { opacity: [{ id: 'kf-opacity', time: 1, value: 0.5, easing: 'linear' }] }
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new ReplaceMediaCommand(accessor, 'clip-replace', { id: 'media-new', duration: 6 }, 'trim-to-original'));

    const replaced = accessor.current().tracks[0].clips[0];
    expect(replaced).toMatchObject({
      id: 'clip-replace',
      mediaId: 'media-new',
      duration: 4,
      trimEnd: 2,
      colorCorrection: { brightness: 0.25 },
      keyframes: { opacity: [{ id: 'kf-opacity', time: 1, value: 0.5, easing: 'linear' }] }
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ mediaId: 'media-old', duration: 4, trimEnd: 0 });
  });

  it('switches media versions as an undoable media clip command', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-version', mediaId: 'media-v1', duration: 8 })]));
    const manager = new CommandManager();

    manager.execute(new SwitchMediaVersionCommand(accessor, 'clip-version', { id: 'media-v2', duration: 5 }));

    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      id: 'clip-version',
      mediaId: 'media-v2',
      duration: 5,
      trimStart: 0,
      trimEnd: 0
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ mediaId: 'media-v1', duration: 8 });
  });

  it('applies style transfer as one undoable timeline command', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'source-style', start: 0, colorCorrection: { brightness: 0.6, saturation: 1.6 } }),
        makeVideoClip({ id: 'target-style', start: 12, colorCorrection: { brightness: 0, saturation: 1 } })
      ])
    );
    const manager = new CommandManager();
    const summary = calculateStyleSummary([accessor.current().tracks[0].clips[0]]);

    manager.execute(new ApplyStyleCommand(accessor, summary, { strength: 50, clipIds: ['target-style'] }));

    expect(accessor.current().tracks[0].clips[0].colorCorrection.brightness).toBe(0.6);
    expect(accessor.current().tracks[0].clips[1].colorCorrection).toMatchObject({ brightness: 0.3, saturation: 1.3 });

    manager.undo();
    expect(accessor.current().tracks[0].clips[1].colorCorrection).toMatchObject({ brightness: 0, saturation: 1 });
  });

  it('reports media replacement compatibility warnings', () => {
    const clip = makeVideoClip({ id: 'clip-video', keyframes: { volume: [{ id: 'kf-volume', time: 1, value: 0.2, easing: 'linear' }] } });

    expect(getReplaceMediaCompatibilityWarnings(clip, { type: 'image', hasAudio: false })).toEqual(['media-type-mismatch', 'missing-audio-for-audio-properties']);
    expect(getReplaceMediaCompatibilityWarnings(clip, { type: 'video', hasAudio: true })).toEqual([]);
  });

  it('removes silent ranges as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-audio', duration: 2.5 })]));
    const manager = new CommandManager();

    manager.execute(new RemoveSilenceCommand(accessor, 'clip-audio', [{ start: 1, end: 1.5 }]));

    const clips = accessor.current().tracks[1].clips;
    expect(clips).toHaveLength(2);
    expect(clips.map((clip) => clip.start)).toEqual([0, 1]);
    expect(clips.map((clip) => clip.duration)).toEqual([1, 1]);
    expect(clips.map((clip) => clip.trimStart)).toEqual([0, 1.5]);
    expect(clips.map((clip) => clip.trimEnd)).toEqual([1.5, 0]);

    manager.undo();
    expect(accessor.current().tracks[1].clips).toEqual([makeAudioClip({ id: 'clip-audio', duration: 2.5 })]);

    manager.redo();
    expect(accessor.current().tracks[1].clips).toHaveLength(2);
  });

  it('normalizes silence ranges and rejects no-op or destructive silence removal', () => {
    const accessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-audio', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(
      new RemoveSilenceCommand(accessor, 'clip-audio', [
        { start: 2.5, end: 1.5 },
        { start: 1, end: 2 }
      ])
    );
    expect(accessor.current().tracks[1].clips.map((clip) => [clip.start, clip.duration, clip.trimStart])).toEqual([
      [0, 1, 0],
      [1, 0.5, 2.5]
    ]);

    const noOpAccessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-noop', duration: 3 })]));
    expect(() => new RemoveSilenceCommand(noOpAccessor, 'clip-noop', []).execute()).toThrow('No silence ranges');

    const fullAccessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-full', duration: 3 })]));
    expect(() => new RemoveSilenceCommand(fullAccessor, 'clip-full', [{ start: 0, end: 3 }]).execute()).toThrow('entire clip');

    new RemoveSilenceCommand(fullAccessor, 'clip-full', [{ start: 1, end: 2 }]).undo();
  });

  it('splits a clip at multiple scene times as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-scene', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new SplitClipAtTimesCommand(accessor, 'clip-scene', [1, 2]));

    expect(accessor.current().tracks[0].clips.map((clip) => [clip.start, clip.duration, clip.trimStart, clip.trimEnd])).toEqual([
      [0, 1, 0, 2],
      [1, 1, 1, 1],
      [2, 1, 2, 0]
    ]);

    manager.undo();
    expect(accessor.current().tracks[0].clips).toEqual([makeVideoClip({ id: 'clip-scene', duration: 3 })]);
  });

  it('splits scene cut batches and restores clip count with one undo', () => {
    const original = makeVideoClip({ id: 'clip-scene-batch', duration: 4, scenecuts: [1, 2.5, 3.7] });
    const accessor = makeAccessor(makeTimeline([original]));
    const manager = new CommandManager();

    manager.execute(new BatchSplitAtSceneCutsCommand(accessor, [{ clipId: original.id, minSceneSeconds: 1 }]));

    expect(accessor.current().tracks[0].clips.map((clip) => [clip.start, clip.duration])).toEqual([
      [0, 1],
      [1, 1.5],
      [2.5, 1.5]
    ]);
    expect(accessor.current().tracks[0].clips.every((clip) => clip.scenecuts === undefined)).toBe(true);
    manager.undo();
    expect(accessor.current().tracks[0].clips).toEqual([original]);
  });

  it('adds scene markers as one undoable batch', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-marker-source', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(
      new BatchAddMarkersCommand(accessor, [
        { id: 'scene-marker-2', time: 2, label: '场景 2', color: '#f97316' },
        { id: 'scene-marker-1', time: 1, label: '场景 1', color: '#f97316' }
      ])
    );

    expect(accessor.current().markers?.map((marker) => marker.label)).toEqual(['场景 1', '场景 2']);
    manager.undo();
    expect(accessor.current().markers).toBeUndefined();
  });

  it('rejects empty scene batches and normalizes clip scene cut updates', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-update-scenes', duration: 3 })]));
    const manager = new CommandManager();

    expect(() => manager.execute(new BatchSplitAtSceneCutsCommand(accessor, []))).toThrow('No valid scene cuts');
    expect(() => manager.execute(new BatchSplitAtSceneCutsCommand(accessor, [{ clipId: 'clip-update-scenes', cuts: [0, 3] }]))).toThrow('No valid scene cuts');
    expect(() => manager.execute(new BatchAddMarkersCommand(accessor, []))).toThrow('No timeline markers');

    manager.execute(new UpdateClipCommand(accessor, 'clip-update-scenes', { scenecuts: [2, Number.NaN, -1, 9, 2] }));
    expect(accessor.current().tracks[0].clips[0].scenecuts).toEqual([0, 2, 3]);

    manager.execute(new UpdateClipCommand(accessor, 'clip-update-scenes', { scenecuts: [] }));
    expect(accessor.current().tracks[0].clips[0].scenecuts).toBeUndefined();

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].scenecuts).toEqual([0, 2, 3]);
  });

  it('splits a clip at beat times and restores the whole edit with one undo', () => {
    const original = makeVideoClip({ id: 'clip-beat-split', start: 1, duration: 3 });
    const accessor = makeAccessor(makeTimeline([original]));
    const manager = new CommandManager();
    const splitTimes = calculateBeatSplitTimesForClip(original, [1.5, 2.5, 4]);

    manager.execute(new SplitClipAtTimesCommand(accessor, original.id, splitTimes));

    expect(splitTimes).toEqual([0.5, 1.5]);
    expect(accessor.current().tracks[0].clips).toHaveLength(3);
    manager.undo();
    expect(accessor.current().tracks[0].clips).toEqual([original]);
  });

  it('splits clip keyframes with scene split ranges and rejects invalid split points', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-keyed-scene',
          duration: 2,
          keyframes: {
            opacity: [
              { id: 'kf-left', time: 0.5, value: 0.5, easing: 'linear' },
              { id: 'kf-right', time: 1.5, value: 0.25, easing: 'linear' }
            ]
          }
        })
      ])
    );

    new SplitClipAtTimesCommand(accessor, 'clip-keyed-scene', []).undo();
    const command = new SplitClipAtTimesCommand(accessor, 'clip-keyed-scene', [1]);
    command.execute();

    const clips = accessor.current().tracks[0].clips;
    expect(clips[0].keyframes?.opacity).toEqual([{ id: 'kf-left', time: 0.5, value: 0.5, easing: 'linear' }]);
    expect(clips[1].keyframes?.opacity).toEqual([{ id: 'kf-right', time: 0.5, value: 0.25, easing: 'linear' }]);

    const invalidAccessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-invalid', duration: 2 })]));
    expect(() => new SplitClipAtTimesCommand(invalidAccessor, 'clip-invalid', [0, 2]).execute()).toThrow('No valid split points');
  });

  it('adds, updates, removes, and restores clip keyframes with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 2 })]));
    const manager = new CommandManager();

    manager.execute(new AddKeyframeCommand(accessor, 'clip-1', 'opacity', { id: 'kf-a', time: 0, value: 1 }));
    manager.execute(new AddKeyframeCommand(accessor, 'clip-1', 'opacity', { id: 'kf-b', time: 1, value: 0.25, easing: 'ease-out' }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity).toEqual([
      { id: 'kf-a', time: 0, value: 1, easing: 'linear' },
      { id: 'kf-b', time: 1, value: 0.25, easing: 'ease-out' }
    ]);

    manager.execute(new UpdateKeyframeCommand(accessor, 'clip-1', 'opacity', 'kf-b', { time: 99, value: -1, easing: 'ease-in-out' }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[1]).toEqual({ id: 'kf-b', time: 2, value: 0, easing: 'ease-in-out' });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[1]).toEqual({ id: 'kf-b', time: 1, value: 0.25, easing: 'ease-out' });

    manager.execute(new RemoveKeyframeCommand(accessor, 'clip-1', 'opacity', 'kf-a'));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.map((frame) => frame.id)).toEqual(['kf-b']);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.map((frame) => frame.id)).toEqual(['kf-a', 'kf-b']);
  });

  it('batch updates volume keyframes and restores every clip with one undo', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeAudioClip({ id: 'music-a', start: 0, duration: 3 }),
        makeAudioClip({ id: 'music-b', start: 3, duration: 3 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(
      new BatchUpdateKeyframeCommand(accessor, [
        {
          clipId: 'music-a',
          property: 'volume',
          keyframes: [
            { id: 'duck-a-0', time: 0.5, value: 1 },
            { id: 'duck-a-1', time: 1, value: 0.35 }
          ]
        },
        {
          clipId: 'music-b',
          property: 'volume',
          keyframes: [
            { id: 'duck-b-0', time: 0, value: 0.35 },
            { id: 'duck-b-1', time: 1, value: 1 }
          ]
        }
      ])
    );

    const clips = accessor.current().tracks[1].clips;
    expect(clips[0].keyframes?.volume?.map((frame) => frame.id)).toEqual(['duck-a-0', 'duck-a-1']);
    expect(clips[1].keyframes?.volume?.map((frame) => frame.id)).toEqual(['duck-b-0', 'duck-b-1']);

    manager.undo();
    expect(accessor.current().tracks[1].clips[0].keyframes).toBeUndefined();
    expect(accessor.current().tracks[1].clips[1].keyframes).toBeUndefined();
  });

  it('batch shifts selected keyframes and clamps times inside clip duration', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-batch',
          duration: 2,
          keyframes: {
            x: [{ id: 'kf-x', time: 0.25, value: 0, easing: 'linear' }],
            opacity: [{ id: 'kf-opacity', time: 1.8, value: 0.5, easing: 'ease-out' }]
          }
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(
      new BatchKeyframeEditCommand(
        accessor,
        [
          { clipId: 'clip-batch', property: 'x', keyframeId: 'kf-x' },
          { clipId: 'clip-batch', property: 'opacity', keyframeId: 'kf-opacity' }
        ],
        { type: 'shift', delta: 0.5 }
      )
    );

    const clip = accessor.current().tracks[0].clips[0];
    expect(clip.keyframes?.x?.[0].time).toBe(0.75);
    expect(clip.keyframes?.opacity?.[0].time).toBe(2);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.x?.[0].time).toBe(0.25);
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[0].time).toBe(1.8);
  });

  it('batch scales selected keyframes around the absolute selection center', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-a',
          start: 0,
          duration: 4,
          keyframes: { x: [{ id: 'kf-a', time: 1, value: 0, easing: 'linear' }] }
        }),
        makeVideoClip({
          id: 'clip-b',
          start: 2,
          duration: 5,
          keyframes: { opacity: [{ id: 'kf-b', time: 3, value: 0.5, easing: 'linear' }] }
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(
      new BatchKeyframeEditCommand(
        accessor,
        [
          { clipId: 'clip-a', property: 'x', keyframeId: 'kf-a' },
          { clipId: 'clip-b', property: 'opacity', keyframeId: 'kf-b' }
        ],
        { type: 'scale-time', factor: 0.5 }
      )
    );

    const [clipA, clipB] = accessor.current().tracks[0].clips;
    expect(clipA.keyframes?.x?.[0].time).toBe(2);
    expect(clipB.keyframes?.opacity?.[0].time).toBe(2);
  });

  it('batch deletes and unifies easing as undoable keyframe edits', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-batch',
          duration: 3,
          keyframes: {
            x: [{ id: 'kf-x', time: 0.5, value: 0, easing: 'linear' }],
            opacity: [{ id: 'kf-opacity', time: 1, value: 0.5, easing: 'ease-out' }]
          }
        })
      ])
    );
    const manager = new CommandManager();
    const refs = [
      { clipId: 'clip-batch', property: 'x' as const, keyframeId: 'kf-x' },
      { clipId: 'clip-batch', property: 'opacity' as const, keyframeId: 'kf-opacity' }
    ];

    manager.execute(new BatchKeyframeEditCommand(accessor, refs, { type: 'easing', easing: 'ease-in-out' }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.x?.[0].easing).toBe('ease-in-out');
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[0].easing).toBe('ease-in-out');

    manager.execute(new BatchKeyframeEditCommand(accessor, [refs[1]], { type: 'delete' }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity).toBeUndefined();

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[0].easing).toBe('ease-in-out');
    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.x?.[0].easing).toBe('linear');
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[0].easing).toBe('ease-out');
  });

  it('updates bezier keyframe handles and restores them through undo', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-handles',
          duration: 3,
          keyframes: {
            opacity: [{ id: 'kf-opacity', time: 1, value: 0.5, easing: 'linear', outHandle: { dx: 0.2, dy: 0.1 }, handleMode: 'independent' }]
          }
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(
      new UpdateKeyframeCommand(accessor, 'clip-handles', 'opacity', 'kf-opacity', {
        outHandle: { dx: 0.5, dy: -0.2 },
        handleMode: 'broken'
      })
    );
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[0]).toMatchObject({
      outHandle: { dx: 0.5, dy: -0.2 },
      handleMode: 'broken'
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[0]).toMatchObject({
      outHandle: { dx: 0.2, dy: 0.1 },
      handleMode: 'independent'
    });
  });

  it('distributes selected keyframe times and aligns values as undoable batch edits', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-align',
          duration: 4,
          keyframes: {
            opacity: [
              { id: 'kf-a', time: 0, value: 0.2, easing: 'linear' },
              { id: 'kf-b', time: 0.25, value: 0.5, easing: 'linear' },
              { id: 'kf-c', time: 2, value: 0.8, easing: 'linear' }
            ]
          }
        })
      ])
    );
    const manager = new CommandManager();
    const refs = ['kf-a', 'kf-b', 'kf-c'].map((keyframeId) => ({ clipId: 'clip-align', property: 'opacity' as const, keyframeId }));

    manager.execute(new BatchKeyframeEditCommand(accessor, refs, { type: 'distribute-time' }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.map((frame) => frame.time)).toEqual([0, 1, 2]);

    manager.execute(new BatchKeyframeEditCommand(accessor, refs, { type: 'align-value', value: 0.4 }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.map((frame) => frame.value)).toEqual([0.4, 0.4, 0.4]);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.map((frame) => frame.value)).toEqual([0.2, 0.5, 0.8]);
  });

  it('applies text animation presets through an undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeTextClip({ id: 'text-1', duration: 2, text: 'Title' })]));
    const manager = new CommandManager();

    manager.execute(new ApplyTextAnimationCommand(accessor, 'text-1', { preset: 'fade', duration: 0.4, direction: 'in' }));
    expect(accessor.current().tracks[2].clips[0].keyframes?.opacity?.map((frame) => [frame.time, frame.value])).toEqual([
      [0, 0],
      [0.4, 1]
    ]);

    manager.undo();
    expect(accessor.current().tracks[2].clips[0].keyframes).toBeUndefined();
    manager.redo();
    expect(accessor.current().tracks[2].clips[0].keyframes?.opacity).toHaveLength(2);
  });

  it('rejects updates and removals for missing keyframes', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    expect(() => manager.execute(new UpdateKeyframeCommand(accessor, 'clip-1', 'opacity', 'missing', { value: 0 }))).toThrow('Keyframe missing not found');
    expect(() => manager.execute(new RemoveKeyframeCommand(accessor, 'clip-1', 'opacity', 'missing'))).toThrow('Keyframe missing not found');
  });

  it('updates text style safely', () => {
    const accessor = makeAccessor(makeTimeline([makeTextClip()]));
    const manager = new CommandManager();
    manager.execute(
      new UpdateClipCommand(accessor, 'text-1', {
        text: 'Updated',
        style: { bold: true, color: '#ff0000', backgroundColor: '#102030', backgroundOpacity: 0.4 }
      })
    );
    const text = accessor.current().tracks[2].clips[0];
    expect(text.type).toBe('text');
    if (text.type === 'text') {
      expect(text.text).toBe('Updated');
      expect(text.style.bold).toBe(true);
      expect(text.style.color).toBe('#ff0000');
      expect(text.style.backgroundColor).toBe('#102030');
      expect(text.style.backgroundOpacity).toBe(0.4);
    }
  });

  it('restores rich text formatting on undo', () => {
    const accessor = makeAccessor(makeTimeline([makeTextClip({ id: 'text-rich', text: 'Plain' })]));
    const manager = new CommandManager();

    manager.execute(
      new UpdateClipCommand(accessor, 'text-rich', {
        text: 'Plain Bold',
        richText: {
          paragraphs: [
            {
              runs: [
                { text: 'Plain ' },
                { text: 'Bold', bold: true, underline: true, color: '#ff4fd8', fontSize: 72 }
              ]
            }
          ]
        }
      })
    );

    const updated = accessor.current().tracks[2].clips[0];
    expect(updated.type).toBe('text');
    if (updated.type === 'text') {
      expect(updated.richText?.paragraphs[0].runs[1]).toMatchObject({ text: 'Bold', bold: true, underline: true, color: '#ff4fd8', fontSize: 72 });
    }

    manager.undo();
    const reverted = accessor.current().tracks[2].clips[0];
    expect(reverted.type).toBe('text');
    if (reverted.type === 'text') {
      expect(reverted.text).toBe('Plain');
      expect(reverted.richText?.paragraphs[0].runs).toEqual([{ text: 'Plain' }]);
    }
  });

  it('updates clip opacity, volume, and text style through undoable commands', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-video', volume: 1, transform: { opacity: 1 } }),
        makeTextClip({ id: 'clip-text', style: { color: '#ffffff', backgroundColor: '#000000', backgroundOpacity: 0 } })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { volume: 1.5, transform: { opacity: 0.35 } }));
    manager.execute(
      new UpdateClipCommand(accessor, 'clip-text', {
        style: { fontSize: 72, color: '#ff4fd8', backgroundColor: '#00e5ff', backgroundOpacity: 0.45 }
      })
    );

    const video = accessor.current().tracks[0].clips[0];
    const text = accessor.current().tracks[2].clips[0];
    expect(video.type).toBe('video');
    if (video.type === 'video') {
      expect(video.volume).toBe(1.5);
      expect(video.transform.opacity).toBe(0.35);
    }
    expect(text.type).toBe('text');
    if (text.type === 'text') {
      expect(text.style.fontSize).toBe(72);
      expect(text.style.color).toBe('#ff4fd8');
      expect(text.style.backgroundColor).toBe('#00e5ff');
      expect(text.style.backgroundOpacity).toBe(0.45);
    }

    manager.undo();
    const revertedText = accessor.current().tracks[2].clips[0];
    expect(revertedText.type).toBe('text');
    if (revertedText.type === 'text') {
      expect(revertedText.style.color).toBe('#ffffff');
      expect(revertedText.style.backgroundOpacity).toBe(0);
    }
    manager.undo();
    const revertedVideo = accessor.current().tracks[0].clips[0];
    expect(revertedVideo.type).toBe('video');
    if (revertedVideo.type === 'video') {
      expect(revertedVideo.volume).toBe(1);
      expect(revertedVideo.transform.opacity).toBe(1);
    }
  });

  it('updates speed and color correction through undoable commands', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3, speed: 1 })]));
    const manager = new CommandManager();

    manager.execute(
      new UpdateClipCommand(accessor, 'clip-video', {
        speed: 2,
        colorCorrection: { brightness: 0.5, contrast: 1.25, saturation: 1.5, hue: 60 }
      })
    );

    const updated = accessor.current().tracks[0].clips[0];
    expect(updated.speed).toBe(2);
    expect(updated.duration).toBe(1.5);
    expect(updated.colorCorrection).toEqual({ ...DEFAULT_COLOR_CORRECTION, brightness: 0.5, contrast: 1.25, saturation: 1.5, hue: 60, lutPath: null });

    manager.undo();
    const reverted = accessor.current().tracks[0].clips[0];
    expect(reverted.speed).toBe(1);
    expect(reverted.duration).toBe(3);
    expect(reverted.colorCorrection).toEqual(DEFAULT_COLOR_CORRECTION);
  });

  it('batch updates clip color correction with undo', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'clip-b', start: 2, duration: 2 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(
      new BatchUpdateClipCommand(accessor, [
        { clipId: 'clip-a', patch: { colorCorrection: { brightness: 0.2 } } },
        { clipId: 'clip-b', patch: { colorCorrection: { contrast: 1.4, saturation: 0.8 } } }
      ])
    );

    const [clipA, clipB] = accessor.current().tracks[0].clips;
    expect(clipA.colorCorrection.brightness).toBe(0.2);
    expect(clipB.colorCorrection.contrast).toBe(1.4);
    expect(clipB.colorCorrection.saturation).toBe(0.8);

    manager.undo();
    const [revertedA, revertedB] = accessor.current().tracks[0].clips;
    expect(revertedA.colorCorrection).toEqual(DEFAULT_COLOR_CORRECTION);
    expect(revertedB.colorCorrection).toEqual(DEFAULT_COLOR_CORRECTION);
  });

  it('clamps speed and color correction patches', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { speed: 100, colorCorrection: { brightness: 4, contrast: 4, saturation: -2, hue: 400 } }));

    const updated = accessor.current().tracks[0].clips[0];
    expect(updated.speed).toBe(4);
    expect(updated.colorCorrection).toEqual({ ...DEFAULT_COLOR_CORRECTION, brightness: 1, contrast: 2, saturation: 0, hue: 180, lutPath: null });
  });

  it('updates the first chroma key sample when patching the legacy color field', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-video',
          duration: 3,
          chromaKey: {
            enabled: true,
            color: [0, 255, 0],
            colors: [
              [0, 255, 0],
              [0, 0, 255]
            ],
            similarity: 0.2,
            blend: 0.05,
            spillSuppression: false,
            erosion: 0
          }
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { chromaKey: { color: [255, 0, 0] } }));

    expect(accessor.current().tracks[0].clips[0].chromaKey).toMatchObject({
      color: [255, 0, 0],
      colors: [
        [255, 0, 0],
        [0, 0, 255]
      ]
    });
    manager.undo();
    expect(accessor.current().tracks[0].clips[0].chromaKey?.colors).toEqual([
      [0, 255, 0],
      [0, 0, 255]
    ]);
  });

  it('clamps advanced audio clip patches', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(
      new UpdateClipCommand(accessor, 'clip-video', {
        pitchSemitones: 99,
        reverseAudio: true,
        fadeInDuration: 99,
        fadeOutDuration: -1,
        fadeInCurve: 'ease-out',
        fadeOutCurve: 'ease-in-out'
      })
    );

    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      pitchSemitones: 12,
      reverseAudio: true,
      fadeInDuration: 3,
      fadeOutDuration: 0,
      fadeInCurve: 'ease-out',
      fadeOutCurve: 'ease-in-out'
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ pitchSemitones: 0, reverseAudio: false, fadeInCurve: 'linear' });
  });

  it('normalizes stabilization, quality enhancement, and PNG sequence frame rate patches with undo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(
      new UpdateClipCommand(accessor, 'clip-video', {
        stabilization: { enabled: true, smoothing: 999, zoom: -1, analyzed: true, trfPath: ' C:\\Temp\\clip.trf ' },
        qualityEnhancement: { superResolution: true, deblock: 1 as never, colorBoost: true, frameCompensation: true },
        frameInterpolation: { enabled: true, targetFps: 144 as never },
        slowMotionMode: 'optical-flow',
        sequenceFrameRate: 240
      })
    );

    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      stabilization: { enabled: true, smoothing: 100, zoom: 0, analyzed: true, trfPath: 'C:\\Temp\\clip.trf' },
      qualityEnhancement: { superResolution: true, deblock: false, colorBoost: true, frameCompensation: true },
      frameInterpolation: { enabled: true, targetFps: 60 },
      slowMotionMode: 'optical-flow',
      sequenceFrameRate: 120
    });

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { slowMotionMode: 'invalid' as never }));
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      slowMotionMode: 'none'
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      slowMotionMode: 'optical-flow'
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      stabilization: { enabled: false, smoothing: 30, zoom: 0, analyzed: false, trfPath: null },
      qualityEnhancement: { superResolution: false, deblock: false, colorBoost: false, frameCompensation: false },
      frameInterpolation: { enabled: false, targetFps: 60 },
      slowMotionMode: 'none',
      sequenceFrameRate: undefined
    });
  });

  it('adds, updates, removes, and restores effects with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new AddEffectCommand(accessor, 'clip-video', { id: 'effect-blur', type: 'blur', params: { radius: 60 } }));
    expect(accessor.current().tracks[0].clips[0].effects).toEqual([{ id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 50 } }]);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects).toBeUndefined();

    manager.redo();
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-blur']);

    manager.execute(new UpdateEffectCommand(accessor, 'clip-video', 'effect-blur', { enabled: false, params: { radius: 4 } }));
    expect(accessor.current().tracks[0].clips[0].effects?.[0]).toEqual({ id: 'effect-blur', type: 'blur', enabled: false, params: { radius: 4 } });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects?.[0].enabled).toBe(true);

    manager.execute(new RemoveEffectCommand(accessor, 'clip-video', 'effect-blur'));
    expect(accessor.current().tracks[0].clips[0].effects).toBeUndefined();

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-blur']);
  });

  it('applies an effect preset through one undoable command', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-preset',
          colorCorrection: { brightness: 0 },
          effects: [{ id: 'effect-old', type: 'blur', enabled: true, params: { radius: 4 } }]
        })
      ])
    );
    const manager = new CommandManager();
    const preset = {
      id: 'preset-film',
      name: 'Preset Film',
      author: 'Ada',
      tags: ['cinematic'],
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
      stack: {
        colorCorrection: { ...DEFAULT_COLOR_CORRECTION, brightness: 0.2, saturation: 0.75 },
        effects: [{ id: 'effect-new', type: 'film-grain' as const, enabled: true, params: { strength: 0.3, size: 2 } }],
        blendMode: 'screen' as const,
        keyframes: { opacity: [{ id: 'kf-opacity', time: 1, value: 0.5, easing: 'ease-in-out' as const }] }
      }
    };

    manager.execute(new ApplyEffectPresetCommand(accessor, 'clip-preset', preset));

    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      colorCorrection: { brightness: 0.2, saturation: 0.75 },
      effects: [{ id: 'effect-new', type: 'film-grain', enabled: true, params: { strength: 0.3, size: 2 } }],
      blendMode: 'screen'
    });
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[0]).toMatchObject({ id: 'kf-opacity', value: 0.5 });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects?.[0]).toMatchObject({ id: 'effect-old', type: 'blur' });
    expect(accessor.current().tracks[0].clips[0].colorCorrection.brightness).toBe(0);
  });

  it('adds, updates, removes, and restores masks with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new AddMaskCommand(accessor, 'clip-video', { id: 'mask-rect', type: 'rect' }));
    expect(accessor.current().tracks[0].clips[0].masks).toEqual([
      expect.objectContaining({ id: 'mask-rect', type: 'rect', x: 0.25, y: 0.25, w: 0.5, h: 0.5, enabled: true })
    ]);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].masks).toEqual([]);

    manager.redo();
    manager.execute(new UpdateMaskCommand(accessor, 'clip-video', 'mask-rect', { type: 'ellipse', x: 0.1, y: 0.2, w: 0.4, h: 0.3, inverted: true, feather: 0.2 }));
    expect(accessor.current().tracks[0].clips[0].masks?.[0]).toEqual(
      expect.objectContaining({ id: 'mask-rect', type: 'ellipse', x: 0.1, y: 0.2, w: 0.4, h: 0.3, inverted: true, feather: 0.2 })
    );

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].masks?.[0]).toEqual(expect.objectContaining({ id: 'mask-rect', type: 'rect', inverted: false }));

    manager.execute(new RemoveMaskCommand(accessor, 'clip-video', 'mask-rect'));
    expect(accessor.current().tracks[0].clips[0].masks).toEqual([]);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].masks?.map((mask) => mask.id)).toEqual(['mask-rect']);
  });

  it('reorders effects and restores the original order on undo', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-video',
          effects: [
            { id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 4 } },
            { id: 'effect-sharpen', type: 'sharpen', enabled: true, params: { strength: 1 } },
            { id: 'effect-grain', type: 'film-grain', enabled: true, params: { strength: 0.3, size: 2 } }
          ]
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new ReorderEffectsCommand(accessor, 'clip-video', ['effect-grain', 'effect-blur', 'effect-sharpen']));
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-grain', 'effect-blur', 'effect-sharpen']);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-blur', 'effect-sharpen', 'effect-grain']);

    expect(() => manager.execute(new ReorderEffectsCommand(accessor, 'clip-video', ['missing-effect']))).toThrow('Effect order');
  });

  it('clears redo stack when executing after undo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.undo();
    expect(manager.canRedo()).toBe(true);
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));
    expect(manager.canRedo()).toBe(false);
    expect(accessor.current().tracks[0].clips[0].start).toBe(3);
  });

  it('creates a history branch when executing after undo without dropping the old branch', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.undo();
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));

    const meta = manager.getHistoryMeta();
    expect(meta.total).toBe(3);
    expect(meta.entries.filter((entry) => entry.parentId === meta.entries[0].id)).toHaveLength(2);
    expect(meta.entries.at(1)?.activePath).toBe(false);
    expect(meta.entries.at(2)?.isCurrent).toBe(true);

    manager.jumpTo(1);
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);
    manager.jumpTo(2);
    expect(accessor.current().tracks[0].clips[0].start).toBe(3);
  });

  it('keeps at most three child branches per history node and removes the oldest branch', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    for (const start of [1, 2, 3, 4]) {
      manager.execute(new MoveClipCommand(accessor, 'clip-1', start));
      manager.undo();
    }

    const meta = manager.getHistoryMeta();
    expect(meta.total).toBe(3);
    expect(meta.entries.map((entry) => entry.siblingCount)).toEqual([3, 3, 3]);
    manager.jumpTo(0);
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);
    manager.jumpTo(2);
    expect(accessor.current().tracks[0].clips[0].start).toBe(4);
  });

  it('switches to the previous branch without mixing undo state across branches', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.undo();
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));

    manager.switchToPreviousBranch();
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);
    manager.undo();
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
    manager.redo();
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);
  });

  it('jumps by history entry id and leaves missing or current entries unchanged', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    const [firstEntry, secondEntry] = manager.getHistoryMeta().entries;

    manager.jumpToEntry(firstEntry.id);
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
    expect(manager.getHistoryMeta()).toMatchObject({ cursor: 0, position: 1, total: 2 });

    manager.jumpToEntry(firstEntry.id);
    manager.jumpToEntry('history-missing');
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
    expect(manager.getHistoryMeta()).toMatchObject({ cursor: 0, position: 1, total: 2 });

    manager.jumpToEntry(secondEntry.id);
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);
  });

  it('keeps previous branch switching as a no-op when no alternate branch exists', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.switchToPreviousBranch();

    expect(accessor.current().tracks[0].clips[0].start).toBe(2);
    expect(manager.getHistoryMeta()).toMatchObject({ cursor: 1, position: 2, total: 2 });
  });

  it('switches from a fork parent to the previous child branch', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.undo();
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));
    manager.undo();

    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
    expect(manager.canRedo()).toBe(true);

    manager.switchToPreviousBranch();
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);
    expect(manager.getHistoryMeta().entries.find((entry) => entry.isCurrent)?.branchIndex).toBe(0);
  });

  it('removes an entire oldest branch subtree when the child branch cap is exceeded', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1.5));
    const removedChildId = manager.getHistoryMeta().entries.at(-1)!.id;
    manager.undo();
    manager.undo();

    for (const start of [2, 3, 4]) {
      manager.execute(new MoveClipCommand(accessor, 'clip-1', start));
      manager.undo();
    }

    expect(manager.getHistoryMeta().entries.map((entry) => entry.branchIndex)).toEqual([0, 1, 2]);
    manager.jumpToEntry(removedChildId);
    expect(accessor.current().tracks[0].clips[0].start).toBe(0);
  });

  it('prunes the current node when the configured history limit is zero', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager(0);

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));

    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
    expect(manager.getHistoryMeta()).toMatchObject({ canUndo: false, canRedo: false, cursor: -1, position: 0, total: 0, entries: [] });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
  });

  it('caps command history at 100 entries', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    for (let index = 1; index <= 105; index += 1) {
      manager.execute(new MoveClipCommand(accessor, 'clip-1', index));
    }

    expect(manager.historySize()).toBe(100);
    for (let index = 0; index < 100; index += 1) {
      manager.undo();
    }
    expect(accessor.current().tracks[0].clips[0].start).toBe(5);
    expect(manager.canUndo()).toBe(false);
  });

  it('rejects overlapping command results', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 5 }), makeVideoClip({ id: 'b', start: 6, duration: 3 })])
    );
    const manager = new CommandManager();

    expect(() => manager.execute(new MoveClipCommand(accessor, 'b', 4))).toThrow('overlaps');
  });

  it('deletes multiple clips as one undoable command', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'b', start: 3, duration: 2 }),
        makeTextClip({ id: 'c', start: 0, duration: 2 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new DeleteClipsCommand(accessor, ['a', 'c']));
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['b']);
    expect(accessor.current().tracks[2].clips).toHaveLength(0);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['a', 'b']);
    expect(accessor.current().tracks[2].clips.map((clip) => clip.id)).toEqual(['c']);

    manager.redo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['b']);
    expect(accessor.current().tracks[2].clips).toHaveLength(0);
  });

  it('ripple deletes clips on their own tracks and preserves undo', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'b', start: 3, duration: 2 }),
        makeVideoClip({ id: 'c', start: 7, duration: 1 }),
        makeTextClip({ id: 'title', start: 7, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new RippleDeleteCommand(accessor, ['b']));
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['c', 5]
    ]);
    expect(accessor.current().tracks[2].clips.map((clip) => [clip.id, clip.start])).toEqual([['title', 7]]);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['b', 3],
      ['c', 7]
    ]);

    manager.redo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['a', 'c']);
  });

  it('ripple deletes multiple selected intervals and rejects empty selections', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 1 }),
        makeVideoClip({ id: 'b', start: 1, duration: 1 }),
        makeVideoClip({ id: 'c', start: 3, duration: 1 }),
        makeVideoClip({ id: 'd', start: 5, duration: 1 })
      ])
    );

    new RippleDeleteCommand(accessor, ['a', 'b', 'd']).execute();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([['c', 1]]);

    expect(() => new RippleDeleteCommand(accessor, []).execute()).toThrow('No clips selected');
  });

  it('closes a clicked track gap with undo and rejects non-gaps', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'b', start: 4, duration: 2 }),
        makeVideoClip({ id: 'c', start: 7, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new CloseGapCommand(accessor, 'track-video', 3));
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['b', 2],
      ['c', 5]
    ]);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['b', 4],
      ['c', 7]
    ]);

    expect(() => manager.execute(new CloseGapCommand(accessor, 'track-video', 1))).toThrow('No closeable gap');
    expect(() => manager.execute(new CloseGapCommand(accessor, 'track-video', 9))).toThrow('No closeable gap');
  });

  it('rolling trims adjacent clips while preserving their combined duration', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 3, trimStart: 0, trimEnd: 2 }),
        makeVideoClip({ id: 'right', start: 3, duration: 3, trimStart: 1, trimEnd: 0 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new RollingTrimCommand(accessor, 'left', 'right', 1, 1 / 30));
    const [left, right] = accessor.current().tracks[0].clips;
    expect(left.duration + right.duration).toBeCloseTo(6, 6);
    expect(left).toMatchObject({ id: 'left', start: 0, duration: 4, trimEnd: 1 });
    expect(right).toMatchObject({ id: 'right', start: 4, duration: 2, trimStart: 2 });

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start, clip.duration, clip.trimStart, clip.trimEnd])).toEqual([
      ['left', 0, 3, 0, 2],
      ['right', 3, 3, 1, 0]
    ]);
  });

  it('rejects rolling trims without adjacent clips or available media', () => {
    const nonAdjacent = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2 }),
        makeVideoClip({ id: 'right', start: 3, duration: 2 })
      ])
    );
    expect(() => new RollingTrimCommand(nonAdjacent, 'left', 'right', 0.5).execute()).toThrow('adjacent');

    const bounded = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2, trimStart: 0, trimEnd: 0 }),
        makeVideoClip({ id: 'right', start: 2, duration: 2, trimStart: 0, trimEnd: 0 })
      ])
    );
    expect(() => new RollingTrimCommand(bounded, 'left', 'right', 0.5).execute()).toThrow('no available media');
  });

  it('slips clip source trims without changing timeline position or duration', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-slip', start: 4, duration: 2, trimStart: 1, trimEnd: 3 })]));
    const manager = new CommandManager();

    manager.execute(new SlipClipCommand(accessor, 'clip-slip', 10));
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ start: 4, duration: 2, trimStart: 4, trimEnd: 0 });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ start: 4, duration: 2, trimStart: 1, trimEnd: 3 });

    manager.execute(new SlipClipCommand(accessor, 'clip-slip', -10));
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ start: 4, duration: 2, trimStart: 0, trimEnd: 4 });
  });

  it('slides a clip by compensating adjacent trims and preserving total duration', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2, trimStart: 0, trimEnd: 2 }),
        makeVideoClip({ id: 'middle', start: 2, duration: 2, trimStart: 0, trimEnd: 0 }),
        makeVideoClip({ id: 'right', start: 4, duration: 2, trimStart: 0, trimEnd: 2 })
      ])
    );
    const manager = new CommandManager();
    const beforeTotal = accessor.current().tracks[0].clips.reduce((total, clip) => total + clip.duration, 0);

    manager.execute(new SlideClipCommand(accessor, 'middle', 1, 1 / 30));
    const [left, middle, right] = accessor.current().tracks[0].clips;
    expect(accessor.current().tracks[0].clips.reduce((total, clip) => total + clip.duration, 0)).toBeCloseTo(beforeTotal, 6);
    expect(left).toMatchObject({ id: 'left', start: 0, duration: 3, trimEnd: 1 });
    expect(middle).toMatchObject({ id: 'middle', start: 3, duration: 2, trimStart: 0, trimEnd: 0 });
    expect(right).toMatchObject({ id: 'right', start: 5, duration: 1, trimStart: 1 });

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start, clip.duration, clip.trimStart, clip.trimEnd])).toEqual([
      ['left', 0, 2, 0, 2],
      ['middle', 2, 2, 0, 0],
      ['right', 4, 2, 0, 2]
    ]);
  });

  it('clamps slide edits to adjacent media handles and minimum durations', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2, trimStart: 0, trimEnd: 1 }),
        makeVideoClip({ id: 'middle', start: 2, duration: 2 }),
        makeVideoClip({ id: 'right', start: 4, duration: 2, trimStart: 0, trimEnd: 0 })
      ])
    );

    new SlideClipCommand(accessor, 'middle', 10, 1 / 30).execute();
    const [left, middle, right] = accessor.current().tracks[0].clips;
    expect(left.duration).toBeCloseTo(3, 6);
    expect(middle.start).toBeCloseTo(3, 6);
    expect(right.start).toBeCloseTo(5, 6);
    expect(right.duration).toBeCloseTo(1, 6);
  });

  it('moves multiple selected clips while preserving their relative spacing', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 1, duration: 1 }),
        makeVideoClip({ id: 'b', start: 3, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new MoveClipsCommand(accessor, { a: 2, b: 4 }));
    expect(accessor.current().tracks[0].clips.map((clip) => clip.start)).toEqual([2, 4]);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.start)).toEqual([1, 3]);
  });

  it('clamps trim commands to source duration and one frame minimum', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 6, trimStart: 1, trimEnd: 1 })]));
    const manager = new CommandManager();

    manager.execute(new TrimClipCommand(accessor, 'clip-1', 100, 1, undefined, 1 / 30));
    const trimmed = accessor.current().tracks[0].clips[0];
    expect(trimmed.trimStart).toBeCloseTo(6.967, 3);
    expect(trimmed.trimEnd).toBe(1);
    expect(trimmed.duration).toBeCloseTo(0.033, 3);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ trimStart: 1, trimEnd: 1, duration: 6 });
  });

  it('keeps undo and redo as no-ops at history boundaries', () => {
    const manager = new CommandManager();
    const changes: ReturnType<CommandManager['getHistoryMeta']>[] = [];
    manager.setOnChange((meta) => changes.push(meta));

    manager.undo();
    manager.redo();

    expect(manager.getHistoryMeta()).toMatchObject({ canUndo: false, canRedo: false, cursor: -1, position: 0, total: 0, entries: [] });
    expect(changes).toEqual([{ canUndo: false, canRedo: false, cursor: -1, entries: [], position: 0, total: 0 }]);
  });

  it('does not record a command when execute throws', () => {
    let undoCount = 0;
    const manager = new CommandManager();
    const failing: Command = {
      description: 'Fail',
      execute: () => {
        throw new Error('boom');
      },
      undo: () => {
        undoCount += 1;
      }
    };

    expect(() => manager.execute(failing)).toThrow('boom');
    expect(manager.historySize()).toBe(0);
    expect(manager.canUndo()).toBe(false);

    manager.undo();
    expect(undoCount).toBe(0);
  });

  it('notifies execute listeners only after a command succeeds', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();
    const executed: Command[] = [];
    manager.setOnExecute((command) => executed.push(command));
    const command = new UpdateClipCommand(accessor, 'clip-1', { transform: { scale: 1.25 } });

    manager.execute(command);
    expect(executed).toEqual([command]);

    const failing: Command = {
      description: 'Fail',
      execute: () => {
        throw new Error('boom');
      },
      undo: () => undefined
    };
    expect(() => manager.execute(failing)).toThrow('boom');
    expect(executed).toEqual([command]);
  });

  it('counts affected clips from track-like command payloads', () => {
    const manager = new CommandManager();
    const command: Command & { track: { clips: Array<{ id: string }> } } = {
      description: 'Track payload',
      track: { clips: [{ id: 'clip-a' }, { id: 'clip-b' }] },
      execute: () => undefined,
      undo: () => undefined
    };

    manager.execute(command);

    expect(manager.getHistoryMeta().entries[0]).toMatchObject({ affectedClipCount: 2 });
  });

  it('clears history and prevents redo of previously undone commands', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.undo();
    expect(manager.canRedo()).toBe(true);

    manager.clear();
    expect(manager.getHistoryMeta()).toMatchObject({ canUndo: false, canRedo: false, cursor: -1, position: 0, total: 0, entries: [] });
    manager.redo();
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
  });

  it('jumps to a selected history entry with undo and redo operations', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));

    manager.jumpTo(0);
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
    expect(manager.getHistoryMeta()).toMatchObject({ cursor: 0, position: 1, total: 3 });

    manager.jumpTo(2);
    expect(accessor.current().tracks[0].clips[0].start).toBe(3);
    expect(manager.getHistoryMeta()).toMatchObject({ cursor: 2, position: 3, total: 3 });
  });

  it('evicts the oldest history entries at the configured limit', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager(2);

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));

    const meta = manager.getHistoryMeta();
    expect(meta.total).toBe(2);
    expect(meta.entries.map((entry) => entry.description)).toEqual(['Move clip', 'Move clip']);
    manager.jumpTo(-1);
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
  });

  it('treats direct undo before execute as a no-op for stateful timeline commands', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 6 })]));
    const before = accessor.current();

    new MoveClipCommand(accessor, 'clip-1', 2).undo();
    new TrimClipCommand(accessor, 'clip-1', 1, 1).undo();
    new SplitClipCommand(accessor, 'clip-1', 3).undo();
    new DeleteClipCommand(accessor, 'clip-1').undo();
    new UpdateClipCommand(accessor, 'clip-1', { name: 'No-op' }).undo();

    expect(accessor.current()).toBe(before);
  });
});
  describe('NewProjectCommand', () => {
    it('replaces the entire project with undo and redo', () => {
      let project = makeProject();
      const accessor = {
        getProject: () => project,
        setProject: (next: typeof project) => { project = next; }
      };
      const manager = new CommandManager();
      const freshProject = { ...makeProject(), id: 'fresh', name: 'Fresh Project' };

      manager.execute(new NewProjectCommand(accessor, freshProject));
      expect(project.id).toBe('fresh');
      expect(project.name).toBe('Fresh Project');

      manager.undo();
      expect(project.id).not.toBe('fresh');

      manager.redo();
      expect(project.id).toBe('fresh');
    });
  });

  describe('UpdateSequenceSettingsCommand', () => {
    it('updates sequence settings with undo and redo', () => {
      let project = makeProject();
      const accessor = {
        getProject: () => project,
        setProject: (next: typeof project) => { project = next; }
      };
      const manager = new CommandManager();

      manager.execute(new UpdateSequenceSettingsCommand(accessor, PRIMARY_SEQUENCE_ID, { frameRate: 24 }));
      const seq = project.sequences.find((s) => s.id === PRIMARY_SEQUENCE_ID);
      expect(seq?.settings?.frameRate).toBe(24);

      manager.undo();
      const restored = project.sequences.find((s) => s.id === PRIMARY_SEQUENCE_ID);
      expect(restored?.settings?.frameRate).toBeUndefined();

      manager.redo();
      const redone = project.sequences.find((s) => s.id === PRIMARY_SEQUENCE_ID);
      expect(redone?.settings?.frameRate).toBe(24);
    });

    it('does nothing when the sequence is not found', () => {
      let project = makeProject();
      const before = { ...project };
      const accessor = {
        getProject: () => project,
        setProject: (next: typeof project) => { project = next; }
      };
      const manager = new CommandManager();

      manager.execute(new UpdateSequenceSettingsCommand(accessor, 'nonexistent', { frameRate: 24 }));
      expect(project.sequences).toEqual(before.sequences);
    });

    it('applies undefined settings to clear overrides', () => {
      let project = makeProject();
      const accessor = {
        getProject: () => project,
        setProject: (next: typeof project) => { project = next; }
      };
      const manager = new CommandManager();

      manager.execute(new UpdateSequenceSettingsCommand(accessor, PRIMARY_SEQUENCE_ID, { frameRate: 60 }));
      expect(project.sequences.find((s) => s.id === PRIMARY_SEQUENCE_ID)?.settings?.frameRate).toBe(60);

      manager.execute(new UpdateSequenceSettingsCommand(accessor, PRIMARY_SEQUENCE_ID, undefined));
      expect(project.sequences.find((s) => s.id === PRIMARY_SEQUENCE_ID)?.settings).toBeUndefined();
    });

    it('recalculates clip positions when frame rate changes', () => {
      const clip = makeVideoClip({ id: 'clip-fps', start: 0, duration: 30 });
      const timeline = makeTimeline([clip]);
      let project = {
        ...makeProject(),
        timeline,
        sequences: [{ id: PRIMARY_SEQUENCE_ID, name: 'Main', timeline }],
        activeSequenceId: PRIMARY_SEQUENCE_ID
      };
      const accessor = {
        getProject: () => project,
        setProject: (next: typeof project) => { project = next; }
      };
      const manager = new CommandManager();

      manager.execute(new UpdateSequenceSettingsCommand(accessor, PRIMARY_SEQUENCE_ID, { frameRate: 60 }));
      const updatedSeq = project.sequences.find((s) => s.id === PRIMARY_SEQUENCE_ID);
      expect(updatedSeq?.settings?.frameRate).toBe(60);
    });
  });

  describe('BatchUpdateTrackHeightCommand', () => {
    it('sets all track heights with undo and redo', () => {
      let project = makeProject();
      const accessor = {
        getProject: () => project,
        setProject: (next: typeof project) => { project = next; }
      };
      const manager = new CommandManager();

      manager.execute(new BatchUpdateTrackHeightCommand(accessor, 80));
      for (const track of project.timeline.tracks) {
        expect(track.displayHeight).toBe(80);
      }

      manager.undo();
      for (const track of project.timeline.tracks) {
        expect(track.displayHeight).toBeUndefined();
      }

      manager.redo();
      for (const track of project.timeline.tracks) {
        expect(track.displayHeight).toBe(80);
      }
    });

    it('clamps track height to valid range', () => {
      let project = makeProject();
      const accessor = {
        getProject: () => project,
        setProject: (next: typeof project) => { project = next; }
      };
      const manager = new CommandManager();

      manager.execute(new BatchUpdateTrackHeightCommand(accessor, -10));
      for (const track of project.timeline.tracks) {
        expect(track.displayHeight).toBe(24);
      }

      manager.execute(new BatchUpdateTrackHeightCommand(accessor, 500));
      for (const track of project.timeline.tracks) {
        expect(track.displayHeight).toBe(200);
      }
    });
  });

  describe('BatchUpdateSubtitleTextCommand', () => {
    it('updates subtitle text and supports undo/redo', () => {
      const timeline = makeTimeline();
      timeline.tracks.push(
        createTrack({
          id: 'track-subtitle',
          type: 'subtitle',
          name: 'Subtitles',
          clips: [
            makeSubtitleClip({ id: 'sub-a', start: 0, duration: 2, text: 'original a' }),
            makeSubtitleClip({ id: 'sub-b', start: 3, duration: 2, text: 'original b' })
          ]
        })
      );
      const accessor = makeAccessor(timeline);
      const manager = new CommandManager();

      manager.execute(
        new BatchUpdateSubtitleTextCommand(accessor, [
          { clipId: 'sub-a', text: 'polished a' },
          { clipId: 'sub-b', text: 'polished b' }
        ])
      );
      const clips = accessor.current().tracks.find((t) => t.id === 'track-subtitle')!.clips;
      expect(clips.find((c) => c.id === 'sub-a')!.text).toBe('polished a');
      expect(clips.find((c) => c.id === 'sub-b')!.text).toBe('polished b');

      manager.undo();
      const undone = accessor.current().tracks.find((t) => t.id === 'track-subtitle')!.clips;
      expect(undone.find((c) => c.id === 'sub-a')!.text).toBe('original a');
      expect(undone.find((c) => c.id === 'sub-b')!.text).toBe('original b');

      manager.redo();
      const redone = accessor.current().tracks.find((t) => t.id === 'track-subtitle')!.clips;
      expect(redone.find((c) => c.id === 'sub-a')!.text).toBe('polished a');
      expect(redone.find((c) => c.id === 'sub-b')!.text).toBe('polished b');
    });

    it('throws on empty updates', () => {
      const accessor = makeAccessor(makeTimeline());
      const manager = new CommandManager();
      expect(() => manager.execute(new BatchUpdateSubtitleTextCommand(accessor, []))).toThrow('No subtitle text updates');
    });

    it('throws when no subtitle clips match the updates', () => {
      const accessor = makeAccessor(makeTimeline());
      const manager = new CommandManager();
      expect(() => manager.execute(new BatchUpdateSubtitleTextCommand(accessor, [{ clipId: 'nonexistent', text: 'x' }]))).toThrow('No subtitle clips found for text updates');
    });

    it('skips non-subtitle clips', () => {
      const timeline = makeTimeline([makeVideoClip({ id: 'vid-1', start: 0, duration: 5 })]);
      const accessor = makeAccessor(timeline);
      const manager = new CommandManager();
      expect(() => manager.execute(new BatchUpdateSubtitleTextCommand(accessor, [{ clipId: 'vid-1', text: 'x' }]))).toThrow('No subtitle clips found for text updates');
    });

    it('skips updates where text is unchanged', () => {
      const timeline = makeTimeline();
      timeline.tracks.push(
        createTrack({
          id: 'track-subtitle',
          type: 'subtitle',
          name: 'Subtitles',
          clips: [makeSubtitleClip({ id: 'sub-a', start: 0, duration: 2, text: 'same' })]
        })
      );
      const accessor = makeAccessor(timeline);
      const manager = new CommandManager();
      expect(() => manager.execute(new BatchUpdateSubtitleTextCommand(accessor, [{ clipId: 'sub-a', text: 'same' }]))).toThrow('No subtitle clips found for text updates');
    });
  });

  describe('BatchAddClipsCommand', () => {
    it('adds clips and new tracks, then undoes cleanly', () => {
      const timeline = makeTimeline();
      const accessor = makeAccessor(timeline);
      const manager = new CommandManager();

      const clips = [
        makeVideoClip({ id: 'batch-clip-1', mediaId: 'media-1', start: 0, duration: 3, trackId: 'new-track-1' }),
        makeVideoClip({ id: 'batch-clip-2', mediaId: 'media-2', start: 3, duration: 4, trackId: 'new-track-1' })
      ];
      const newTracks = [{ id: 'new-track-1', name: 'AI 1', type: 'video' as const }];

      const command = new BatchAddClipsCommand(accessor, clips, newTracks);
      manager.execute(command);
      expect(command.description).toBe('Batch add clips (AI rough cut)');

      const afterExecute = accessor.current();
      expect(afterExecute.tracks.some((t) => t.id === 'new-track-1')).toBe(true);
      const addedTrack = afterExecute.tracks.find((t) => t.id === 'new-track-1')!;
      expect(addedTrack.clips.length).toBe(2);
      expect(addedTrack.clips.map((c) => c.id)).toEqual(['batch-clip-1', 'batch-clip-2']);

      manager.undo();
      const afterUndo = accessor.current();
      expect(afterUndo.tracks.some((t) => t.id === 'new-track-1')).toBe(false);

      manager.redo();
      const afterRedo = accessor.current();
      expect(afterRedo.tracks.find((t) => t.id === 'new-track-1')!.clips.length).toBe(2);
    });

    it('does not duplicate existing tracks', () => {
      const timeline = makeTimeline();
      timeline.tracks.push(createTrack({ id: 'existing-track', type: 'video', name: 'Existing', clips: [] }));
      const accessor = makeAccessor(timeline);
      const manager = new CommandManager();

      const clips = [
        makeVideoClip({ id: 'dup-clip-1', mediaId: 'media-1', start: 0, duration: 2, trackId: 'existing-track' })
      ];
      const newTracks = [{ id: 'existing-track', name: 'Dup', type: 'video' as const }];

      manager.execute(new BatchAddClipsCommand(accessor, clips, newTracks));
      const result = accessor.current();
      const existingTracks = result.tracks.filter((t) => t.id === 'existing-track');
      expect(existingTracks).toHaveLength(1);
      expect(existingTracks[0].clips.length).toBe(1);
    });
  });

describe('AI feature commands', () => {
  function makeMulticamProject() {
    const clip = {
      id: 'multicam-clip',
      type: 'nested-sequence' as const,
      name: 'Multicam',
      mediaId: 'asset-1',
      trackId: 'track-video',
      start: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      volume: 1,
      multicam: {
        angles: [
          { id: 'angle-1', clipId: 'multicam-clip', trackId: 'track-a', name: 'Camera 1', offset: 0 },
          { id: 'angle-2', clipId: 'multicam-clip', trackId: 'track-b', name: 'Camera 2', offset: 0 }
        ],
        switches: [{ id: 'sw-1', time: 0, angleId: 'angle-1' }]
      }
    };
    let proj = makeProject();
    proj = {
      ...proj,
      timeline: {
        transitions: [],
        markers: [],
        tracks: [
          { id: 'track-video', type: 'video' as const, name: 'Video 1', clips: [clip as any], volume: 1, pan: 0, muted: false, solo: false, locked: false, color: null },
          { id: 'track-audio', type: 'audio' as const, name: 'Audio 1', clips: [], volume: 1, pan: 0, muted: false, solo: false, locked: false, color: null },
          { id: 'track-text', type: 'text' as const, name: 'Text 1', clips: [], volume: 1, pan: 0, muted: false, solo: false, locked: false, color: null }
        ]
      }
    };
    return proj;
  }

  it('ApplyMulticamAiCutSuggestionsCommand applies suggestions and undoes', () => {
    let project = makeMulticamProject();
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    const manager = new CommandManager();
    const suggestions = [
      { time: 2, angleId: 'angle-2', confidence: 0.9, reason: 'higher audio' },
      { time: 5, angleId: 'angle-1', confidence: 0.8, reason: 'motion' }
    ];
    const cmd = new ApplyMulticamAiCutSuggestionsCommand(accessor, 'multicam-clip', suggestions);
    manager.execute(cmd);
    const updated = project.timeline.tracks[0].clips[0] as any;
    expect(updated.multicam?.aiCutSuggestions).toHaveLength(2);
    // 1 original switch at t=0 + 2 suggestions = 3 total
    expect(updated.multicam?.switches.length).toBe(3);
    manager.undo();
    const original = project.timeline.tracks[0].clips[0] as any;
    expect(original.multicam?.aiCutSuggestions).toBeUndefined();
  });

  it('ApplyMulticamAiCutSuggestionsCommand applies 3 suggestions correctly', () => {
    let project = makeMulticamProject();
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    const manager = new CommandManager();
    const suggestions = [
      { time: 2, angleId: 'angle-2', confidence: 0.9, reason: 'speaker' },
      { time: 5, angleId: 'angle-1', confidence: 0.8, reason: 'motion' },
      { time: 8, angleId: 'angle-2', confidence: 0.7, reason: 'energy' }
    ];
    const cmd = new ApplyMulticamAiCutSuggestionsCommand(accessor, 'multicam-clip', suggestions);
    manager.execute(cmd);
    const updated = project.timeline.tracks[0].clips[0] as any;
    // 1 original + 3 suggestions = 4 total
    expect(updated.multicam?.switches.length).toBe(4);
    expect(updated.multicam?.aiCutSuggestions).toHaveLength(3);
    // Verify each suggestion time is present in switches
    const switchTimes = updated.multicam.switches.map((s: any) => s.time);
    expect(switchTimes).toContain(2);
    expect(switchTimes).toContain(5);
    expect(switchTimes).toContain(8);
    manager.undo();
    const original = project.timeline.tracks[0].clips[0] as any;
    expect(original.multicam?.switches.length).toBe(1);
  });

  it('ApplyMulticamAiCutSuggestionsCommand throws on non-multicam clip', () => {
    let project = makeProject();
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    expect(() => new ApplyMulticamAiCutSuggestionsCommand(accessor, 'clip-1', []).execute()).toThrow('not a multicam');
  });

  it('ApplyMulticamAiCutSuggestionsCommand deduplicates execute', () => {
    let project = makeMulticamProject();
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    const manager = new CommandManager();
    const cmd = new ApplyMulticamAiCutSuggestionsCommand(accessor, 'multicam-clip', [{ time: 3, angleId: 'angle-2', confidence: 0.7, reason: 'test' }]);
    manager.execute(cmd);
    const first = project.timeline.tracks[0].clips[0];
    manager.execute(cmd);
    expect(project.timeline.tracks[0].clips[0]).toEqual(first);
  });

  it('ApplyShakeStabilizationCommand applies and undoes', () => {
    let project = makeProject();
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    const manager = new CommandManager();
    const cmd = new ApplyShakeStabilizationCommand(accessor, 'clip-1', { shakeScore: 75, severity: 'high', suggestedFilter: 'vidstab', sampledAt: Date.now() });
    manager.execute(cmd);
    expect(project.timeline.tracks[0].clips[0].stabilization?.shakeScore).toBe(75);
    expect(project.timeline.tracks[0].clips[0].stabilization?.severity).toBe('high');
    expect(project.timeline.tracks[0].clips[0].stabilization?.enabled).toBe(true);
    expect(project.timeline.tracks[0].clips[0].stabilization?.analyzed).toBe(true);
    manager.undo();
    expect(project.timeline.tracks[0].clips[0].stabilization?.shakeScore).toBeUndefined();
  });

  it('ApplyPipPlacementCommand updates transform for all corners', () => {
    const expected = [
      { corner: 'top-left' as const, x: -0.5, y: 0.5 },
      { corner: 'top-right' as const, x: 0.5, y: 0.5 },
      { corner: 'bottom-left' as const, x: -0.5, y: -0.5 },
      { corner: 'bottom-right' as const, x: 0.5, y: -0.5 }
    ];
    for (const { corner, x, y } of expected) {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const manager = new CommandManager();
      const cmd = new ApplyPipPlacementCommand(accessor, 'clip-1', corner);
      manager.execute(cmd);
      expect(project.timeline.tracks[0].clips[0].transform.x).toBe(x);
      expect(project.timeline.tracks[0].clips[0].transform.y).toBe(y);
      manager.undo();
      expect(project.timeline.tracks[0].clips[0].transform.x).toBe(0);
      expect(project.timeline.tracks[0].clips[0].transform.y).toBe(0);
    }
  });

  it('ApplyPlatformFitCommand marks removed clips and undoes', () => {
    const clipA = makeVideoClip({ id: 'clip-a', start: 0, duration: 30 });
    const clipB = makeVideoClip({ id: 'clip-b', start: 30, duration: 20 });
    let project = { ...makeProject(), timeline: makeTimeline([clipA, clipB]) };
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    const manager = new CommandManager();
    const suggestion = { targetPlatform: 'tiktok' as const, limitSeconds: 60, keptSegments: [{ clipId: 'clip-a', start: 0, end: 30, score: 0.8 }], removedSegments: [{ clipId: 'clip-b', start: 30, end: 50, score: 0.3 }] };
    const cmd = new ApplyPlatformFitCommand(accessor, suggestion);
    manager.execute(cmd);
    expect(project.platformFitSuggestion?.targetPlatform).toBe('tiktok');
    expect((project.timeline.tracks[0].clips.find(c => c.id === 'clip-b') as any)?.platformFitRemoved).toBe(true);
    expect((project.timeline.tracks[0].clips.find(c => c.id === 'clip-a') as any)?.platformFitRemoved).toBeUndefined();
    manager.undo();
    expect(project.platformFitSuggestion).toBeUndefined();
    expect((project.timeline.tracks[0].clips.find(c => c.id === 'clip-b') as any)?.platformFitRemoved).toBeUndefined();
  });

  it('ApplyPlatformFitCommand clears platformFitRemoved from non-removed clips', () => {
    const clipA = { ...makeVideoClip({ id: 'clip-a', start: 0, duration: 30 }), platformFitRemoved: true } as any;
    let project = { ...makeProject(), timeline: makeTimeline([clipA, makeVideoClip({ id: 'clip-b', start: 30, duration: 20 })]) };
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    const suggestion = { targetPlatform: 'reels' as const, limitSeconds: 90, keptSegments: [{ clipId: 'clip-a', start: 0, end: 30, score: 0.8 }, { clipId: 'clip-b', start: 30, end: 50, score: 0.5 }], removedSegments: [] };
    new ApplyPlatformFitCommand(accessor, suggestion).execute();
    expect((project.timeline.tracks[0].clips.find(c => c.id === 'clip-a') as any)?.platformFitRemoved).toBeUndefined();
  });

  it('RestorePlatformFitClipCommand restores removed clip and undoes', () => {
    let project = { ...makeProject(), timeline: makeTimeline([makeVideoClip({ id: 'clip-a' }), makeVideoClip({ id: 'clip-b', start: 30, duration: 20 })]), platformFitSuggestion: { targetPlatform: 'shorts' as const, limitSeconds: 60, keptSegments: [{ clipId: 'clip-a', start: 0, end: 10, score: 0.8 }], removedSegments: [{ clipId: 'clip-b', start: 30, end: 50, score: 0.3 }] } };
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    const manager = new CommandManager();
    const cmd = new RestorePlatformFitClipCommand(accessor, 'clip-b');
    manager.execute(cmd);
    expect(project.platformFitSuggestion?.removedSegments).toHaveLength(0);
    expect(project.platformFitSuggestion?.keptSegments).toHaveLength(2);
    manager.undo();
    expect(project.platformFitSuggestion?.removedSegments).toHaveLength(1);
    expect(project.platformFitSuggestion?.keptSegments).toHaveLength(1);
  });

  it('RestorePlatformFitClipCommand handles missing clip gracefully', () => {
    let project = { ...makeProject(), timeline: makeTimeline([makeVideoClip()]), platformFitSuggestion: { targetPlatform: 'custom' as const, limitSeconds: 30, keptSegments: [], removedSegments: [] } };
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    new RestorePlatformFitClipCommand(accessor, 'nonexistent').execute();
    expect(project.platformFitSuggestion?.removedSegments).toHaveLength(0);
  });

  it('RestorePlatformFitClipCommand works without platformFitSuggestion', () => {
    const clipA = { ...makeVideoClip({ id: 'clip-a' }), platformFitRemoved: true } as any;
    let project = { ...makeProject(), timeline: makeTimeline([clipA]) };
    const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
    new RestorePlatformFitClipCommand(accessor, 'clip-a').execute();
    expect((project.timeline.tracks[0].clips.find(c => c.id === 'clip-a') as any)?.platformFitRemoved).toBeUndefined();
  });
});

describe('P1-3 coverage: timeline commands edge cases', () => {
  describe('PasteKeyframesCommand', () => {
    it('pastes keyframes in relative mode', () => {
      const kf = { id: 'kf-src', time: 0.5, value: 0.8, easing: 'linear' as const };
      const clip = makeVideoClip({ id: 'clip-1', start: 0, duration: 10 });
      const accessor = makeAccessor(makeTimeline([clip]));
      const input = {
        groups: [{ sourceClipId: 'src-clip', sourceClipStart: 0, property: 'opacity' as const, keyframes: [kf] }],
        targetClipId: 'clip-1',
        mode: 'relative' as const
      };
      const manager = new CommandManager();
      manager.execute(new PasteKeyframesCommand(accessor, input));
      const updated = accessor.current().tracks[0].clips[0];
      expect(updated.keyframes?.opacity).toBeDefined();
      expect(updated.keyframes!.opacity!.length).toBeGreaterThanOrEqual(1);
    });

    it('pastes keyframes in absolute mode', () => {
      const kf = { id: 'kf-abs', time: 2, value: 0.5, easing: 'linear' as const };
      const clip = makeVideoClip({ id: 'clip-1', start: 0, duration: 10 });
      const accessor = makeAccessor(makeTimeline([clip]));
      const input = {
        groups: [{ sourceClipId: 'src-clip', sourceClipStart: 0, property: 'volume' as const, keyframes: [kf] }],
        targetClipId: 'clip-1',
        mode: 'absolute' as const
      };
      new PasteKeyframesCommand(accessor, input).execute();
      const updated = accessor.current().tracks[0].clips[0];
      expect(updated.keyframes?.volume).toBeDefined();
    });

    it('undo restores original keyframes', () => {
      const existingKf = { id: 'kf-orig', time: 1, value: 0.9, easing: 'linear' as const };
      const pasteKf = { id: 'kf-paste', time: 0.5, value: 0.3, easing: 'linear' as const };
      const clip = makeVideoClip({ id: 'clip-1', start: 0, duration: 10, keyframes: { opacity: [existingKf] } });
      const accessor = makeAccessor(makeTimeline([clip]));
      const input = {
        groups: [{ sourceClipId: 'src', sourceClipStart: 0, property: 'opacity' as const, keyframes: [pasteKf] }],
        targetClipId: 'clip-1',
        mode: 'relative' as const
      };
      const manager = new CommandManager();
      manager.execute(new PasteKeyframesCommand(accessor, input));
      manager.undo();
      const restored = accessor.current().tracks[0].clips[0];
      expect(restored.keyframes?.opacity).toHaveLength(1);
      expect(restored.keyframes!.opacity![0].id).toBe('kf-orig');
    });

    it('pastes with targetProperty cross-mapping', () => {
      const kf = { id: 'kf-cross', time: 0.5, value: 50, easing: 'linear' as const };
      const clip = makeVideoClip({ id: 'clip-1', start: 0, duration: 10 });
      const accessor = makeAccessor(makeTimeline([clip]));
      const input = {
        groups: [{ sourceClipId: 'src', sourceClipStart: 0, property: 'opacity' as const, keyframes: [kf] }],
        targetClipId: 'clip-1',
        mode: 'relative' as const,
        targetProperty: 'volume' as const
      };
      new PasteKeyframesCommand(accessor, input).execute();
      const updated = accessor.current().tracks[0].clips[0];
      expect(updated.keyframes?.volume).toBeDefined();
    });
  });

  describe('BatchImportSubtitleCommand', () => {
    it('throws when track is not subtitle type', () => {
      const timeline = makeTimeline();
      const accessor = makeAccessor(timeline);
      const badTrack = { id: 'bad', type: 'video' as const, name: 'Bad', clips: [] };
      expect(() => new BatchImportSubtitleCommand(accessor, badTrack as any, { mode: 'append' }).execute())
        .toThrow('Batch subtitle import requires a subtitle track');
    });

    it('throws when clips array is empty', () => {
      const timeline = makeTimeline();
      const accessor = makeAccessor(timeline);
      const emptyTrack = { id: 'sub-empty', type: 'subtitle' as const, name: 'Empty', clips: [] };
      expect(() => new BatchImportSubtitleCommand(accessor, emptyTrack as any, { mode: 'append' }).execute())
        .toThrow('No subtitle clips to import');
    });

    it('throws when clip in track is not subtitle type', () => {
      const timeline = makeTimeline();
      const accessor = makeAccessor(timeline);
      const videoClip = makeVideoClip({ id: 'vc-1' });
      const badTrack = { id: 'sub-bad', type: 'subtitle' as const, name: 'Mixed', clips: [videoClip as any] };
      expect(() => new BatchImportSubtitleCommand(accessor, badTrack as any, { mode: 'append' }).execute())
        .toThrow('Batch subtitle import can only contain subtitle clips');
    });

    it('throws when targetTrackId points to non-subtitle track', () => {
      const subClip = makeSubtitleClip({ id: 'sub-1', trackId: 'src-track' });
      const sourceTrack = { id: 'src-track', type: 'subtitle' as const, name: 'Source', clips: [subClip] };
      const timeline = makeTimeline();
      const accessor = makeAccessor(timeline);
      expect(() => new BatchImportSubtitleCommand(accessor, sourceTrack as any, { mode: 'append', targetTrackId: 'track-video' }).execute())
        .toThrow('Subtitle import target must be a subtitle track');
    });

    it('appends to existing subtitle track', () => {
      const subClip = makeSubtitleClip({ id: 'sub-new', trackId: 'src', start: 10, duration: 5 });
      const sourceTrack = { id: 'src', type: 'subtitle' as const, name: 'Import', clips: [subClip] };
      const existingSub = makeSubtitleClip({ id: 'sub-existing', trackId: 'track-subtitle', start: 0, duration: 5 });
      const subTrack = createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Existing', clips: [existingSub] });
      const tl = { ...makeTimeline(), tracks: [...makeTimeline().tracks, subTrack] };
      const accessor = makeAccessor(tl);
      new BatchImportSubtitleCommand(accessor, sourceTrack as any, { mode: 'append' }).execute();
      const result = accessor.current().tracks.find(t => t.id === 'track-subtitle');
      expect(result!.clips).toHaveLength(2);
    });

    it('creates new track in new-track mode', () => {
      const subClip = makeSubtitleClip({ id: 'sub-new', trackId: 'src' });
      const sourceTrack = { id: 'src', type: 'subtitle' as const, name: 'Import', clips: [subClip] };
      const existingSub = makeSubtitleClip({ id: 'sub-existing', trackId: 'track-subtitle', start: 0, duration: 5 });
      const subTrack = createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Existing', clips: [existingSub] });
      const tl = { ...makeTimeline(), tracks: [...makeTimeline().tracks, subTrack] };
      const accessor = makeAccessor(tl);
      new BatchImportSubtitleCommand(accessor, sourceTrack as any, { mode: 'new-track' }).execute();
      const subtitleTracks = accessor.current().tracks.filter(t => t.type === 'subtitle');
      expect(subtitleTracks.length).toBeGreaterThanOrEqual(2);
    });

    it('replaces current track in replace-current-track mode', () => {
      const subClip = makeSubtitleClip({ id: 'sub-new', trackId: 'src' });
      const sourceTrack = { id: 'src', type: 'subtitle' as const, name: 'Import', clips: [subClip] };
      const existingSub = makeSubtitleClip({ id: 'sub-existing', trackId: 'track-subtitle', start: 0, duration: 5 });
      const subTrack = createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Existing', clips: [existingSub] });
      const tl = { ...makeTimeline(), tracks: [...makeTimeline().tracks, subTrack] };
      const accessor = makeAccessor(tl);
      new BatchImportSubtitleCommand(accessor, sourceTrack as any, { mode: 'replace-current-track' }).execute();
      const result = accessor.current().tracks.find(t => t.id === 'track-subtitle');
      expect(result!.clips).toHaveLength(1);
      expect(result!.clips[0].id).toBe('sub-new');
    });

    it('undo restores original timeline', () => {
      const subClip = makeSubtitleClip({ id: 'sub-new', trackId: 'src' });
      const sourceTrack = { id: 'src', type: 'subtitle' as const, name: 'Import', clips: [subClip] };
      const existingSub = makeSubtitleClip({ id: 'sub-existing', trackId: 'track-subtitle', start: 0, duration: 5 });
      const subTrack = createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Existing', clips: [existingSub] });
      const tl = { ...makeTimeline(), tracks: [...makeTimeline().tracks, subTrack] };
      const accessor = makeAccessor(tl);
      const manager = new CommandManager();
      manager.execute(new BatchImportSubtitleCommand(accessor, sourceTrack as any, { mode: 'append' }));
      manager.undo();
      const restored = accessor.current().tracks.find(t => t.id === 'track-subtitle');
      expect(restored!.clips).toHaveLength(1);
      expect(restored!.clips[0].id).toBe('sub-existing');
    });
  });

  describe('AddMotionGraphicCommand', () => {
    it('throws when adding to non-video track', () => {
      const timeline = makeTimeline();
      const accessor = makeAccessor(timeline);
      const audioTrack = timeline.tracks.find(t => t.type === 'audio')!;
      const mgClip = makeMotionGraphicClip({ id: 'mg-1' });
      expect(() => new AddMotionGraphicCommand(accessor, audioTrack, mgClip).execute())
        .toThrow('Motion graphics must be added to a video track');
    });

    it('throws when clip overlaps existing on track', () => {
      const existing = makeMotionGraphicClip({ id: 'mg-existing', start: 0, duration: 10 });
      const videoTrack = createTrack({ id: 'track-video', type: 'video', name: 'Video', clips: [existing] });
      const tl = { ...makeTimeline(), tracks: [videoTrack, ...makeTimeline().tracks.filter(t => t.id !== 'track-video')] };
      const accessor = makeAccessor(tl);
      const overlapping = makeMotionGraphicClip({ id: 'mg-new', start: 5, duration: 10 });
      expect(() => new AddMotionGraphicCommand(accessor, videoTrack, overlapping).execute())
        .toThrow('Clip overlaps another clip on this track');
    });

    it('undo removes inserted track', () => {
      const timeline = makeTimeline();
      const accessor = makeAccessor(timeline);
      const newTrack = { id: 'mg-track', type: 'video' as const, name: 'MG Track', clips: [] };
      const mgClip = makeMotionGraphicClip({ id: 'mg-1', trackId: 'mg-track' });
      const manager = new CommandManager();
      manager.execute(new AddMotionGraphicCommand(accessor, newTrack, mgClip));
      expect(accessor.current().tracks.some(t => t.id === 'mg-track')).toBe(true);
      manager.undo();
      expect(accessor.current().tracks.some(t => t.id === 'mg-track')).toBe(false);
    });
  });

  describe('UpdateClipGroupCommand', () => {
    it('throws when group not found', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      expect(() => new UpdateClipGroupCommand(accessor, 'nonexistent-group', { name: 'New' }).execute())
        .toThrow(/Clip group .* not found/);
    });

    it('updates group name and color', () => {
      const clip1 = makeVideoClip({ id: 'c-1' });
      const clip2 = makeVideoClip({ id: 'c-2', start: 15, duration: 5 });
      const timeline = makeTimeline([clip1, clip2]);
      let project = {
        ...makeProject(),
        timeline,
        clipGroups: [{ id: 'group-1', name: 'Old', color: 'blue', clipIds: ['c-1', 'c-2'] }]
      };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateClipGroupCommand(accessor, 'group-1', { name: 'New', color: 'green' }).execute();
      expect(project.clipGroups[0].name).toBe('New');
      expect(project.clipGroups[0].color).toBe('green');
    });
  });

  describe('PackNestedSequenceCommand', () => {
    it('throws when no clips selected', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      expect(() => new PackNestedSequenceCommand(accessor, []).execute())
        .toThrow('No clips selected for nested sequence');
    });

    it('throws when overlapping unselected clip', () => {
      const clip1 = makeVideoClip({ id: 'c-1', start: 0, duration: 10 });
      const clip2 = makeVideoClip({ id: 'c-2', start: 5, duration: 10 });
      let project = { ...makeProject(), timeline: makeTimeline([clip1, clip2]) };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      expect(() => new PackNestedSequenceCommand(accessor, ['c-1']).execute())
        .toThrow('Nested sequence would overlap an unselected clip');
    });
  });

  describe('Subclip commands', () => {
    const makeSubclipObj = (overrides: Partial<Subclip> = {}): Subclip => ({
      id: overrides.id ?? 'subclip-1',
      name: overrides.name ?? 'My Subclip',
      sourceMediaId: overrides.sourceMediaId ?? 'asset-1',
      inPoint: overrides.inPoint ?? 5,
      outPoint: overrides.outPoint ?? 15,
      ...(overrides.color !== undefined ? { color: overrides.color } : {}),
      ...(overrides.description !== undefined ? { description: overrides.description } : {}),
      ...(overrides.createdAt !== undefined ? { createdAt: overrides.createdAt } : {})
    });

    it('AddSubclipCommand adds subclip and undoes', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const subclip = makeSubclipObj();
      const manager = new CommandManager();
      manager.execute(new AddSubclipCommand(accessor, subclip));
      expect(project.subclips).toHaveLength(1);
      expect(project.subclips[0].id).toBe('subclip-1');
      manager.undo();
      expect(project.subclips).toHaveLength(0);
    });

    it('UpdateSubclipCommand updates name and description', () => {
      const subclip = makeSubclipObj();
      let project = { ...makeProject(), subclips: [subclip] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateSubclipCommand(accessor, 'subclip-1', { name: 'Updated', description: 'New desc' }).execute();
      expect(project.subclips[0].name).toBe('Updated');
      expect(project.subclips[0].description).toBe('New desc');
    });

    it('UpdateSubclipCommand clamps inPoint to >= 0', () => {
      const subclip = makeSubclipObj({ inPoint: 5, outPoint: 15 });
      let project = { ...makeProject(), subclips: [subclip] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateSubclipCommand(accessor, 'subclip-1', { inPoint: -3 }).execute();
      expect(project.subclips[0].inPoint).toBe(0);
    });

    it('UpdateSubclipCommand clamps outPoint to >= inPoint', () => {
      const subclip = makeSubclipObj({ inPoint: 5, outPoint: 15 });
      let project = { ...makeProject(), subclips: [subclip] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateSubclipCommand(accessor, 'subclip-1', { outPoint: 2 }).execute();
      expect(project.subclips[0].outPoint).toBe(5);
    });

    it('UpdateSubclipCommand updates color', () => {
      const subclip = makeSubclipObj();
      let project = { ...makeProject(), subclips: [subclip] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateSubclipCommand(accessor, 'subclip-1', { color: 'red' }).execute();
      expect(project.subclips[0].color).toBe('red');
    });

    it('DeleteSubclipCommand removes subclip and undoes', () => {
      const subclip = makeSubclipObj();
      let project = { ...makeProject(), subclips: [subclip] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const manager = new CommandManager();
      manager.execute(new DeleteSubclipCommand(accessor, 'subclip-1'));
      expect(project.subclips).toHaveLength(0);
      manager.undo();
      expect(project.subclips).toHaveLength(1);
      expect(project.subclips[0].id).toBe('subclip-1');
    });

    it('DeleteSubclipCommand handles nonexistent subclip gracefully', () => {
      let project = { ...makeProject(), subclips: [makeSubclipObj()] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new DeleteSubclipCommand(accessor, 'nonexistent').execute();
      expect(project.subclips).toHaveLength(1);
    });
  });

  describe('UpdateProjectBeatSnapSuggestionsCommand', () => {
    it('sets beat snap suggestions', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const suggestions = [
        { clipId: 'c-1', edge: 'in' as const, suggestedTime: 1.5, originalTime: 1.0 },
        { clipId: 'c-1', edge: 'out' as const, suggestedTime: 10.5, originalTime: 10.0 }
      ];
      new UpdateProjectBeatSnapSuggestionsCommand(accessor, suggestions).execute();
      expect(project.beatSnapSuggestions).toHaveLength(2);
      expect(project.beatSnapSuggestions[0].clipId).toBe('c-1');
    });

    it('undo restores previous state', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const suggestions = [{ clipId: 'c-1', edge: 'in' as const, suggestedTime: 1.5, originalTime: 1.0 }];
      const manager = new CommandManager();
      manager.execute(new UpdateProjectBeatSnapSuggestionsCommand(accessor, suggestions));
      manager.undo();
      expect(project.beatSnapSuggestions).toHaveLength(0);
    });
  });

  describe('UpdateProjectMediaCollectionsCommand', () => {
    it('sets media collections', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const collections = [
        { id: 'coll-1', name: 'AI Collection', mediaIds: ['asset-1'], source: 'ai' as const, createdAt: '2024-01-01' }
      ];
      new UpdateProjectMediaCollectionsCommand(accessor, collections).execute();
      expect(project.mediaCollections).toHaveLength(1);
      expect(project.mediaCollections[0].name).toBe('AI Collection');
    });

    it('undo restores previous state', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const collections = [{ id: 'coll-1', name: 'Test', mediaIds: [], source: 'manual' as const, createdAt: '2024-01-01' }];
      const manager = new CommandManager();
      manager.execute(new UpdateProjectMediaCollectionsCommand(accessor, collections));
      manager.undo();
      expect(project.mediaCollections).toHaveLength(0);
    });
  });

  describe('SetMediaFolderCollapsedCommand', () => {
    it('collapses a folder', () => {
      const folder: MediaFolder = { id: 'folder-1', name: 'My Folder', createdAt: '2024-01-01' };
      let project = { ...makeProject(), mediaFolders: [folder] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new SetMediaFolderCollapsedCommand(accessor, 'folder-1', true).execute();
      expect(project.mediaFolders[0].collapsed).toBe(true);
    });

    it('expands a folder', () => {
      const folder: MediaFolder = { id: 'folder-1', name: 'My Folder', collapsed: true, createdAt: '2024-01-01' };
      let project = { ...makeProject(), mediaFolders: [folder] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new SetMediaFolderCollapsedCommand(accessor, 'folder-1', false).execute();
      expect(project.mediaFolders[0].collapsed).toBe(false);
    });

    it('undo restores previous state', () => {
      const folder: MediaFolder = { id: 'folder-1', name: 'My Folder', createdAt: '2024-01-01' };
      let project = { ...makeProject(), mediaFolders: [folder] };
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      const manager = new CommandManager();
      manager.execute(new SetMediaFolderCollapsedCommand(accessor, 'folder-1', true));
      manager.undo();
      expect(project.mediaFolders[0].collapsed).toBeUndefined();
    });
  });

  describe('undo without execute returns safely', () => {
    it('AddSpeakerDiarizationTracksCommand', () => {
      const accessor = makeAccessor(makeTimeline());
      new AddSpeakerDiarizationTracksCommand(accessor, []).undo();
    });
    it('UpdateTrackCommand', () => {
      const accessor = makeAccessor(makeTimeline());
      new UpdateTrackCommand(accessor, 'x', {}).undo();
    });
    it('BatchUpdateTrackCommand', () => {
      const accessor = makeAccessor(makeTimeline());
      new BatchUpdateTrackCommand(accessor, { patches: {} }).undo();
    });
    it('UpdateProjectAudioCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateProjectAudioCommand(accessor, {}).undo();
    });
    it('UpdateProjectBookmarkCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateProjectBookmarkCommand(accessor, 'x', {}).undo();
    });
    it('UpdateProjectBookmarksCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateProjectBookmarksCommand(accessor, []).undo();
    });
    it('UpdateProjectBeatMarkersCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateProjectBeatMarkersCommand(accessor, []).undo();
    });
    it('UpdateProjectExportRangesCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateProjectExportRangesCommand(accessor, []).undo();
    });
    it('UpdateProjectProtectedRangesCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateProjectProtectedRangesCommand(accessor, []).undo();
    });
    it('UpdateProjectAnnotationCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateProjectAnnotationCommand(accessor, 'x', {}).undo();
    });
    it('UpdateReviewAnnotationCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateReviewAnnotationCommand(accessor, 'x', {}).undo();
    });
    it('UpdateCollaborationNoteCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateCollaborationNoteCommand(accessor, 'x', {}).undo();
    });
    it('UpdateTimelineNoteCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new UpdateTimelineNoteCommand(accessor, 'x', {}).undo();
    });
    it('MoveClipsCommand', () => {
      const accessor = makeAccessor(makeTimeline());
      new MoveClipsCommand(accessor, {}).undo();
    });
    it('BatchSplitAtSceneCutsCommand', () => {
      const accessor = makeAccessor(makeTimeline());
      new BatchSplitAtSceneCutsCommand(accessor, []).undo();
    });
    it('BatchAddMarkersCommand', () => {
      const accessor = makeAccessor(makeTimeline());
      new BatchAddMarkersCommand(accessor, []).undo();
    });
    it('RemoveProjectBookmarkCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new RemoveProjectBookmarkCommand(accessor, 'x').undo();
    });
    it('RemoveReviewAnnotationCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new RemoveReviewAnnotationCommand(accessor, 'x').undo();
    });
    it('RemoveCollaborationNoteCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new RemoveCollaborationNoteCommand(accessor, 'x').undo();
    });
    it('RemoveTimelineNoteCommand', () => {
      let project = makeProject();
      const accessor = { getProject: () => project, setProject: (next: typeof project) => { project = next; } };
      new RemoveTimelineNoteCommand(accessor, 'x').undo();
    });
    it('RemoveTimelineMarkerCommand', () => {
      const accessor = makeAccessor(makeTimeline());
      new RemoveTimelineMarkerCommand(accessor, 'x').undo();
    });
  });

  describe('coverage: project property ?? [] branches', () => {
    const makePAccessor = () => {
      let project = { ...makeProject(), timeline: makeTimeline([makeVideoClip({ id: 'tc', start: 0, duration: 10 })]) };
      return {
        acc: {
          getProject: () => project,
          setProject: (next: typeof project) => { project = next; }
        },
        project: () => project,
        del: (prop: string) => { delete (project as any)[prop]; }
      };
    };
    const annInput = () => ({ text: 'a', time: 1, color: '#fff' });
    const revInput = () => ({ text: 'r', time: 2, severity: 'info' as const });
    const colInput = () => ({ text: 'c', author: 'u' });
    const noteInput = () => ({ start: 3, end: 4 });
    const bmkInput = () => ({ time: 5, label: 'b' });

    // --- annotations ---
    it('AddProjectAnnotation.execute with undefined annotations', () => {
      const { acc, project, del } = makePAccessor();
      del('annotations');
      new AddProjectAnnotationCommand(acc, annInput()).execute();
      expect(project().annotations).toHaveLength(1);
    });
    it('AddProjectAnnotation.undo with undefined annotations', () => {
      const { acc, project, del } = makePAccessor();
      const cmd = new AddProjectAnnotationCommand(acc, annInput());
      cmd.execute();
      del('annotations');
      cmd.undo();
      expect(project().annotations).toEqual([]);
    });
    it('UpdateProjectAnnotation.execute with undefined annotations', () => {
      const { acc, del } = makePAccessor();
      del('annotations');
      expect(() => new UpdateProjectAnnotationCommand(acc, 'x', {}).execute()).toThrow();
    });
    it('UpdateProjectAnnotation.undo with undefined annotations', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddProjectAnnotationCommand(acc, annInput());
      add.execute();
      const id = project().annotations![0].id;
      const upd = new UpdateProjectAnnotationCommand(acc, id, { text: 'u' });
      upd.execute();
      del('annotations');
      upd.undo();
      expect(project().annotations).toEqual([]);
    });
    it('RemoveProjectAnnotation.execute with undefined annotations', () => {
      const { acc, del } = makePAccessor();
      del('annotations');
      expect(() => new RemoveProjectAnnotationCommand(acc, 'x').execute()).toThrow();
    });
    it('RemoveProjectAnnotation.undo with undefined annotations', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddProjectAnnotationCommand(acc, annInput());
      add.execute();
      const id = project().annotations![0].id;
      const rm = new RemoveProjectAnnotationCommand(acc, id);
      rm.execute();
      del('annotations');
      rm.undo();
      expect(project().annotations).toHaveLength(1);
    });

    // --- reviewAnnotations ---
    it('AddReviewAnnotation.execute with undefined reviewAnnotations', () => {
      const { acc, project, del } = makePAccessor();
      del('reviewAnnotations');
      new AddReviewAnnotationCommand(acc, revInput()).execute();
      expect(project().reviewAnnotations).toHaveLength(1);
    });
    it('AddReviewAnnotation.undo with undefined reviewAnnotations', () => {
      const { acc, project, del } = makePAccessor();
      const cmd = new AddReviewAnnotationCommand(acc, revInput());
      cmd.execute();
      del('reviewAnnotations');
      cmd.undo();
      expect(project().reviewAnnotations).toEqual([]);
    });
    it('UpdateReviewAnnotation.execute with undefined reviewAnnotations', () => {
      const { acc, del } = makePAccessor();
      del('reviewAnnotations');
      expect(() => new UpdateReviewAnnotationCommand(acc, 'x', {}).execute()).toThrow();
    });
    it('UpdateReviewAnnotation.undo with undefined reviewAnnotations', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddReviewAnnotationCommand(acc, revInput());
      add.execute();
      const id = project().reviewAnnotations![0].id;
      const upd = new UpdateReviewAnnotationCommand(acc, id, { text: 'u' });
      upd.execute();
      del('reviewAnnotations');
      upd.undo();
      expect(project().reviewAnnotations).toEqual([]);
    });
    it('RemoveReviewAnnotation.execute with undefined reviewAnnotations', () => {
      const { acc, del } = makePAccessor();
      del('reviewAnnotations');
      expect(() => new RemoveReviewAnnotationCommand(acc, 'x').execute()).toThrow();
    });
    it('RemoveReviewAnnotation.undo with undefined reviewAnnotations', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddReviewAnnotationCommand(acc, revInput());
      add.execute();
      const id = project().reviewAnnotations![0].id;
      const rm = new RemoveReviewAnnotationCommand(acc, id);
      rm.execute();
      del('reviewAnnotations');
      rm.undo();
      expect(project().reviewAnnotations).toHaveLength(1);
    });

    // --- collaborationNotes ---
    it('AddCollaborationNote.execute with undefined collaborationNotes', () => {
      const { acc, project, del } = makePAccessor();
      del('collaborationNotes');
      new AddCollaborationNoteCommand(acc, colInput()).execute();
      expect(project().collaborationNotes).toHaveLength(1);
    });
    it('AddCollaborationNote.undo with undefined collaborationNotes', () => {
      const { acc, project, del } = makePAccessor();
      const cmd = new AddCollaborationNoteCommand(acc, colInput());
      cmd.execute();
      del('collaborationNotes');
      cmd.undo();
      expect(project().collaborationNotes).toEqual([]);
    });
    it('UpdateCollaborationNote.execute with undefined collaborationNotes', () => {
      const { acc, del } = makePAccessor();
      del('collaborationNotes');
      expect(() => new UpdateCollaborationNoteCommand(acc, 'x', { updatedAt: '2026-01-01T00:00:00.000Z' }).execute()).toThrow();
    });
    it('UpdateCollaborationNote.undo with undefined collaborationNotes', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddCollaborationNoteCommand(acc, colInput());
      add.execute();
      const id = project().collaborationNotes![0].id;
      const upd = new UpdateCollaborationNoteCommand(acc, id, { text: 'u', updatedAt: '2026-01-01T00:00:00.000Z' });
      upd.execute();
      del('collaborationNotes');
      upd.undo();
      expect(project().collaborationNotes).toEqual([]);
    });
    it('RemoveCollaborationNote.execute with undefined collaborationNotes', () => {
      const { acc, del } = makePAccessor();
      del('collaborationNotes');
      expect(() => new RemoveCollaborationNoteCommand(acc, 'x').execute()).toThrow();
    });
    it('RemoveCollaborationNote.undo with undefined collaborationNotes', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddCollaborationNoteCommand(acc, colInput());
      add.execute();
      const id = project().collaborationNotes![0].id;
      const rm = new RemoveCollaborationNoteCommand(acc, id);
      rm.execute();
      del('collaborationNotes');
      rm.undo();
      expect(project().collaborationNotes).toHaveLength(1);
    });

    // --- timelineNotes ---
    it('AddTimelineNote.execute with undefined timelineNotes', () => {
      const { acc, project, del } = makePAccessor();
      del('timelineNotes');
      new AddTimelineNoteCommand(acc, noteInput()).execute();
      expect(project().timelineNotes).toHaveLength(1);
    });
    it('AddTimelineNote.undo with undefined timelineNotes', () => {
      const { acc, project, del } = makePAccessor();
      const cmd = new AddTimelineNoteCommand(acc, noteInput());
      cmd.execute();
      del('timelineNotes');
      cmd.undo();
      expect(project().timelineNotes).toEqual([]);
    });
    it('UpdateTimelineNote.execute with undefined timelineNotes', () => {
      const { acc, del } = makePAccessor();
      del('timelineNotes');
      expect(() => new UpdateTimelineNoteCommand(acc, 'x', {}).execute()).toThrow();
    });
    it('UpdateTimelineNote.undo with undefined timelineNotes', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddTimelineNoteCommand(acc, noteInput());
      add.execute();
      const id = project().timelineNotes![0].id;
      const upd = new UpdateTimelineNoteCommand(acc, id, { text: 'u' });
      upd.execute();
      del('timelineNotes');
      upd.undo();
      expect(project().timelineNotes).toEqual([]);
    });
    it('RemoveTimelineNote.execute with undefined timelineNotes', () => {
      const { acc, del } = makePAccessor();
      del('timelineNotes');
      expect(() => new RemoveTimelineNoteCommand(acc, 'x').execute()).toThrow();
    });
    it('RemoveTimelineNote.undo with undefined timelineNotes', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddTimelineNoteCommand(acc, noteInput());
      add.execute();
      const id = project().timelineNotes![0].id;
      const rm = new RemoveTimelineNoteCommand(acc, id);
      rm.execute();
      del('timelineNotes');
      rm.undo();
      expect(project().timelineNotes).toHaveLength(1);
    });

    // --- bookmarks ---
    it('AddProjectBookmark.execute with undefined bookmarks', () => {
      const { acc, project, del } = makePAccessor();
      del('bookmarks');
      new AddProjectBookmarkCommand(acc, bmkInput()).execute();
      expect(project().bookmarks).toHaveLength(1);
    });
    it('AddProjectBookmark.undo with undefined bookmarks', () => {
      const { acc, project, del } = makePAccessor();
      const cmd = new AddProjectBookmarkCommand(acc, bmkInput());
      cmd.execute();
      del('bookmarks');
      cmd.undo();
      expect(project().bookmarks).toEqual([]);
    });
    it('UpdateProjectBookmark.execute with undefined bookmarks', () => {
      const { acc, del } = makePAccessor();
      del('bookmarks');
      expect(() => new UpdateProjectBookmarkCommand(acc, 'x', {}).execute()).toThrow();
    });
    it('UpdateProjectBookmark.undo with undefined bookmarks', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddProjectBookmarkCommand(acc, bmkInput());
      add.execute();
      const id = project().bookmarks![0].id;
      const upd = new UpdateProjectBookmarkCommand(acc, id, { note: 'u' });
      upd.execute();
      del('bookmarks');
      upd.undo();
      expect(project().bookmarks).toEqual([]);
    });
    it('RemoveProjectBookmark.execute with undefined bookmarks', () => {
      const { acc, del } = makePAccessor();
      del('bookmarks');
      expect(() => new RemoveProjectBookmarkCommand(acc, 'x').execute()).toThrow();
    });
    it('RemoveProjectBookmark.undo with undefined bookmarks', () => {
      const { acc, project, del } = makePAccessor();
      const add = new AddProjectBookmarkCommand(acc, bmkInput());
      add.execute();
      const id = project().bookmarks![0].id;
      const rm = new RemoveProjectBookmarkCommand(acc, id);
      rm.execute();
      del('bookmarks');
      rm.undo();
      expect(project().bookmarks).toHaveLength(1);
    });
  });

  describe('coverage: timeline transitions/markers ?? [] branches', () => {
    const twoAdjacentClips = () => {
      const c1 = makeVideoClip({ id: 'c1', start: 0, duration: 5 });
      const c2 = makeVideoClip({ id: 'c2', start: 5, duration: 5, mediaId: 'm2' });
      return makeTimeline([c1, c2]);
    };

    it('AddTransition.execute with undefined transitions', () => {
      const accessor = makeAccessor(twoAdjacentClips());
      delete (accessor.current() as any).transitions;
      new AddTransitionCommand(accessor, { type: 'dissolve' as const, duration: 1, fromClipId: 'c1', toClipId: 'c2' }).execute();
      expect(accessor.current().transitions).toHaveLength(1);
    });
    it('AddTransition.undo with undefined transitions', () => {
      const accessor = makeAccessor(twoAdjacentClips());
      const cmd = new AddTransitionCommand(accessor, { type: 'dissolve' as const, duration: 1, fromClipId: 'c1', toClipId: 'c2' });
      cmd.execute();
      delete (accessor.current() as any).transitions;
      cmd.undo();
      expect(accessor.current().transitions).toEqual([]);
    });
    it('RemoveTransition.execute with undefined transitions', () => {
      const accessor = makeAccessor(twoAdjacentClips());
      delete (accessor.current() as any).transitions;
      expect(() => new RemoveTransitionCommand(accessor, 'x').execute()).toThrow();
    });
    it('RemoveTransition.undo with undefined transitions', () => {
      const accessor = makeAccessor(twoAdjacentClips());
      const add = new AddTransitionCommand(accessor, { type: 'dissolve' as const, duration: 1, fromClipId: 'c1', toClipId: 'c2' });
      add.execute();
      const tid = accessor.current().transitions![0].id;
      const rm = new RemoveTransitionCommand(accessor, tid);
      rm.execute();
      delete (accessor.current() as any).transitions;
      rm.undo();
      expect(accessor.current().transitions).toHaveLength(1);
    });

    it('AddTimelineMarker.execute with undefined markers', () => {
      const accessor = makeAccessor(makeTimeline());
      new AddTimelineMarkerCommand(accessor, { time: 5, label: 'm' }).execute();
      expect(accessor.current().markers).toHaveLength(1);
    });
    it('AddTimelineMarker.undo with undefined markers', () => {
      const accessor = makeAccessor(makeTimeline());
      const cmd = new AddTimelineMarkerCommand(accessor, { time: 5, label: 'm' });
      cmd.execute();
      expect(accessor.current().markers).toBeDefined();
      delete (accessor.current() as any).markers;
      cmd.undo();
      expect(accessor.current().markers ?? []).toEqual([]);
    });
    it('UpdateTimelineMarker.execute with undefined markers', () => {
      const accessor = makeAccessor(makeTimeline());
      delete (accessor.current() as any).markers;
      expect(() => new UpdateTimelineMarkerCommand(accessor, 'x', {}).execute()).toThrow();
    });
    it('UpdateTimelineMarker.undo with undefined markers', () => {
      const accessor = makeAccessor(makeTimeline());
      const add = new AddTimelineMarkerCommand(accessor, { time: 5, label: 'm' });
      add.execute();
      const mid = accessor.current().markers![0].id;
      const upd = new UpdateTimelineMarkerCommand(accessor, mid, { label: 'u' });
      upd.execute();
      delete (accessor.current() as any).markers;
      upd.undo();
      expect(accessor.current().markers ?? []).toEqual([]);
    });
    it('RemoveTimelineMarker.execute with undefined markers', () => {
      const accessor = makeAccessor(makeTimeline());
      delete (accessor.current() as any).markers;
      expect(() => new RemoveTimelineMarkerCommand(accessor, 'x').execute()).toThrow();
    });
    it('RemoveTimelineMarker.undo with undefined markers', () => {
      const accessor = makeAccessor(makeTimeline());
      const add = new AddTimelineMarkerCommand(accessor, { time: 5, label: 'm' });
      add.execute();
      const mid = accessor.current().markers![0].id;
      const rm = new RemoveTimelineMarkerCommand(accessor, mid);
      rm.execute();
      delete (accessor.current() as any).markers;
      rm.undo();
      expect(accessor.current().markers).toHaveLength(1);
    });

    it('DeleteClip.execute with undefined transitions', () => {
      const tl = makeTimeline([makeVideoClip({ id: 'dc', start: 0, duration: 5 })]);
      const accessor = makeAccessor(tl);
      delete (accessor.current() as any).transitions;
      new DeleteClipCommand(accessor, 'dc').execute();
      expect(accessor.current().tracks[0].clips).toHaveLength(0);
    });
    it('SplitClip.execute with undefined transitions', () => {
      const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'sc', start: 0, duration: 10 })]));
      delete (accessor.current() as any).transitions;
      new SplitClipCommand(accessor, 'sc', 5).execute();
      const allClips = accessor.current().tracks.flatMap((t) => t.clips);
      expect(allClips.filter((c) => c.id.startsWith('sc'))).toHaveLength(0);
      expect(allClips.length).toBeGreaterThanOrEqual(2);
    });
    it('RippleDelete.execute with undefined transitions', () => {
      const tl = makeTimeline([makeVideoClip({ id: 'rd', start: 0, duration: 5 })]);
      const accessor = makeAccessor(tl);
      delete (accessor.current() as any).transitions;
      new RippleDeleteCommand(accessor, ['rd']).execute();
      expect(accessor.current().tracks[0].clips).toHaveLength(0);
    });
    it('CloseGap.execute with undefined transitions', () => {
      const c1 = makeVideoClip({ id: 'g1', start: 0, duration: 3 });
      const c2 = makeVideoClip({ id: 'g2', start: 5, duration: 5, mediaId: 'm2' });
      const tl = makeTimeline([c1, c2]);
      const accessor = makeAccessor(tl);
      delete (accessor.current() as any).transitions;
      new CloseGapCommand(accessor, tl.tracks[0].id, 4).execute();
      expect(accessor.current().tracks[0].clips[1].start).toBeCloseTo(3);
    });
    it('RollingTrim.execute with undefined transitions', () => {
      const c1 = makeVideoClip({ id: 'rt1', start: 0, duration: 5, trimEnd: 2 });
      const c2 = makeVideoClip({ id: 'rt2', start: 5, duration: 5, mediaId: 'm2', trimStart: 1 });
      const tl = makeTimeline([c1, c2]);
      const accessor = makeAccessor(tl);
      delete (accessor.current() as any).transitions;
      new RollingTrimCommand(accessor, 'rt1', 'rt2', 1).execute();
      const clips = accessor.current().tracks[0].clips;
      expect(clips.find((c) => c.id === 'rt1')!.duration).toBeCloseTo(6);
    });
  });

  describe('coverage: sort comparator || branches', () => {
    it('CloseGap with same-start clips triggers id comparator', () => {
      const c1 = makeVideoClip({ id: 'aa', start: 0, duration: 3 });
      const c2 = makeVideoClip({ id: 'bb', start: 5, duration: 5, mediaId: 'm2' });
      const tl = makeTimeline([c1, c2]);
      const accessor = makeAccessor(tl);
      new CloseGapCommand(accessor, tl.tracks[0].id, 4).execute();
      expect(accessor.current().tracks[0].clips[1].start).toBeCloseTo(3);
    });
    it('SlideClip with 3 adjacent clips triggers sort comparator', () => {
      const c1 = makeVideoClip({ id: 's1', start: 0, duration: 5, trimEnd: 2 });
      const c2 = makeVideoClip({ id: 's2', start: 5, duration: 5, mediaId: 'm2' });
      const c3 = makeVideoClip({ id: 's3', start: 10, duration: 5, mediaId: 'm3', trimEnd: 2 });
      const tl = makeTimeline([c1, c2, c3]);
      const accessor = makeAccessor(tl);
      new SlideClipCommand(accessor, 's2', 1).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 's2')!.start).toBeCloseTo(6);
    });
  });

  describe('coverage: helper error paths', () => {
    it('findTrack throws for non-existent trackId', () => {
      const tl = makeTimeline([makeVideoClip()]);
      const accessor = makeAccessor(tl);
      expect(() => new CloseGapCommand(accessor, 'non-existent-track', 5).execute()).toThrow(/not found/i);
    });
    it('findClip throws for non-existent clipId', () => {
      const tl = makeTimeline([makeVideoClip()]);
      const accessor = makeAccessor(tl);
      expect(() => new TrimClipCommand(accessor, 'non-existent-clip', 0, 0).execute()).toThrow(/not found/i);
    });
    it('findClipLocation throws for non-existent clipId', () => {
      const tl = makeTimeline([makeVideoClip()]);
      const accessor = makeAccessor(tl);
      expect(() => new DeleteClipsCommand(accessor, ['non-existent-clip']).execute()).toThrow(/not found/i);
    });
    it('normalizeAssetIdSet throws for empty array', () => {
      const project = makeProject();
      const acc = { getProject: () => project, setProject: () => {} };
      expect(() => new RemoveMediaCommand(acc, []).execute()).toThrow(/No media assets selected/i);
    });
    it('assertMediaAssetsExist throws for missing asset', () => {
      const project = makeProject();
      const acc = { getProject: () => project, setProject: () => {} };
      expect(() => new RemoveMediaCommand(acc, ['non-existent']).execute()).toThrow(/not found/i);
    });
  });

  describe('coverage: undo guard early returns', () => {
    it('AddProjectAnnotationCommand.undo() without execute is a no-op', () => {
      const project = makeProject();
      const acc = { getProject: () => project, setProject: () => {} };
      const cmd = new AddProjectAnnotationCommand(acc, { text: 'a', time: 1, color: '#fff' });
      cmd.undo();
      expect(project.annotations ?? []).toHaveLength(0);
    });
    it('AddReviewAnnotationCommand.undo() without execute is a no-op', () => {
      const project = makeProject();
      const acc = { getProject: () => project, setProject: () => {} };
      const cmd = new AddReviewAnnotationCommand(acc, { text: 'r', time: 2, severity: 'info' });
      cmd.undo();
      expect(project.reviewAnnotations ?? []).toHaveLength(0);
    });
    it('AddCollaborationNoteCommand.undo() without execute is a no-op', () => {
      const project = makeProject();
      const acc = { getProject: () => project, setProject: () => {} };
      const cmd = new AddCollaborationNoteCommand(acc, { text: 'c', author: 'u' });
      cmd.undo();
      expect(project.collaborationNotes ?? []).toHaveLength(0);
    });
    it('AddTimelineNoteCommand.undo() without execute is a no-op', () => {
      const project = makeProject();
      const acc = { getProject: () => project, setProject: () => {} };
      const cmd = new AddTimelineNoteCommand(acc, { start: 3, end: 4 });
      cmd.undo();
      expect(project.timelineNotes ?? []).toHaveLength(0);
    });
  });

  describe('coverage: UpdateClipCommand ?? ternary branches', () => {
    it('patch with masks hits else branch', () => {
      const clip = makeVideoClip({ id: 'uc-masks', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-masks', { masks: [] }).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 'uc-masks')!.masks).toBeDefined();
    });
    it('patch with motionTrack hits else branch', () => {
      const clip = makeVideoClip({ id: 'uc-mt', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-mt', { motionTrack: [{ time: 0, dx: 10, dy: 5 }] }).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 'uc-mt')!.motionTrack).toBeDefined();
    });
    it('patch with border hits else branch', () => {
      const clip = makeVideoClip({ id: 'uc-border', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-border', { border: { width: 2, color: '#ff0000' } }).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 'uc-border')!.border).toBeDefined();
    });
    it('patch with contentAnalysis hits else branch', () => {
      const clip = makeVideoClip({ id: 'uc-ca', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-ca', { contentAnalysis: { scenes: [{ start: 0, end: 2 }] } }).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 'uc-ca')!.contentAnalysis).toBeDefined();
    });
    it('patch with pitchData hits else branch', () => {
      const clip = makeVideoClip({ id: 'uc-pd', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-pd', { pitchData: [{ time: 0, hz: 440 }] }).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 'uc-pd')!.pitchData).toBeDefined();
    });
  });

  describe('coverage: UpdateClipCommand beatMarkers/detectedBpm branches', () => {
    it('patch with beatMarkers hits else branch', () => {
      const clip = makeVideoClip({ id: 'uc-bm', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-bm', { beatMarkers: [{ time: 1, label: 'beat' }] }).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 'uc-bm')!.beatMarkers).toBeDefined();
    });
    it('patch with detectedBpm hits else branch', () => {
      const clip = makeVideoClip({ id: 'uc-bpm', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-bpm', { detectedBpm: 120 }).execute();
      expect(accessor.current().tracks[0].clips.find((c) => c.id === 'uc-bpm')!.detectedBpm).toBe(120);
    });
  });

  describe('coverage: UpdateClipCommand type-specific branches', () => {
    it('subtitle clip type-specific normalization', () => {
      const clip = makeSubtitleClip({ id: 'uc-sub', start: 0, duration: 2, trackId: 'track-text' });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-sub', { text: 'Updated subtitle' }).execute();
      expect(accessor.current().tracks.flatMap((t) => t.clips).find((c) => c.id === 'uc-sub')!.text).toBe('Updated subtitle');
    });
    it('credits clip type-specific normalization', () => {
      const clip = makeCreditsClip({ id: 'uc-credits', start: 0, duration: 5 });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-credits', { text: 'Director | Bob' }).execute();
      expect(accessor.current().tracks.flatMap((t) => t.clips).find((c) => c.id === 'uc-credits')!.text).toBe('Director | Bob');
    });
    it('motion-graphic clip type-specific normalization', () => {
      const clip = makeMotionGraphicClip({ id: 'uc-mg', start: 0, duration: 5, trackId: 'track-video' });
      const tl = makeTimeline([clip]);
      const accessor = makeAccessor(tl);
      new UpdateClipCommand(accessor, 'uc-mg', { text: 'Updated MG' }).execute();
      expect(accessor.current().tracks.flatMap((t) => t.clips).find((c) => c.id === 'uc-mg')!.text).toBe('Updated MG');
    });
  });

});
