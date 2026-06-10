import { describe, expect, it } from 'vitest';
import { buildProxyPlan, fitWithin, shouldGenerateProxy } from '../src';
import { makeProject } from './test-utils';

describe('proxy planner', () => {
  it('plans proxy files for large video media', () => {
    const asset = { ...makeProject().media[0], size: 500 * 1024 * 1024, width: 3840, height: 2160 };
    expect(shouldGenerateProxy(asset)).toBe(true);

    const plan = buildProxyPlan(asset, 'C:/Cache/open-factory');
    expect(plan?.outputPath).toMatch(/^C:\/Cache\/open-factory\/proxies\/[a-f0-9]{16}\.mp4$/);
    expect(plan?.width).toBe(960);
    expect(plan?.height).toBe(540);
    expect(plan?.reason).toBe('large-file');
  });

  it('does not proxy non-video or already ready proxy media', () => {
    const asset = { ...makeProject().media[0], proxyPath: 'C:/proxy.mp4', proxyStatus: 'ready' as const };
    expect(shouldGenerateProxy(asset)).toBe(false);
    expect(shouldGenerateProxy({ ...asset, type: 'audio' })).toBe(false);
    expect(buildProxyPlan(asset, 'C:/Cache/open-factory')).toBeNull();
  });

  it('fits dimensions to even values', () => {
    expect(fitWithin(1921, 1081, 960, 540)).toEqual({ width: 960, height: 540 });
    expect(fitWithin(0, 0, 960, 540)).toEqual({ width: 960, height: 540 });
  });

  it('does not build a cache plan when metadata needed for the key is missing', () => {
    const asset = { ...makeProject().media[0], size: undefined, mtimeMs: 1000, width: 3840, height: 2160 };

    expect(shouldGenerateProxy(asset)).toBe(true);
    expect(buildProxyPlan(asset, 'C:/Cache/open-factory')).toBeNull();
    expect(buildProxyPlan({ ...asset, size: 500 * 1024 * 1024, mtimeMs: undefined }, 'C:/Cache/open-factory')).toBeNull();
  });

  it('plans resolution-only proxy cache paths with normalized cache directories', () => {
    const asset = { ...makeProject().media[0], size: 10 * 1024 * 1024, width: 2560, height: 1440, mtimeMs: 1234 };

    const plan = buildProxyPlan(asset, 'C:\\Cache\\open-factory\\');

    expect(plan?.outputPath).toMatch(/^C:\/Cache\/open-factory\/proxies\/[a-f0-9]{16}\.mp4$/);
    expect(plan?.reason).toBe('large-resolution');
    expect(plan?.width).toBe(960);
    expect(plan?.height).toBe(540);
  });
});
