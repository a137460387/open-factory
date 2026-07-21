import { describe, it, expect } from 'vitest';
import { detectAudioBeats, analyzeVideoMotion, matchRhythmToTemplate, createRhythmAlignedTemplate } from './rhythm-matcher';
import type { EditingTemplate } from '../models/template-schema';
import type { RhythmProfile } from './rhythm-matcher';

function makeTemplate(overrides: Partial<EditingTemplate> = {}): EditingTemplate {
  return {
    metadata: {
      id: 'tpl-rhythm', version: '1.0', name: 'Rhythm Template', description: '',
      category: 'music-video', tags: [], author: 'test',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      aspectRatio: '16:9', resolutionWidth: 1920, resolutionHeight: 1080,
      frameRate: 30, estimatedDurationSec: 10, difficulty: 'beginner',
    },
    tracks: [{
      type: 'video', name: 'main',
      clips: [{
        type: 'video', durationSec: 10, flexibleDuration: false,
        placeholder: 'user-video', placeholderParams: {},
        effects: [], keyframes: [], colorNodes: [],
        opacity: 1, speed: 1, volume: 1,
      }],
      transitions: [], trackEffects: [], muted: false, locked: false,
    }],
    audioLayout: {
      tracks: [{ role: 'music', volumeDb: -18, pan: 0, fadeInSec: 0.5, fadeOutSec: 0.5 }],
      masterLoudnessTarget: -14, masterLimiter: true,
    },
    globalColorNodes: [], variables: [], ...overrides,
  };
}

function makeRhythm(overrides: Partial<RhythmProfile> = {}): RhythmProfile {
  return { bpm: 120, beats: [], avgBeatInterval: 0.5, rhythmType: 'medium', ...overrides };
}

function generateSineWave(durationSec: number, freq: number, sampleRate: number): number[] {
  const count = Math.floor(durationSec * sampleRate);
  return Array.from({ length: count }, (_, i) => Math.sin(2 * Math.PI * freq * (i / sampleRate)));
}

describe('Rhythm Matcher', () => {
  describe('detectAudioBeats', () => {
    it('returns empty array for empty input', () => {
      expect(detectAudioBeats([])).toEqual([]);
    });

    it('detects peaks in audio with amplitude spikes', () => {
      const sr = 44100;
      const samples: number[] = new Array(sr).fill(0);
      for (let i = 11000; i < 11500; i++) samples[i] = 0.9;
      for (let i = 33000; i < 33500; i++) samples[i] = 0.95;
      const beats = detectAudioBeats(samples, sr);
      expect(beats.length).toBeGreaterThanOrEqual(1);
      beats.forEach((b) => {
        expect(b.time).toBeGreaterThanOrEqual(0);
        expect(b.strength).toBeGreaterThan(0);
        expect(b.strength).toBeLessThanOrEqual(1);
      });
    });

    it('respects custom sample rate', () => {
      const sr = 22050;
      const samples = generateSineWave(1, 440, sr);
      for (let i = 5000; i < 5300; i++) samples[i] = 0.95;
      const beats = detectAudioBeats(samples, sr);
      beats.forEach((b) => expect(b.time).toBeGreaterThanOrEqual(0));
    });
  });

  describe('analyzeVideoMotion', () => {
    it('returns empty array for empty frames', () => {
      expect(analyzeVideoMotion([])).toEqual([]);
    });

    it('normalizes magnitudes and estimates direction', () => {
      const frames = [
        { time: 0, motionMagnitude: 0.2 },
        { time: 0.033, motionMagnitude: 0.8 },
        { time: 0.066, motionMagnitude: 0.4 },
      ];
      const result = analyzeVideoMotion(frames);
      expect(result).toHaveLength(3);
      expect(result[1].motionMagnitude).toBe(1);
      expect(result[0].motionMagnitude).toBeCloseTo(0.25, 1);
      expect(typeof result[0].direction).toBe('number');
    });

    it('handles single frame', () => {
      const result = analyzeVideoMotion([{ time: 0, motionMagnitude: 0.5 }]);
      expect(result).toHaveLength(1);
      expect(result[0].motionMagnitude).toBe(1);
    });
  });

  describe('matchRhythmToTemplate', () => {
    it('returns original template when no beats', () => {
      const result = matchRhythmToTemplate(makeRhythm(), makeTemplate());
      expect(result.tracks[0].clips[0].keyframes).toHaveLength(0);
    });

    it('injects keyframes on strong beats', () => {
      const rhythm = makeRhythm({
        beats: [
          { time: 2, strength: 0.8, frequency: 1 },
          { time: 5, strength: 0.6, frequency: 0 },
        ],
      });
      const result = matchRhythmToTemplate(rhythm, makeTemplate());
      const scaleKfs = result.tracks[0].clips[0].keyframes.filter((k) => k.property === 'scale');
      expect(scaleKfs.length).toBeGreaterThanOrEqual(1);
    });

    it('preserves template metadata', () => {
      const rhythm = makeRhythm({ beats: [{ time: 1, strength: 0.9, frequency: 1 }] });
      const tpl = makeTemplate();
      const result = matchRhythmToTemplate(rhythm, tpl);
      expect(result.metadata.id).toBe(tpl.metadata.id);
      expect(result.metadata.name).toBe(tpl.metadata.name);
    });
  });

  describe('createRhythmAlignedTemplate', () => {
    it('handles empty audio and video data', () => {
      const result = createRhythmAlignedTemplate(makeTemplate(), [], []);
      expect(result.metadata.id).toBe('tpl-rhythm');
    });

    it('produces a template from audio data with peaks', () => {
      const sr = 44100;
      const samples = generateSineWave(2, 440, sr);
      for (let i = 11000; i < 11500; i++) samples[i] = 0.95;
      for (let i = 33000; i < 33500; i++) samples[i] = 0.95;
      const frames = [{ time: 0.5, motionMagnitude: 0.8 }, { time: 1.0, motionMagnitude: 0.9 }];
      const result = createRhythmAlignedTemplate(makeTemplate(), samples, frames, { sampleRate: sr });
      expect(result.metadata.id).toBe('tpl-rhythm');
    });

    it('accepts custom options', () => {
      const result = createRhythmAlignedTemplate(makeTemplate(), [], [], {
        sampleRate: 22050, fps: 24, audioWeight: 0.5,
      });
      expect(result.metadata.id).toBe('tpl-rhythm');
    });
  });
});
