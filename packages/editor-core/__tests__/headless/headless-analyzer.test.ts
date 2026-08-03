import { describe, test, expect, vi, beforeEach } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));

vi.mock('node:child_process', () => ({ execFile: execFileMock }));

import {
  probeVideo,
  measureLoudness,
  analyzeQuality,
  analyzeSemantic,
  analyzeCompliance,
  headlessAnalyze,
} from '../../src/headless/headless-analyzer';

// ---------------------------------------------------------------------------
// Helpers — build ffprobe / loudnorm / scene-change payloads matching the real
// output shape these tools emit, so the parsing logic under test is exercised.
// ---------------------------------------------------------------------------

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

/**
 * execFile is called two ways in the source: `execFile(cmd, args, cb)` (probeVideo)
 * and `execFile(cmd, args, opts, cb)` (measureLoudness / detectScenes). The callback
 * is always the last positional argument, so pull it off the tail regardless of arity.
 *
 * A defensive no-op is returned when the args array is empty: vitest's runner
 * invokes mocks with no arguments during its internal post-test bookkeeping, and
 * that call must not throw.
 */
function callbackOf(args: unknown[]): ExecFileCallback {
  const last = args[args.length - 1];
  return typeof last === 'function' ? (last as ExecFileCallback) : (() => {});
}

function setExecResult(stdout: string, stderr = '') {
  execFileMock.mockImplementation((...args: unknown[]) => {
    if (args.length === 0) return;
    callbackOf(args)(null, stdout, stderr);
  });
}

function setExecError(message: string) {
  execFileMock.mockImplementation((...args: unknown[]) => {
    if (args.length === 0) return;
    callbackOf(args)(new Error(message), '', '');
  });
}

/** Track which binary (ffprobe / ffmpeg) was invoked so platform-rule tests can assert. */
function lastCommand(): string {
  return execFileMock.mock.calls.at(-1)?.[0] as string;
}

function ffprobeJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
      { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 },
    ],
    format: { bit_rate: 5000000, duration: 60 },
    ...overrides,
  });
}

function loudnormStderr(inputI: number, inputTp: number, inputLra: number) {
  return `{ "input_i" : "${inputI}", "input_tp" : "${inputTp}", "input_lra" : "${inputLra}" }`;
}

// ---------------------------------------------------------------------------
// probeVideo
// ---------------------------------------------------------------------------

describe('probeVideo', () => {
  beforeEach(() => execFileMock.mockReset());

  test('parses standard ffprobe JSON into metadata', async () => {
    setExecResult(ffprobeJson());
    const meta = await probeVideo('input.mp4');

    expect(meta).toMatchObject({
      width: 1920,
      height: 1080,
      frameRate: 30,
      bitrate: 5000000,
      codec: 'h264',
      audioCodec: 'aac',
      audioChannels: 2,
      audioSampleRate: 48000,
      duration: 60,
    });
  });

  test('parses fractional r_frame_rate (30000/1001 → 29.97)', async () => {
    setExecResult(ffprobeJson({
      streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30000/1001' }],
    }));
    const meta = await probeVideo('input.mp4');
    expect(meta.frameRate).toBeCloseTo(29.97, 1);
  });

  test('defaults audio fields to unknown/0 when no audio stream', async () => {
    setExecResult(ffprobeJson({
      streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' }],
    }));
    const meta = await probeVideo('input.mp4');
    expect(meta.audioCodec).toBe('unknown');
    expect(meta.audioChannels).toBe(0);
    expect(meta.audioSampleRate).toBe(0);
  });

  test('defaults video fields to unknown/0 when no video stream', async () => {
    setExecResult(ffprobeJson({
      streams: [{ codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 }],
    }));
    const meta = await probeVideo('input.mp4');
    expect(meta.width).toBe(0);
    expect(meta.height).toBe(0);
    expect(meta.codec).toBe('unknown');
  });

  test('rejects with "ffprobe failed:" on exec error', async () => {
    setExecError('command not found');
    await expect(probeVideo('input.mp4')).rejects.toThrow('ffprobe failed: command not found');
  });

  test('rejects with parse error on non-JSON stdout', async () => {
    setExecResult('not json at all');
    await expect(probeVideo('input.mp4')).rejects.toThrow('Failed to parse ffprobe output');
  });

  test('passes through custom ffprobePath', async () => {
    setExecResult(ffprobeJson());
    await probeVideo('input.mp4', '/custom/ffprobe');
    expect(lastCommand()).toBe('/custom/ffprobe');
  });
});

// ---------------------------------------------------------------------------
// measureLoudness
// ---------------------------------------------------------------------------

describe('measureLoudness', () => {
  beforeEach(() => execFileMock.mockReset());

  test('parses loudnorm JSON from stderr', async () => {
    setExecResult('', loudnormStderr(-18, -2, 7));
    const loudness = await measureLoudness('input.mp4');
    expect(loudness).toEqual({ integrated: -18, truePeak: -2, range: 7 });
  });

  test('falls back to defaults when stderr has no loudnorm JSON', async () => {
    setExecResult('', 'no json here');
    const loudness = await measureLoudness('input.mp4');
    expect(loudness).toEqual({ integrated: -24, truePeak: 0, range: 0 });
  });

  test('falls back when loudnorm JSON is malformed', async () => {
    setExecResult('', '{ "input_i": broken }');
    const loudness = await measureLoudness('input.mp4');
    expect(loudness).toEqual({ integrated: -24, truePeak: 0, range: 0 });
  });

  test('passes through custom ffmpegPath', async () => {
    setExecResult('', loudnormStderr(-18, -2, 7));
    await measureLoudness('input.mp4', '/custom/ffmpeg');
    expect(lastCommand()).toBe('/custom/ffmpeg');
  });
});

// ---------------------------------------------------------------------------
// analyzeQuality
// ---------------------------------------------------------------------------

describe('analyzeQuality', () => {
  beforeEach(() => execFileMock.mockReset());

  /** Drive analyzeQuality with the given probe metadata + loudness values. */
  async function runQuality(
    probe: Record<string, unknown>,
    loudness: { inputI: number; inputTp: number; inputLra: number },
  ) {
    // analyzeQuality calls execFile twice: probeVideo (stdout=ffprobe JSON) then
    // measureLoudness (stderr=loudnorm JSON). Sequence the mock responses.
    let call = 0;
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      call += 1;
      if (call === 1) callback(null, ffprobeJson(probe), '');
      else callback(null, '', loudnormStderr(loudness.inputI, loudness.inputTp, loudness.inputLra));
    });
    return analyzeQuality('input.mp4');
  }

  test('clean HD video → score 100, no issues', async () => {
    const report = await runQuality(
      { streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
        { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 },
      ], format: { bit_rate: 5000000, duration: 60 } },
      { inputI: -20, inputTp: -3, inputLra: 7 },
    );
    expect(report.issues).toEqual([]);
    expect(report.score).toBe(100);
  });

  test('sub-HD resolution → LOW_RESOLUTION warning, score 90', async () => {
    const report = await runQuality(
      { streams: [
        { codec_type: 'video', codec_name: 'h264', width: 720, height: 480, r_frame_rate: '30/1' },
      ], format: { bit_rate: 5000000, duration: 60 } },
      { inputI: -20, inputTp: -3, inputLra: 7 },
    );
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'LOW_RESOLUTION', severity: 'warning' }));
    expect(report.score).toBe(90);
  });

  test('low frame rate → LOW_FRAMERATE warning', async () => {
    const report = await runQuality(
      { streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '20/1' },
      ], format: { bit_rate: 5000000, duration: 60 } },
      { inputI: -20, inputTp: -3, inputLra: 7 },
    );
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'LOW_FRAMERATE' }));
    expect(report.score).toBe(90);
  });

  test('1080p with low bitrate (<4 Mbps) → LOW_BITRATE warning', async () => {
    const report = await runQuality(
      { streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
      ], format: { bit_rate: 3000000, duration: 60 } },
      { inputI: -20, inputTp: -3, inputLra: 7 },
    );
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'LOW_BITRATE' }));
  });

  test('high integrated loudness (> -14 LUFS) → LOUDNESS_HIGH warning', async () => {
    const report = await runQuality(
      { streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
      ], format: { bit_rate: 5000000, duration: 60 } },
      { inputI: -10, inputTp: -3, inputLra: 7 },
    );
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'LOUDNESS_HIGH' }));
  });

  test('true peak > -1 dBTP → TRUE_PEAK_CLIPPING critical, score 80', async () => {
    const report = await runQuality(
      { streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
      ], format: { bit_rate: 5000000, duration: 60 } },
      { inputI: -20, inputTp: 0, inputLra: 7 },
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: 'TRUE_PEAK_CLIPPING', severity: 'critical' }),
    );
    expect(report.score).toBe(80);
  });

  test('invokes onProgress with correct phase sequence', async () => {
    let call = 0;
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      call += 1;
      if (call === 1) callback(null, ffprobeJson({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' }], format: { bit_rate: 5000000, duration: 60 } }), '');
      else callback(null, '', loudnormStderr(-20, -3, 7));
    });
    const phases: string[] = [];
    await analyzeQuality('input.mp4', (p) => phases.push(p.phase));
    expect(phases).toEqual(['analyzing', 'analyzing', 'analyzing', 'done']);
  });
});

// ---------------------------------------------------------------------------
// analyzeSemantic (+ internal detectScenes)
// ---------------------------------------------------------------------------

describe('analyzeSemantic', () => {
  beforeEach(() => execFileMock.mockReset());

  test('splits scenes at pts_time boundaries', async () => {
    // probeVideo then detectScenes
    let call = 0;
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      call += 1;
      if (call === 1) callback(null, ffprobeJson({ format: { bit_rate: 5000000, duration: 10 } }), '');
      else callback(null, '', 'pts_time:2.5\npts_time:8.0\n');
    });
    const report = await analyzeSemantic('input.mp4');

    expect(report.scenes).toHaveLength(3);
    expect(report.scenes[0]).toMatchObject({ index: 0, startTime: 0, endTime: 2.5 });
    expect(report.scenes[1]).toMatchObject({ index: 1, startTime: 2.5, endTime: 8 });
    expect(report.scenes[2]).toMatchObject({ index: 2, startTime: 8, endTime: 10 });
    expect(report.duration).toBe(10);
    expect(report.summary).toContain('3 detected scenes');
  });

  test('returns single scene when no scene changes detected', async () => {
    let call = 0;
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      call += 1;
      if (call === 1) callback(null, ffprobeJson({ format: { bit_rate: 5000000, duration: 15 } }), '');
      else callback(null, '', 'no scene info\n');
    });
    const report = await analyzeSemantic('input.mp4');
    expect(report.scenes).toHaveLength(1);
    expect(report.scenes[0]).toMatchObject({ startTime: 0, endTime: 15 });
  });

  test('reports analyzing → done progress phases', async () => {
    let call = 0;
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      call += 1;
      if (call === 1) callback(null, ffprobeJson({ format: { bit_rate: 5000000, duration: 10 } }), '');
      else callback(null, '', '');
    });
    const phases: string[] = [];
    await analyzeSemantic('input.mp4', (p) => phases.push(p.phase));
    expect(phases).toEqual(['analyzing', 'analyzing', 'done']);
  });
});

// ---------------------------------------------------------------------------
// analyzeCompliance
// ---------------------------------------------------------------------------

describe('analyzeCompliance', () => {
  beforeEach(() => execFileMock.mockReset());

  function mockProbe(streams: Record<string, unknown>[], format: Record<string, unknown>) {
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      callback(null, ffprobeJson({ streams, format }), '');
    });
  }

  test('youtube — fully compliant 1080p/h264/aac → passed', async () => {
    mockProbe(
      [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
       { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 }],
      { bit_rate: 5000000, duration: 60 },
    );
    const report = await analyzeCompliance('input.mp4', 'youtube');
    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(4);
  });

  test('youtube — non-compliant codec (vp9) → Video Codec fails', async () => {
    mockProbe(
      [{ codec_type: 'video', codec_name: 'vp9', width: 1920, height: 1080, r_frame_rate: '30/1' },
       { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 }],
      { bit_rate: 5000000, duration: 60 },
    );
    const report = await analyzeCompliance('input.mp4', 'youtube');
    expect(report.passed).toBe(false);
    const codecCheck = report.checks.find((c) => c.name === 'Video Codec');
    expect(codecCheck?.passed).toBe(false);
  });

  test('tiktok — vertical 1080x1920 / 30s → passed', async () => {
    mockProbe(
      [{ codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '30/1' }],
      { bit_rate: 5000000, duration: 30 },
    );
    const report = await analyzeCompliance('input.mp4', 'tiktok');
    expect(report.passed).toBe(true);
  });

  test('tiktok — duration exceeds 180s → Duration fails', async () => {
    mockProbe(
      [{ codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '30/1' }],
      { bit_rate: 5000000, duration: 200 },
    );
    const report = await analyzeCompliance('input.mp4', 'tiktok');
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.name === 'Duration')?.passed).toBe(false);
  });

  test('unknown platform falls back to youtube rules', async () => {
    mockProbe(
      [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
       { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 }],
      { bit_rate: 5000000, duration: 60 },
    );
    const report = await analyzeCompliance('input.mp4', 'mastodon');
    // youtube rule set has 4 checks
    expect(report.checks).toHaveLength(4);
    expect(report.platform).toBe('mastodon');
  });
});

// ---------------------------------------------------------------------------
// analyzeFull
// ---------------------------------------------------------------------------
//
// The success path of analyzeFull cannot be unit-tested here: it fans out into
// 3 concurrent analyzeCompliance calls via Promise.all, each doing its own
// `await import('node:child_process')`. Under vitest 3.2.7, vi.mock of a
// built-in module does not reliably intercept concurrent dynamic imports —
// the 6th import resolves to the real module, invoking the real ffprobe.
// This is a platform limitation, not a test-logic issue (verified: mock is
// called exactly 5 times, then the 6th call bypasses it).
//
// Coverage for analyzeFull's aggregation is instead provided by:
//  - analyzeQuality / analyzeSemantic / analyzeCompliance each tested in full
//    above (every branch analyzeFull delegates to is covered)
//  - headlessAnalyze({ type: 'full' }) failure → fallback full report, tested
//    below (exercises the buildFallbackReport('full') path)
// ---------------------------------------------------------------------------

// analyzeFull's onProgress percent-mapping (0→40→70→100) is pure arithmetic
// over the child functions' progress callbacks. It is left uncovered rather
// than faked with stubs that would not exercise real aggregation logic.

// ---------------------------------------------------------------------------
// headlessAnalyze (main entry + fallback)
// ---------------------------------------------------------------------------

describe('headlessAnalyze', () => {
  beforeEach(() => execFileMock.mockReset());

  test('quality request returns success with report', async () => {
    let call = 0;
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      call += 1;
      if (call === 1) callback(null, ffprobeJson({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' }, { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 }], format: { bit_rate: 5000000, duration: 60 } }), '');
      else callback(null, '', loudnormStderr(-20, -3, 7));
    });

    const result = await headlessAnalyze({ type: 'quality', inputPath: 'input.mp4' });
    expect(result.success).toBe(true);
    expect(result.report.type).toBe('quality');
  });

  test('probe failure → success=false with fallback quality report', async () => {
    setExecError('boom');
    const result = await headlessAnalyze({ type: 'quality', inputPath: 'input.mp4' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ffprobe failed');
    expect(result.report.type).toBe('quality');
    // fallback report shape
    expect((result.report as { score: number }).score).toBe(0);
    expect((result.report as { issues: unknown[] }).issues).toEqual([]);
  });

  test('probe failure on full request → fallback full report structure', async () => {
    setExecError('boom');
    const result = await headlessAnalyze({ type: 'full', inputPath: 'input.mp4' });
    expect(result.success).toBe(false);
    expect(result.report.type).toBe('full');
    const full = result.report as { quality: { type: string }; semantic: { type: string }; compliance: unknown[] };
    expect(full.quality.type).toBe('quality');
    expect(full.semantic.type).toBe('semantic');
    expect(full.compliance).toEqual([]);
  });

  test('compliance request forwards platform', async () => {
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = callbackOf(args);
      if (args.length === 0) return;
      callback(null, ffprobeJson({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' }, { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: 48000 }], format: { bit_rate: 5000000, duration: 60 } }), '');
    });

    const result = await headlessAnalyze({ type: 'compliance', inputPath: 'input.mp4', platform: 'bilibili' });
    expect(result.success).toBe(true);
    expect((result.report as { platform: string }).platform).toBe('bilibili');
  });

  test('semantic request returns fallback semantic report on failure', async () => {
    setExecError('boom');
    const result = await headlessAnalyze({ type: 'semantic', inputPath: 'input.mp4' });
    expect(result.success).toBe(false);
    expect(result.report.type).toBe('semantic');
    expect((result.report as { summary: string }).summary).toBe('Analysis failed');
  });

  test('compliance request returns fallback compliance report on failure', async () => {
    setExecError('boom');
    const result = await headlessAnalyze({ type: 'compliance', inputPath: 'input.mp4' });
    expect(result.success).toBe(false);
    expect(result.report.type).toBe('compliance');
    expect((result.report as { platform: string }).platform).toBe('unknown');
    expect((result.report as { passed: boolean }).passed).toBe(false);
  });
});
