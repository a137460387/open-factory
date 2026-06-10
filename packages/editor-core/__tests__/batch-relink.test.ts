import { describe, expect, it } from 'vitest';
import { planBatchRelinkByFileName, type MediaAsset } from '../src';

const baseAsset: MediaAsset = {
  id: 'asset-video',
  type: 'video',
  name: 'clip-one.mp4',
  path: 'C:/Missing/clip-one.mp4',
  duration: 1,
  width: 1280,
  height: 720,
  missing: true
};

describe('batch relink filename planner', () => {
  it('matches missing media by exact filename', () => {
    const result = planBatchRelinkByFileName([baseAsset], [{ path: 'C:/Relink/clip-one.mp4' }]);

    expect(result.replacements).toEqual([{ assetId: 'asset-video', candidatePath: 'C:/Relink/clip-one.mp4' }]);
    expect(result.warnings).toEqual([]);
  });

  it('skips duplicate candidate filenames and reports a warning', () => {
    const result = planBatchRelinkByFileName(
      [baseAsset],
      [{ path: 'C:/A/clip-one.mp4' }, { path: 'C:/B/clip-one.mp4' }]
    );

    expect(result.replacements).toEqual([]);
    expect(result.warnings[0]).toMatchObject({ assetId: 'asset-video', reason: 'duplicate-candidates', fileName: 'clip-one.mp4' });
  });

  it('reports no-match warnings without replacing media', () => {
    const result = planBatchRelinkByFileName([baseAsset], [{ path: 'C:/Relink/other.mp4' }]);

    expect(result.replacements).toEqual([]);
    expect(result.warnings[0]).toMatchObject({ assetId: 'asset-video', reason: 'no-match', fileName: 'clip-one.mp4' });
  });

  it('supports Windows-style case-insensitive matching', () => {
    const result = planBatchRelinkByFileName([baseAsset], [{ path: 'C:/Relink/CLIP-ONE.MP4' }], { caseInsensitive: true });

    expect(result.replacements).toEqual([{ assetId: 'asset-video', candidatePath: 'C:/Relink/CLIP-ONE.MP4' }]);
  });
});
