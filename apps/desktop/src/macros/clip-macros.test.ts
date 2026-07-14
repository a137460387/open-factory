import { describe, expect, it } from 'vitest';
import {
  AddEffectCommand,
  UpdateClipCommand,
  createTrack,
  type Timeline,
  type TimelineAccessor,
} from '@open-factory/editor-core';
import {
  appendMacroHistoryEntry,
  buildMacroCommands,
  detectMacroShortcutConflicts,
  findMacroTargetClip,
  getMacroSteps,
  parseMacroFile,
  replaceMacroTargetClipId,
  readMacroHistory,
  serializeMacroFile,
  snapshotCommand,
  writeClipMacros,
  writeMacroHistory,
  type ClipMacro,
  type MacroStorage,
} from './clip-macros';

function makeStorage(files: Map<string, string>): MacroStorage {
  return {
    getAppDataDir: () => 'C:/Users/E2E/AppData/Roaming/open-factory',
    readFile: (path) => {
      const value = files.get(path);
      if (value === undefined) {
        throw new Error(`missing ${path}`);
      }
      return value;
    },
    writeFile: (path, contents) => {
      files.set(path, contents);
    },
  };
}

function makeTimeline(): Timeline {
  return {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: 'track-video',
        type: 'video',
        name: 'Video',
        clips: [
          {
            id: 'clip-a',
            type: 'video',
            name: 'A',
            trackId: 'track-video',
            mediaId: 'media-a',
            start: 0,
            duration: 2,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
            transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          },
          {
            id: 'clip-b',
            type: 'video',
            name: 'B',
            trackId: 'track-video',
            mediaId: 'media-b',
            start: 2,
            duration: 3,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
            transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          },
        ],
      }),
    ],
  };
}

function makeTimelineAccessor(timeline = makeTimeline()): TimelineAccessor & { current(): Timeline } {
  let current = timeline;
  return {
    getTimeline: () => current,
    setTimeline: (next) => {
      current = next;
    },
    current: () => current,
  };
}

describe('clip macros', () => {
  it('detects shortcut conflicts against timeline bindings while allowing the binding', () => {
    const macros: ClipMacro[] = [
      { id: 'macro-scale-150', name: 'Scale', shortcut: 'Space', patch: { transform: { scale: 1.5 } } },
    ];

    expect(detectMacroShortcutConflicts(macros, {})['macro-scale-150']).toEqual([
      { accelerator: 'Space', type: 'timeline', timelineAction: 'toggle-playback' },
    ]);
  });

  it('finds the selected clip first and falls back to the playhead clip', () => {
    const timeline = makeTimeline();

    expect(findMacroTargetClip(timeline, ['clip-a'], 3)?.id).toBe('clip-a');
    expect(findMacroTargetClip(timeline, [], 3)?.id).toBe('clip-b');
    expect(findMacroTargetClip(timeline, ['missing'], 1)?.id).toBe('clip-a');
  });

  it('serializes and deserializes shareable macro files', () => {
    const raw = serializeMacroFile([
      {
        id: 'macro-scale-150',
        name: 'Scale 150',
        description: 'scale selected clip',
        shortcut: 'cmd+shift+m',
        patch: { transform: { scale: 1.5, opacity: 0.75 }, volume: 0.8 },
        steps: [
          {
            type: 'update-clip',
            clipId: '__TARGET_CLIP__',
            patch: { transform: { scale: 1.5, opacity: 0.75 }, volume: 0.8 },
          },
          { type: 'add-effect', clipId: '__TARGET_CLIP__', effect: { type: 'vignette', params: { intensity: 0.2 } } },
        ],
      },
      {
        id: 'macro-invalid',
        name: 'Invalid',
        patch: {},
      },
    ]);

    expect(parseMacroFile(raw)).toEqual([
      {
        id: 'macro-scale-150',
        name: 'Scale 150',
        description: 'scale selected clip',
        shortcut: 'Ctrl+Shift+M',
        patch: { transform: { scale: 1.5, opacity: 0.75 }, volume: 0.8 },
        steps: [
          {
            type: 'update-clip',
            clipId: '__TARGET_CLIP__',
            patch: { transform: { scale: 1.5, opacity: 0.75 }, volume: 0.8 },
          },
          {
            type: 'add-effect',
            clipId: '__TARGET_CLIP__',
            effect: { type: 'vignette', enabled: undefined, id: undefined, params: { intensity: 0.2, radius: 0.6 } },
          },
        ],
      },
    ]);
  });

  it('records update commands and replays the same command sequence on another clip', () => {
    const sourceAccessor = makeTimelineAccessor();
    const recorded = [
      new UpdateClipCommand(sourceAccessor, 'clip-a', { transform: { scale: 1.25 } }),
      new UpdateClipCommand(sourceAccessor, 'clip-a', { colorCorrection: { contrast: 1.2, saturation: 0.8 } }),
    ].map((command) => {
      command.execute();
      return snapshotCommand(command);
    });
    expect(recorded).toEqual([
      { type: 'update-clip', clipId: 'clip-a', patch: { transform: { scale: 1.25 } } },
      { type: 'update-clip', clipId: 'clip-a', patch: { colorCorrection: { contrast: 1.2, saturation: 0.8 } } },
    ]);

    const replayAccessor = makeTimelineAccessor();
    const macro: ClipMacro = {
      id: 'macro-recorded',
      name: 'Recorded',
      steps: recorded.flatMap((step) => (step ? [step] : [])),
    };
    for (const command of buildMacroCommands(replayAccessor, macro, 'clip-b')) {
      command.execute();
    }

    const replayedClip = replayAccessor.current().tracks[0].clips.find((clip) => clip.id === 'clip-b');
    expect(replayedClip?.transform.scale).toBe(1.25);
    expect(replayedClip?.colorCorrection.contrast).toBe(1.2);
    expect(replayedClip?.colorCorrection.saturation).toBe(0.8);
  });

  it('replaces target clip ids during replay without mutating the saved step', () => {
    const step = { type: 'update-clip' as const, clipId: 'clip-a', patch: { transform: { opacity: 0.5 } } };

    expect(replaceMacroTargetClipId(step, 'clip-b')).toEqual({
      type: 'update-clip',
      clipId: 'clip-b',
      patch: { transform: { opacity: 0.5 } },
    });
    expect(step.clipId).toBe('clip-a');
  });

  it('falls back to legacy patch macros as a single update command step', () => {
    const steps = getMacroSteps({ id: 'legacy', name: 'Legacy', patch: { volume: 0.4 } });

    expect(steps).toEqual([{ type: 'update-clip', clipId: '__TARGET_CLIP__', patch: { volume: 0.4 } }]);
  });

  it('persists macros.json with editable command steps', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);

    await writeClipMacros(
      [
        {
          id: 'macro-effect',
          name: 'Effect',
          steps: [{ type: 'add-effect', clipId: '__TARGET_CLIP__', effect: { type: 'blur', params: { radius: 12 } } }],
        },
      ],
      storage,
    );

    const raw = files.get('C:/Users/E2E/AppData/Roaming/open-factory/macros.json');
    expect(JSON.parse(raw!).macros[0].steps).toEqual([
      { type: 'add-effect', clipId: '__TARGET_CLIP__', effect: { type: 'blur', params: { radius: 12 } } },
    ]);
  });

  it('records serializable effect commands', () => {
    const accessor = makeTimelineAccessor();
    const command = new AddEffectCommand(accessor, 'clip-a', { type: 'blur', params: { radius: 9 } });
    command.execute();

    expect(snapshotCommand(command)).toEqual({
      type: 'add-effect',
      clipId: 'clip-a',
      effect: { id: undefined, type: 'blur', enabled: undefined, params: { radius: 9 } },
    });
  });

  it('persists only the latest 20 history entries', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);

    for (let index = 0; index < 22; index += 1) {
      await appendMacroHistoryEntry(
        {
          id: `history-${index}`,
          macroId: 'macro-scale-150',
          macroName: 'Scale',
          targetClipId: `clip-${index}`,
          triggeredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
          success: true,
        },
        storage,
      );
    }

    const history = await readMacroHistory(storage);
    expect(history).toHaveLength(20);
    expect(history[0].targetClipId).toBe('clip-21');
    expect(history[19].targetClipId).toBe('clip-2');
    const raw = files.get('C:/Users/E2E/AppData/Roaming/open-factory/macro-history.json');
    expect(JSON.parse(raw!).entries).toHaveLength(20);
  });

  it('sanitizes history writes before persisting', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);

    await writeMacroHistory(
      [
        {
          id: 'history-1',
          macroId: 'macro-scale-150',
          macroName: 'Scale',
          triggeredAt: '2026-01-01T00:00:00.000Z',
          success: true,
          shortcut: 'cmd+m',
        },
      ],
      storage,
    );

    expect(await readMacroHistory(storage)).toEqual([
      {
        id: 'history-1',
        macroId: 'macro-scale-150',
        macroName: 'Scale',
        triggeredAt: '2026-01-01T00:00:00.000Z',
        success: true,
        shortcut: 'Ctrl+M',
      },
    ]);
  });
});
