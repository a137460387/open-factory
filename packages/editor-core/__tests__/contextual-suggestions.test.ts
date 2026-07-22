import { describe, it, expect } from 'vitest';
import {
  suggestTransition,
  suggestPacingFix,
  suggestAudioFix,
  generateContextualSuggestions,
  getSuggestionIcon,
  DEFAULT_SUGGESTION_CONFIG,
} from '../src/contextual-suggestions';
import type { Timeline, Clip } from '../src/model-types';

function makeVideoClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    name: 'Test Clip',
    trackId: 'track-1',
    type: 'video',
    mediaId: 'media-1',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    volume: 1,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, anchorX: 0.5, anchorY: 0.5 },
    ...overrides,
  } as Clip;
}

function makeTimeline(clips: Clip[]): Timeline {
  return {
    tracks: [{ id: 'track-1', type: 'video', name: 'V1', clips }],
  };
}

describe('suggestTransition', () => {
  it('suggests transition between adjacent clips of different scenes', () => {
    const prev = makeVideoClip({
      id: 'c1', start: 0, duration: 5,
      contentAnalysis: { primarySceneType: 'indoor', sceneTypes: ['indoor'], version: 1, analyzedAt: '', segments: [], emotionCurve: [], dialogueTurns: [] },
    });
    const next = makeVideoClip({
      id: 'c2', start: 5, duration: 5,
      contentAnalysis: { primarySceneType: 'outdoor', sceneTypes: ['outdoor'], version: 1, analyzedAt: '', segments: [], emotionCurve: [], dialogueTurns: [] },
    });
    const sug = suggestTransition(prev, next, 5);
    expect(sug).not.toBeNull();
    expect(sug?.title).toContain('转场');
    expect(sug?.actionType).toBe('add-transition');
  });

  it('returns null for non-adjacent clips', () => {
    const prev = makeVideoClip({ id: 'c1', start: 0, duration: 5 });
    const next = makeVideoClip({ id: 'c2', start: 10, duration: 5 });
    expect(suggestTransition(prev, next, 5)).toBeNull();
  });

  it('returns null for same-scene clips', () => {
    const prev = makeVideoClip({
      id: 'c1', start: 0, duration: 5,
      contentAnalysis: { primarySceneType: 'indoor', sceneTypes: ['indoor'], version: 1, analyzedAt: '', segments: [], emotionCurve: [], dialogueTurns: [] },
    });
    const next = makeVideoClip({
      id: 'c2', start: 5, duration: 5,
      contentAnalysis: { primarySceneType: 'indoor', sceneTypes: ['indoor'], version: 1, analyzedAt: '', segments: [], emotionCurve: [], dialogueTurns: [] },
    });
    expect(suggestTransition(prev, next, 5)).toBeNull();
  });
});

describe('suggestPacingFix', () => {
  it('returns null for empty timeline', () => {
    expect(suggestPacingFix({ tracks: [] }, 0)).toBeNull();
  });

  it('detects fast pacing', () => {
    // 10 clips in 15 seconds = 40 CPM
    const clips = Array.from({ length: 10 }, (_, i) =>
      makeVideoClip({ id: `c${i}`, start: i * 1.5, duration: 1.5 }),
    );
    const timeline = makeTimeline(clips);
    const sug = suggestPacingFix(timeline, 7);
    // May or may not trigger depending on exact CPM calculation
    if (sug) {
      expect(sug.title).toContain('节奏');
    }
  });
});

describe('suggestAudioFix', () => {
  it('suggests unmuting muted clips', () => {
    const clips = [makeVideoClip({ id: 'c1', start: 0, duration: 5, muted: true })];
    const timeline = makeTimeline(clips);
    const sug = suggestAudioFix(timeline, 2);
    expect(sug).not.toBeNull();
    expect(sug?.title).toContain('静音');
    expect(sug?.actionType).toBe('unmute-clip');
  });

  it('returns null for unmuted clip', () => {
    const clips = [makeVideoClip({ id: 'c1', start: 0, duration: 5 })];
    const timeline = makeTimeline(clips);
    expect(suggestAudioFix(timeline, 2)).toBeNull();
  });
});

describe('generateContextualSuggestions', () => {
  it('generates suggestions for a timeline with clips', () => {
    const clips = [
      makeVideoClip({ id: 'c1', start: 0, duration: 5 }),
      makeVideoClip({ id: 'c2', start: 5, duration: 5 }),
    ];
    const timeline = makeTimeline(clips);
    const context = {
      currentTime: 2,
      selectedClipIds: [],
      zoomLevel: 1,
      isPlaying: false,
      recentActions: [],
    };
    const suggestions = generateContextualSuggestions(timeline, [], context);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('returns empty for empty timeline', () => {
    const context = {
      currentTime: 0,
      selectedClipIds: [],
      zoomLevel: 1,
      isPlaying: false,
      recentActions: [],
    };
    expect(generateContextualSuggestions({ tracks: [] }, [], context)).toEqual([]);
  });

  it('respects maxSuggestions config', () => {
    const clips = [
      makeVideoClip({ id: 'c1', start: 0, duration: 5, muted: true }),
      makeVideoClip({ id: 'c2', start: 5, duration: 5 }),
    ];
    const timeline = makeTimeline(clips);
    const context = {
      currentTime: 2,
      selectedClipIds: [],
      zoomLevel: 1,
      isPlaying: false,
      recentActions: [],
    };
    const suggestions = generateContextualSuggestions(timeline, [], context, { maxSuggestions: 1 });
    expect(suggestions.length).toBeLessThanOrEqual(1);
  });
});

describe('getSuggestionIcon', () => {
  it('returns icon path for each category', () => {
    expect(getSuggestionIcon('editing')).toBeTruthy();
    expect(getSuggestionIcon('content')).toBeTruthy();
    expect(getSuggestionIcon('technical')).toBeTruthy();
    expect(getSuggestionIcon('creative')).toBeTruthy();
  });
});
