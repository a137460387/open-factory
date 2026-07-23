/**
 * Audio-Visual Analysis Bridge Tests
 *
 * Tests the TypeScript bridge functions that wrap Tauri invoke calls.
 * Since we can't invoke Tauri in unit tests, we verify function signatures
 * and parameter transformation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import {
  analyzeAudioRhythm,
  computeFftMagnitudes,
  detectVisualHighlights,
  mergeVisualWithAudioBeats,
} from './audio-visual-analysis';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

// ==================== analyzeAudioRhythm ====================

describe('analyzeAudioRhythm', () => {
  it('calls invoke with correct command name', async () => {
    mockInvoke.mockResolvedValueOnce({
      spectrum_frames: [],
      onsets: [],
      tempo: null,
      pattern: { pattern_type: 'irregular', confidence: 0, avg_interval: 0, interval_variance: 0 },
      beat_times: [],
      energy_curve: [],
      stats: { total_frames: 0, onset_count: 0, avg_spectral_centroid: 0, avg_energy: 0 },
    });

    await analyzeAudioRhythm(new Float64Array([1, 2, 3]), 44100);
    expect(mockInvoke).toHaveBeenCalledWith('analyze_audio_rhythm_command', expect.objectContaining({
      audioSamples: [1, 2, 3],
      sampleRate: 44100,
    }));
  });

  it('converts Float64Array to regular array', async () => {
    mockInvoke.mockResolvedValueOnce({
      spectrum_frames: [], onsets: [], tempo: null,
      pattern: { pattern_type: 'irregular', confidence: 0, avg_interval: 0, interval_variance: 0 },
      beat_times: [], energy_curve: [],
      stats: { total_frames: 0, onset_count: 0, avg_spectral_centroid: 0, avg_energy: 0 },
    });

    const input = new Float64Array([0.1, 0.2, 0.3]);
    await analyzeAudioRhythm(input, 44100);
    const calledWith = mockInvoke.mock.calls[0][1] as any;
    expect(calledWith.audioSamples).toEqual([0.1, 0.2, 0.3]);
    expect(Array.isArray(calledWith.audioSamples)).toBe(true);
  });

  it('applies default config when partial config provided', async () => {
    mockInvoke.mockResolvedValueOnce({
      spectrum_frames: [], onsets: [], tempo: null,
      pattern: { pattern_type: 'irregular', confidence: 0, avg_interval: 0, interval_variance: 0 },
      beat_times: [], energy_curve: [],
      stats: { total_frames: 0, onset_count: 0, avg_spectral_centroid: 0, avg_energy: 0 },
    });

    await analyzeAudioRhythm([1], 44100, { fft_size: 4096 });
    const calledWith = mockInvoke.mock.calls[0][1] as any;
    expect(calledWith.config.fft_size).toBe(4096);
    expect(calledWith.config.hop_size).toBe(512); // default
    expect(calledWith.config.onset_threshold).toBe(0.3); // default
  });

  it('passes null config when no config provided', async () => {
    mockInvoke.mockResolvedValueOnce({
      spectrum_frames: [], onsets: [], tempo: null,
      pattern: { pattern_type: 'irregular', confidence: 0, avg_interval: 0, interval_variance: 0 },
      beat_times: [], energy_curve: [],
      stats: { total_frames: 0, onset_count: 0, avg_spectral_centroid: 0, avg_energy: 0 },
    });

    await analyzeAudioRhythm([1], 44100);
    const calledWith = mockInvoke.mock.calls[0][1] as any;
    expect(calledWith.config).toBeNull();
  });
});

// ==================== computeFftMagnitudes ====================

describe('computeFftMagnitudes', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce([0.5, 0.3]);
    const result = await computeFftMagnitudes([1, 2, 3, 4]);
    expect(mockInvoke).toHaveBeenCalledWith('compute_fft_magnitudes', { input: [1, 2, 3, 4] });
    expect(result).toEqual([0.5, 0.3]);
  });

  it('converts Float64Array to array', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await computeFftMagnitudes(new Float64Array([0.1, 0.2]));
    const calledWith = mockInvoke.mock.calls[0][1] as any;
    expect(Array.isArray(calledWith.input)).toBe(true);
    expect(calledWith.input).toEqual([0.1, 0.2]);
  });
});

// ==================== detectVisualHighlights ====================

describe('detectVisualHighlights', () => {
  const mockResult = {
    frame_metrics: [],
    highlights: [],
    energy_curve: [],
    stats: { total_frames: 0, highlight_count: 0, avg_motion_intensity: 0, avg_scene_change: 0 },
  };

  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce(mockResult);
    const frames = [new Uint8Array([1, 2, 3])];
    await detectVisualHighlights(frames, 3, 1);
    expect(mockInvoke).toHaveBeenCalledWith('detect_visual_highlights_command', expect.objectContaining({
      width: 3,
      height: 1,
    }));
  });

  it('converts Uint8Array frames to regular arrays', async () => {
    mockInvoke.mockResolvedValueOnce(mockResult);
    const frames = [new Uint8Array([10, 20, 30])];
    await detectVisualHighlights(frames, 3, 1);
    const calledWith = mockInvoke.mock.calls[0][1] as any;
    expect(calledWith.frames).toEqual([[10, 20, 30]]);
  });

  it('applies default config values for partial config', async () => {
    mockInvoke.mockResolvedValueOnce(mockResult);
    await detectVisualHighlights([new Uint8Array([1])], 1, 1, { fps: 60 });
    const calledWith = mockInvoke.mock.calls[0][1] as any;
    expect(calledWith.config.fps).toBe(60);
    expect(calledWith.config.motion_threshold).toBe(0.15); // default
    expect(calledWith.config.scene_change_threshold).toBe(0.4); // default
  });
});

// ==================== mergeVisualWithAudioBeats ====================

describe('mergeVisualWithAudioBeats', () => {
  it('calls invoke with correct parameters', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const highlights = [{ time: 1.0, frame_index: 30, score: 0.8, highlight_type: 'motion-peak', duration: 0.033 }];
    const beats = [1.05, 2.0];
    await mergeVisualWithAudioBeats(highlights, beats, 0.5);
    expect(mockInvoke).toHaveBeenCalledWith('merge_visual_with_audio_beats', {
      visualHighlights: highlights,
      audioBeatTimes: beats,
      toleranceSeconds: 0.5,
    });
  });

  it('uses default tolerance of 0.3', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await mergeVisualWithAudioBeats([], []);
    const calledWith = mockInvoke.mock.calls[0][1] as any;
    expect(calledWith.toleranceSeconds).toBe(0.3);
  });
});
