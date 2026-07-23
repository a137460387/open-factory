import { invoke } from '@tauri-apps/api/core';

// ==================== Audio Rhythm Analysis ====================

export interface AudioRhythmConfig {
  fft_size: number;
  hop_size: number;
  sample_rate: number;
  onset_threshold: number;
  min_bpm: number;
  max_bpm: number;
  min_onset_gap: number;
}

export interface SpectrumFrame {
  time: number;
  magnitudes: number[];
  centroid: number;
  flux: number;
  band_energies: [number, number, number, number, number, number];
}

export interface OnsetEvent {
  time: number;
  strength: number;
  band: string;
}

export interface TempoEstimate {
  bpm: number;
  confidence: number;
  phase: number;
}

export interface RhythmPattern {
  pattern_type: string;
  confidence: number;
  avg_interval: number;
  interval_variance: number;
}

export interface AudioRhythmStats {
  total_frames: number;
  onset_count: number;
  avg_spectral_centroid: number;
  avg_energy: number;
}

export interface AudioRhythmResult {
  spectrum_frames: SpectrumFrame[];
  onsets: OnsetEvent[];
  tempo: TempoEstimate | null;
  pattern: RhythmPattern;
  beat_times: number[];
  energy_curve: [number, number][];
  stats: AudioRhythmStats;
}

/**
 * Run full audio rhythm analysis on raw audio samples via Rust backend.
 * Uses Cooley-Tukey FFT (O(n log n)) instead of JS DFT (O(n²)).
 */
export async function analyzeAudioRhythm(
  audioSamples: Float64Array | number[],
  sampleRate: number,
  config?: Partial<AudioRhythmConfig>,
): Promise<AudioRhythmResult> {
  return invoke<AudioRhythmResult>('analyze_audio_rhythm_command', {
    audioSamples: Array.from(audioSamples),
    sampleRate,
    config: config ? {
      fft_size: config.fft_size ?? 2048,
      hop_size: config.hop_size ?? 512,
      sample_rate: config.sample_rate ?? sampleRate,
      onset_threshold: config.onset_threshold ?? 0.3,
      min_bpm: config.min_bpm ?? 60,
      max_bpm: config.max_bpm ?? 200,
      min_onset_gap: config.min_onset_gap ?? 0.05,
    } : null,
  });
}

/**
 * Compute FFT magnitudes for real-time spectrum display.
 */
export async function computeFftMagnitudes(input: Float64Array | number[]): Promise<number[]> {
  return invoke<number[]>('compute_fft_magnitudes', {
    input: Array.from(input),
  });
}

// ==================== Visual Highlight Detection ====================

export interface VisualHighlightConfig {
  motion_threshold: number;
  scene_change_threshold: number;
  window_size: number;
  min_gap_seconds: number;
  fps: number;
}

export interface FrameVisualMetrics {
  frame_index: number;
  time: number;
  motion_intensity: number;
  scene_change_score: number;
  visual_energy: number;
}

export interface VisualHighlightMarker {
  time: number;
  frame_index: number;
  score: number;
  highlight_type: string;
  duration: number;
}

export interface VisualHighlightStats {
  total_frames: number;
  highlight_count: number;
  avg_motion_intensity: number;
  avg_scene_change: number;
}

export interface VisualHighlightResult {
  frame_metrics: FrameVisualMetrics[];
  highlights: VisualHighlightMarker[];
  energy_curve: [number, number][];
  stats: VisualHighlightStats;
}

/**
 * Detect visual highlights from grayscale frame data via Rust backend.
 * Uses SIMD-accelerated pixel difference calculation.
 */
export async function detectVisualHighlights(
  frames: Uint8Array[],
  width: number,
  height: number,
  config?: Partial<VisualHighlightConfig>,
): Promise<VisualHighlightResult> {
  return invoke<VisualHighlightResult>('detect_visual_highlights_command', {
    frames: frames.map((f) => Array.from(f)),
    width,
    height,
    config: config ? {
      motion_threshold: config.motion_threshold ?? 0.15,
      scene_change_threshold: config.scene_change_threshold ?? 0.4,
      window_size: config.window_size ?? 5,
      min_gap_seconds: config.min_gap_seconds ?? 0.5,
      fps: config.fps ?? 30,
    } : null,
  });
}

/**
 * Merge visual highlights with audio beat times for combined scoring.
 */
export async function mergeVisualWithAudioBeats(
  visualHighlights: VisualHighlightMarker[],
  audioBeatTimes: number[],
  toleranceSeconds: number = 0.3,
): Promise<VisualHighlightMarker[]> {
  return invoke<VisualHighlightMarker[]>('merge_visual_with_audio_beats', {
    visualHighlights,
    audioBeatTimes,
    toleranceSeconds,
  });
}
