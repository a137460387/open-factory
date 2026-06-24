import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BROADCAST_SPECS,
  checkCompliance,
  buildComplianceFix,
  calculateDurationOverflowSec,
  getBuiltinSpec,
  getBuiltinSpecIds,
  type ExportComplianceParams,
} from '../src/broadcast-compliance';

describe('BUILTIN_BROADCAST_SPECS', () => {
  it('contains at least 6 specs', () => {
    expect(BUILTIN_BROADCAST_SPECS.length).toBeGreaterThanOrEqual(6);
  });

  it('getBuiltinSpecIds returns all IDs', () => {
    const ids = getBuiltinSpecIds();
    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(ids).toContain('netflix-1080p');
    expect(ids).toContain('youtube-1080p');
    expect(ids).toContain('ebu-r103');
    expect(ids).toContain('douyin-bilibili');
    expect(ids).toContain('youtube-shorts');
    expect(ids).toContain('itunes-apple-tv');
  });

  it('getBuiltinSpec returns spec by id', () => {
    expect(getBuiltinSpec('youtube-1080p')?.name).toBe('YouTube 1080p');
    expect(getBuiltinSpec('nonexistent')).toBeUndefined();
  });
});

describe('checkCompliance - Netflix 关键检查', () => {
  it('passes for h264 high profile', () => {
    const spec = getBuiltinSpec('netflix-1080p')!;
    const results = checkCompliance(spec, { videoCodec: 'h264', videoProfile: 'high', videoBitrateMbps: 15, width: 1920, height: 1080, fps: 24, loudnessLufs: -27, truePeakDbtp: -3 });
    const codecResult = results.find((r) => r.name === '视频编码')!;
    expect(codecResult.level).toBe('pass');
  });

  it('fails for wrong codec', () => {
    const spec = getBuiltinSpec('netflix-1080p')!;
    const results = checkCompliance(spec, { videoCodec: 'vp9' });
    const codecResult = results.find((r) => r.name === '视频编码')!;
    expect(codecResult.level).toBe('fail');
  });
});

describe('checkCompliance - YouTube 关键检查', () => {
  it('passes for AAC audio >= 128kbps', () => {
    const spec = getBuiltinSpec('youtube-1080p')!;
    const results = checkCompliance(spec, { audioCodec: 'aac', audioBitrateKbps: 256 });
    const audioResult = results.find((r) => r.name === '音频码率')!;
    expect(audioResult.level).toBe('pass');
  });
});

describe('checkCompliance - EBU R103 关键检查', () => {
  it('passes for 25fps PAL', () => {
    const spec = getBuiltinSpec('ebu-r103')!;
    const results = checkCompliance(spec, { fps: 25, loudnessLufs: -23, truePeakDbtp: -2 });
    const fpsResult = results.find((r) => r.name === '帧率')!;
    expect(fpsResult.level).toBe('pass');
  });
});

describe('checkCompliance - 抖音/B站 关键检查', () => {
  it('fails loudness at -20 LUFS', () => {
    const spec = getBuiltinSpec('douyin-bilibili')!;
    const results = checkCompliance(spec, { loudnessLufs: -20 });
    const lufsResult = results.find((r) => r.name === '响度')!;
    expect(lufsResult.level).not.toBe('pass');
  });
});

describe('checkCompliance - YouTube Shorts 关键检查', () => {
  it('passes for 1080x1920 (9:16)', () => {
    const spec = getBuiltinSpec('youtube-shorts')!;
    const results = checkCompliance(spec, { width: 1080, height: 1920 });
    const ratioResult = results.find((r) => r.name === '宽高比')!;
    expect(ratioResult.level).toBe('pass');
  });
});

describe('checkCompliance - iTunes/Apple TV 关键检查', () => {
  it('passes for ProRes video', () => {
    const spec = getBuiltinSpec('itunes-apple-tv')!;
    const results = checkCompliance(spec, { videoCodec: 'prores', audioCodec: 'aac', audioChannels: 2, loudnessLufs: -16 });
    const codecResult = results.find((r) => r.name === '视频编码')!;
    expect(codecResult.level).toBe('pass');
  });
});

describe('三级判定逻辑', () => {
  it('loudness within tolerance = pass', () => {
    const spec = getBuiltinSpec('youtube-1080p')!;
    const results = checkCompliance(spec, { loudnessLufs: -14 });
    const r = results.find((r) => r.name === '响度')!;
    expect(r.level).toBe('pass');
  });

  it('loudness slightly off = warn', () => {
    const spec = getBuiltinSpec('youtube-1080p')!;
    const results = checkCompliance(spec, { loudnessLufs: -15.5 });
    const r = results.find((r) => r.name === '响度')!;
    expect(r.level).toBe('warn');
  });

  it('loudness way off = fail', () => {
    const spec = getBuiltinSpec('youtube-1080p')!;
    const results = checkCompliance(spec, { loudnessLufs: -20 });
    const r = results.find((r) => r.name === '响度')!;
    expect(r.level).toBe('fail');
  });
});

describe('buildComplianceFix', () => {
  it('loudness fix sets loudnorm enabled with target', () => {
    const spec = getBuiltinSpec('youtube-1080p')!;
    const results = checkCompliance(spec, { loudnessLufs: -20 });
    const fix = buildComplianceFix(spec, results);
    expect(fix.loudnorm).toBeDefined();
    expect(fix.loudnorm!.enabled).toBe(true);
    expect(fix.loudnorm!.targetLufs).toBe(-14);
  });
});

describe('calculateDurationOverflowSec', () => {
  it('returns 0 when within limit', () => {
    expect(calculateDurationOverflowSec(600, 900)).toBe(0);
  });

  it('returns overflow when exceeded', () => {
    expect(calculateDurationOverflowSec(950, 900)).toBe(50);
  });

  it('returns 0 for zero limit', () => {
    expect(calculateDurationOverflowSec(100, 0)).toBe(0);
  });
});
