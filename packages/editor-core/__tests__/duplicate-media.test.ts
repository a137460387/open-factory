import { describe, expect, it } from 'vitest';
import { detectDuplicateMediaGroups } from '../src';

describe('duplicate media detection', () => {
  it('groups different paths with the same size and first-chunk hash', () => {
    const groups = detectDuplicateMediaGroups([
      signature('asset-b', 'D:/Mirror/clip.mp4', 4096, 'hash-a'),
      signature('asset-a', 'C:/Media/clip.mp4', 4096, 'hash-a'),
      signature('asset-c', 'C:/Media/other.mp4', 4096, 'hash-b')
    ]);

    expect(groups).toEqual([
      {
        id: 'duplicate-media-0',
        size: 4096,
        headHash: 'hash-a',
        keepAssetId: 'asset-a',
        assets: [
          { assetId: 'asset-a', name: 'clip.mp4', path: 'C:/Media/clip.mp4' },
          { assetId: 'asset-b', name: 'clip.mp4', path: 'D:/Mirror/clip.mp4' }
        ]
      }
    ]);
  });

  it('does not mark same-size media as duplicates when first-chunk hashes differ', () => {
    expect(
      detectDuplicateMediaGroups([
        signature('asset-a', 'C:/Media/a.mp4', 4096, 'hash-a'),
        signature('asset-b', 'D:/Media/b.mp4', 4096, 'hash-b')
      ])
    ).toEqual([]);
  });

  it('ignores repeated entries for the same normalized path', () => {
    expect(
      detectDuplicateMediaGroups([
        signature('asset-a', 'C:/Media/a.mp4', 4096, 'hash-a'),
        signature('asset-b', 'c:/media/a.mp4', 4096, 'hash-a')
      ])
    ).toEqual([]);
  });
});

function signature(assetId: string, path: string, size: number, headHash: string) {
  return {
    assetId,
    name: path.split('/').pop() ?? assetId,
    path,
    size,
    headHash
  };
}
