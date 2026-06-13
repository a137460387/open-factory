import { describe, expect, it } from 'vitest';
import { buildProxyPlan, fitWithin, isEditingCodec, shouldGenerateProxy } from '../src';
import { makeProject } from './test-utils';

describe('proxy planner', () => {
  it('plans 720p proxy files for video media above the 1080p threshold', () => {
    const asset = { ...makeProject().media[0], size: 500 * 1024 * 1024, width: 3840, height: 2160 };
    expect(shouldGenerateProxy(asset)).toBe(true);

    const plan = buildProxyPlan(asset, 'C:/Users/E2E/AppData/Roaming/open-factory');
    expect(plan?.outputPath).toMatch(/^C:\/Users\/E2E\/AppData\/Roaming\/open-factory\/proxies\/[a-f0-9]{16}\.mp4$/);
    expect(plan?.width).toBe(1280);
    expect(plan?.height).toBe(720);
    expect(plan?.reason).toBe('large-resolution');
  });

  it('does not proxy non-video or already ready proxy media', () => {
    const asset = { ...makeProject().media[0], proxyPath: 'C:/proxy.mp4', proxyStatus: 'ready' as const };
    expect(shouldGenerateProxy(asset)).toBe(false);
    expect(shouldGenerateProxy({ ...asset, type: 'audio' })).toBe(false);
    expect(buildProxyPlan(asset, 'C:/Cache/open-factory')).toBeNull();
  });

  it('fits dimensions to even values', () => {
    expect(fitWithin(3840, 2160, 1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(0, 0, 1280, 720)).toEqual({ width: 1280, height: 720 });
  });

  it('does not build a cache plan when metadata needed for the key is missing', () => {
    const asset = { ...makeProject().media[0], size: undefined, mtimeMs: 1000, width: 3840, height: 2160 };

    expect(shouldGenerateProxy(asset)).toBe(true);
    expect(buildProxyPlan(asset, 'C:/Cache/open-factory')).toBeNull();
    expect(buildProxyPlan({ ...asset, size: 500 * 1024 * 1024, mtimeMs: undefined }, 'C:/Cache/open-factory')).toBeNull();
  });

  it('does not proxy ordinary 1080p or 720p H264 media by default', () => {
    const hd = { ...makeProject().media[0], size: 500 * 1024 * 1024, width: 1920, height: 1080, mtimeMs: 1234, videoCodec: 'h264' };
    const small = { ...hd, width: 1280, height: 720 };

    expect(shouldGenerateProxy(hd)).toBe(false);
    expect(shouldGenerateProxy(small)).toBe(false);
  });

  it('can force a manual proxy for ordinary H264 media', () => {
    const asset = { ...makeProject().media[0], size: 40 * 1024 * 1024, width: 1280, height: 720, mtimeMs: 1234, videoCodec: 'h264' };

    expect(buildProxyPlan(asset, 'C:/Cache/open-factory')).toBeNull();

    const plan = buildProxyPlan(asset, 'C:/Cache/open-factory', undefined, { force: true });

    expect(plan?.reason).toBe('manual');
    expect(plan?.width).toBe(1280);
    expect(plan?.height).toBe(720);
  });

  it('builds CFR proxy plans for VFR media with a distinct cache key', () => {
    const asset = {
      ...makeProject().media[0],
      size: 40 * 1024 * 1024,
      width: 1280,
      height: 720,
      mtimeMs: 1234,
      videoCodec: 'h264',
      variableFrameRate: true,
      avgFrameRate: '24000/1001',
      realFrameRate: '30/1'
    };

    const plan = buildProxyPlan(asset, 'C:/Cache/open-factory', undefined, { force: true });

    expect(plan?.reason).toBe('vfr-cfr');
    expect(plan?.cfrFrameRate).toBe(23.976);
    expect(plan?.outputPath).toMatch(/proxies\/[a-f0-9]{16}\.mp4$/);
  });

  it('proxies HEVC and ProRes media even below the resolution threshold', () => {
    const hevc = { ...makeProject().media[0], size: 10 * 1024 * 1024, width: 1280, height: 720, mtimeMs: 1234, videoCodec: 'hevc' };
    const prores = { ...hevc, videoCodec: 'prores_ks' };

    expect(isEditingCodec('H.265')).toBe(true);
    expect(shouldGenerateProxy(hevc)).toBe(true);
    expect(buildProxyPlan(hevc, 'C:/Users/E2E/AppData/Roaming/open-factory')?.reason).toBe('editing-codec');
    expect(shouldGenerateProxy(prores)).toBe(true);
  });

  it('plans resolution-only proxy paths with normalized app data directories', () => {
    const asset = { ...makeProject().media[0], size: 10 * 1024 * 1024, width: 2560, height: 1440, mtimeMs: 1234 };

    const plan = buildProxyPlan(asset, 'C:\\Users\\E2E\\AppData\\Roaming\\open-factory\\');

    expect(plan?.outputPath).toMatch(/^C:\/Users\/E2E\/AppData\/Roaming\/open-factory\/proxies\/[a-f0-9]{16}\.mp4$/);
    expect(plan?.reason).toBe('large-resolution');
    expect(plan?.width).toBe(1280);
    expect(plan?.height).toBe(720);
  });
});
