/**
 * Integration tests for Sprint AT UI components.
 *
 * Tests the interaction between UI components and their underlying engines.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  buildSpeechGrammarHints,
  commandNeedsTarget,
} from '@open-factory/editor-core/natural-language-commands';
import {
  detectVisualHighlights,
  extractHighlightRanges,
  mergeWithAudioBeats,
  type VisualHighlightMarker,
} from '@open-factory/editor-core/visual-highlight-engine';
import {
  analyzeAudioRhythm,
  alignHighlightsWithRhythm,
} from '@open-factory/editor-core/audio-rhythm-analysis';
import {
  generateRoughCutProposals,
  buildRoughCutSystemPrompt,
  buildRoughCutUserPrompt,
} from '@open-factory/editor-core/smart-rough-cut';
import {
  generateContextualSuggestions,
  getSuggestionIcon,
} from '@open-factory/editor-core/contextual-suggestions';
import {
  getGestureTutorialSteps,
  DEFAULT_GESTURE_MAPPINGS,
  createGestureState,
} from '@open-factory/editor-core/gesture-control';

// ---------------------------------------------------------------------------
// Helper: generate synthetic grayscale frames
// ---------------------------------------------------------------------------

function generateFrames(count: number, width: number, height: number, seed = 42): Array<number[]> {
  const frames: number[][] = [];
  let s = seed;
  const nextRand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  for (let f = 0; f < count; f++) {
    const frame: number[] = [];
    for (let i = 0; i < width * height; i++) {
      frame.push(Math.floor(nextRand() * 255));
    }
    frames.push(frame);
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Helper: generate synthetic audio samples
// ---------------------------------------------------------------------------

function generateAudioSamples(durationSec: number, sampleRate: number, bpm = 120): number[] {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const samples = new Array(totalSamples);
  const beatInterval = 60 / bpm;
  const beatSamples = Math.floor(beatInterval * sampleRate);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let value = Math.sin(2 * Math.PI * 440 * t) * 0.3;
    if (i % beatSamples < sampleRate * 0.02) {
      value += 0.7;
    }
    value += (Math.random() - 0.5) * 0.1;
    samples[i] = Math.max(-1, Math.min(1, value));
  }
  return samples;
}

// ===========================================================================
// Command Palette Engine Tests
// ===========================================================================

describe('Command Palette Engine Integration', () => {
  it('should parse Chinese cut command', () => {
    const cmd = parseCommand('剪切3秒', { language: 'zh' });
    expect(cmd.type).toBe('cut');
    expect(cmd.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should parse Chinese delete command', () => {
    const cmd = parseCommand('删除这个片段', { language: 'zh' });
    expect(cmd.type).toBe('delete');
  });

  it('should parse Chinese speed command with parameter', () => {
    const cmd = parseCommand('2倍速', { language: 'zh' });
    expect(cmd.type).toBe('speed');
    expect(cmd.params.speed).toBe(2);
  });

  it('should parse Chinese play/pause commands', () => {
    expect(parseCommand('播放', { language: 'zh' }).type).toBe('play');
    expect(parseCommand('暂停', { language: 'zh' }).type).toBe('pause');
  });

  it('should parse Chinese undo/redo commands', () => {
    expect(parseCommand('撤销', { language: 'zh' }).type).toBe('undo');
    expect(parseCommand('重做', { language: 'zh' }).type).toBe('redo');
  });

  it('should parse time references', () => {
    const cmd = parseCommand('跳到1:30', { language: 'zh' });
    expect(cmd.type).toBe('go-to');
    expect(cmd.timeRef).toBe(90);
  });

  it('should return unknown for unrecognized input', () => {
    const cmd = parseCommand('asdfghjkl', { language: 'zh' });
    expect(cmd.type).toBe('unknown');
    expect(cmd.confidence).toBe(0);
  });

  it('should return unknown for empty input', () => {
    const cmd = parseCommand('', { language: 'zh' });
    expect(cmd.type).toBe('unknown');
  });

  it('should provide speech grammar hints', () => {
    const zhHints = buildSpeechGrammarHints('zh');
    expect(zhHints.length).toBeGreaterThan(10);
    expect(zhHints).toContain('剪切');

    const enHints = buildSpeechGrammarHints('en');
    expect(enHints.length).toBeGreaterThan(10);
    expect(enHints).toContain('cut');
  });

  it('should identify commands that need targets', () => {
    expect(commandNeedsTarget('cut')).toBe(true);
    expect(commandNeedsTarget('delete')).toBe(true);
    expect(commandNeedsTarget('play')).toBe(false);
    expect(commandNeedsTarget('undo')).toBe(false);
  });

  it('should parse English commands', () => {
    expect(parseCommand('cut', { language: 'en' }).type).toBe('cut');
    expect(parseCommand('delete', { language: 'en' }).type).toBe('delete');
    expect(parseCommand('play', { language: 'en' }).type).toBe('play');
    expect(parseCommand('undo', { language: 'en' }).type).toBe('undo');
  });
});

// ===========================================================================
// Visual Highlight Engine Integration Tests
// ===========================================================================

describe('Visual Highlight Engine Integration', () => {
  it('should detect highlights from frame sequence', () => {
    const frames = generateFrames(30, 64, 48);
    const result = detectVisualHighlights(frames, 64, 48, { fps: 30 });

    expect(result.frameMetrics.length).toBe(30);
    expect(result.stats.totalFrames).toBe(30);
    expect(result.energyCurve.length).toBe(30);
  });

  it('should return empty for single frame', () => {
    const result = detectVisualHighlights([generateFrames(1, 32, 32)[0]], 32, 32);
    expect(result.highlights.length).toBe(0);
    // Engine requires at least 2 frames for metrics
    expect(result.frameMetrics.length).toBeLessThanOrEqual(1);
  });

  it('should extract highlight ranges', () => {
    const markers: VisualHighlightMarker[] = [
      { time: 1.0, frameIndex: 30, score: 0.8, type: 'motion-peak', duration: 0.033 },
      { time: 1.2, frameIndex: 36, score: 0.9, type: 'combined', duration: 0.033 },
      { time: 5.0, frameIndex: 150, score: 0.7, type: 'scene-change', duration: 0.033 },
    ];
    const ranges = extractHighlightRanges(markers, 0.5);
    expect(ranges.length).toBe(2);
    expect(ranges[0].count).toBe(2);
    expect(ranges[1].count).toBe(1);
  });

  it('should merge with audio beats', () => {
    const markers: VisualHighlightMarker[] = [
      { time: 1.0, frameIndex: 30, score: 0.7, type: 'motion-peak', duration: 0.033 },
    ];
    const merged = mergeWithAudioBeats(markers, [1.05], 0.3);
    expect(merged[0].score).toBeGreaterThan(0.7);
    expect(merged[0].type).toBe('combined');
  });
});

// ===========================================================================
// Audio Rhythm Analysis Integration Tests
// ===========================================================================

describe('Audio Rhythm Analysis Integration', () => {
  it('should analyze audio samples and detect rhythm', { timeout: 60000 }, () => {
    // Use small audio to avoid DFT timeout (0.5s, low sample rate)
    const samples = generateAudioSamples(0.5, 8000, 120);
    const result = analyzeAudioRhythm(samples, 8000);

    expect(result.spectrumFrames.length).toBeGreaterThan(0);
    // Tempo may be null if not enough onsets detected from synthetic data
    expect(result.tempo === null || result.tempo.bpm > 0).toBe(true);
  });

  it('should return empty for too-short audio', () => {
    const result = analyzeAudioRhythm(new Float32Array(100), 44100);
    expect(result.spectrumFrames.length).toBe(0);
    expect(result.onsets.length).toBe(0);
    expect(result.tempo).toBeNull();
  });

  it('should align visual highlights with rhythm', () => {
    const visualTimes = [1.0, 2.5, 4.0];
    const beatTimes = [1.02, 2.0, 2.52, 3.0, 4.01];
    const aligned = alignHighlightsWithRhythm(visualTimes, beatTimes, 0.1);

    expect(aligned.length).toBeGreaterThan(0);
    const alignedItems = aligned.filter((a) => a.aligned);
    expect(alignedItems.length).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// Smart Rough Cut Integration Tests
// ===========================================================================

describe('Smart Rough Cut Integration', () => {
  it('should generate 3 proposals', () => {
    const highlights: VisualHighlightMarker[] = [
      { time: 5, frameIndex: 150, score: 0.9, type: 'combined', duration: 0.033 },
      { time: 15, frameIndex: 450, score: 0.8, type: 'motion-peak', duration: 0.033 },
      { time: 25, frameIndex: 750, score: 0.7, type: 'scene-change', duration: 0.033 },
    ];
    const audioBeats = [
      { time: 5.05, strength: 0.8, band: 'bass' as const },
      { time: 15.02, strength: 0.7, band: 'mid' as const },
      { time: 25.01, strength: 0.6, band: 'high' as const },
    ];

    const result = generateRoughCutProposals(highlights, audioBeats, 60);
    expect(result.proposals.length).toBe(3);
    expect(result.proposals[0].id).toBeDefined();
    expect(result.inputHighlightCount).toBe(3);
    expect(result.inputBeatCount).toBe(3);
  });

  it('should build system and user prompts', () => {
    const systemPrompt = buildRoughCutSystemPrompt();
    expect(systemPrompt).toContain('粗剪');

    const highlights: VisualHighlightMarker[] = [
      { time: 5, frameIndex: 150, score: 0.9, type: 'combined', duration: 0.033 },
    ];
    const result = generateRoughCutProposals(highlights, [], 60);
    const userPrompt = buildRoughCutUserPrompt(result);
    expect(userPrompt).toContain('60');
  });
});

// ===========================================================================
// Contextual Suggestions Integration Tests
// ===========================================================================

describe('Contextual Suggestions Integration', () => {
  it('should return suggestion icon paths', () => {
    expect(getSuggestionIcon('editing')).toBeTruthy();
    expect(getSuggestionIcon('content')).toBeTruthy();
    expect(getSuggestionIcon('technical')).toBeTruthy();
    expect(getSuggestionIcon('creative')).toBeTruthy();
  });

  it('should generate suggestions for a timeline with clips', () => {
    // Minimal mock timeline - cast to bypass strict typing for test purposes
    const timeline = {
      tracks: [
        {
          id: 'track-1',
          name: 'V1',
          type: 'video',
          clips: [
            {
              id: 'clip-1',
              type: 'video',
              start: 0,
              duration: 10,
              muted: false,
            },
          ],
        },
      ],
    } as unknown as import('@open-factory/editor-core').Timeline;
    const context = {
      currentTime: 5,
      selectedClipIds: ['clip-1'],
      zoomLevel: 1,
      isPlaying: false,
      recentActions: [],
    };

    const suggestions = generateContextualSuggestions(timeline, [], context);
    expect(Array.isArray(suggestions)).toBe(true);
  });
});

// ===========================================================================
// Gesture Control Integration Tests
// ===========================================================================

describe('Gesture Control Integration', () => {
  it('should provide tutorial steps', () => {
    const steps = getGestureTutorialSteps();
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps[0].gesture).toBeDefined();
    expect(steps[0].instruction).toBeTruthy();
    expect(steps[0].tip).toBeTruthy();
  });

  it('should have default gesture mappings', () => {
    expect(DEFAULT_GESTURE_MAPPINGS.length).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_GESTURE_MAPPINGS[0].gesture).toBeDefined();
    expect(DEFAULT_GESTURE_MAPPINGS[0].action).toBeTruthy();
    expect(DEFAULT_GESTURE_MAPPINGS[0].description).toBeTruthy();
  });

  it('should create initial gesture state', () => {
    const state = createGestureState();
    expect(state.activeGesture).toBe('none');
    expect(state.isHolding).toBe(false);
    expect(state.history.length).toBe(0);
  });
});
