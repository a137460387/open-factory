import { describe, expect, it } from 'vitest';
import {
  applyArchiveRelinkPlan,
  calculateMultiFramePhashSimilarity,
  calculatePhashSimilarity,
  detectMediaCleanupCandidates,
  detectSmartDuplicateGroups,
  expandRenameTemplate,
  type MediaAsset
} from '../src';
import { makeProject, makeVideoClip } from './test-utils';

describe('media organizer', () => {
  it('calculates pHash similarity for identical and different frames', () => {
    expect(calculatePhashSimilarity('ffff0000ffff0000', 'ffff0000ffff0000')).toBe(1);
    expect(calculatePhashSimilarity('ffff0000ffff0000', '0000ffff0000ffff')).toBeLessThan(0.5);
    expect(calculatePhashSimilarity('', '')).toBe(0);
    expect(calculateMultiFramePhashSimilarity([], ['ffff0000ffff0000'])).toBe(0);
  });

  it('groups duplicate media by size, duration, and three-frame pHash while keeping the highest resolution', () => {
    const groups = detectSmartDuplicateGroups([
      duplicateCandidate(asset('low', 'C:/Media/low.mp4', 1280, 720), 1000),
      duplicateCandidate(asset('high', 'C:/Media/high.mp4', 3840, 2160), 1000),
      duplicateCandidate(asset('copy', 'D:/Mirror/copy.mp4', 1920, 1080), 1000),
      duplicateCandidate(asset('other', 'C:/Media/other.mp4', 1920, 1080), 1000, ['0000000000000000', '0000000000000000', '0000000000000000'])
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].keepAssetId).toBe('high');
    expect(groups[0].assets.map((item) => item.assetId)).toEqual(['high', 'copy', 'low']);
  });

  it('skips invalid duplicate candidates and ignores copies that resolve to one path', () => {
    expect(
      detectSmartDuplicateGroups([
        duplicateCandidate(asset('bad-size', 'C:/Media/bad-size.mp4', 1920, 1080), 0),
        { ...duplicateCandidate(asset('bad-duration', 'C:/Media/bad-duration.mp4', 1920, 1080), 1000), duration: Number.NaN },
        { ...duplicateCandidate(asset('missing-hash', 'C:/Media/missing-hash.mp4', 1920, 1080), 1000), frameHashes: [] }
      ])
    ).toEqual([]);

    expect(
      detectSmartDuplicateGroups([
        duplicateCandidate(asset('first', 'C:/Media/Same.mp4', 1920, 1080), 1000),
        duplicateCandidate(asset('second', 'c:/media/same.mp4', 1280, 720), 1000)
      ])
    ).toEqual([]);
  });

  it('expands smart rename template tokens', () => {
    expect(expandRenameTemplate('{date}/{resolution}/{codec}/{index}', { date: '2026-06-17T12:00:00.000Z', width: 1920, height: 1080, codec: 'h264', index: 7 })).toBe('2026-06-17/1920x1080/h264/007');
    expect(expandRenameTemplate('{date}-{resolution}', { date: 'invalid', width: 3840, height: 2160 })).toBe('unknown-date-3840x2160');
    expect(expandRenameTemplate('{date}/{resolution}/{codec}/{index}/{name}', { codec: 'pro res:422', index: 0, name: 'raw <clip>' })).toBe('unknown-date/unknown-resolution/pro-res_422/001/raw-_clip_');
  });

  it('detects orphaned media when the source file no longer exists', () => {
    const project = makeProject();
    project.media.push(asset('missing', 'C:/Missing/offline.mp4', 1920, 1080));

    const report = detectMediaCleanupCandidates(project, {
      [project.media[0].path]: true,
      'C:/Missing/offline.mp4': false
    });

    expect(report.orphaned.map((item) => item.id)).toEqual(['missing']);
  });

  it('detects unused media not referenced by any timeline clip', () => {
    const project = makeProject();
    project.media.push(asset('unused', 'C:/Media/unused.mp4', 1920, 1080));

    const report = detectMediaCleanupCandidates(project, {
      [project.media[0].path]: true,
      'C:/Media/unused.mp4': true
    });

    expect(report.unused.map((item) => item.id)).toEqual(['unused']);
  });

  it('updates library paths after archiving unused media so relink points at the archive location', () => {
    const project = makeProject();
    project.media.push(asset('unused', 'C:/Media/unused.mp4', 1920, 1080));
    project.timeline.tracks = [project.timeline.tracks[0] ?? { id: 'track-video', name: 'Video', type: 'video', clips: [], muted: false, locked: false }];
    project.timeline.tracks[0].clips = [makeVideoClip({ mediaId: 'asset-1' })];

    const next = applyArchiveRelinkPlan(project, [{ assetId: 'unused', newPath: 'D:/Archive/unused.mp4' }]);

    expect(next.media.find((item) => item.id === 'unused')?.path).toBe('D:/Archive/unused.mp4');
    expect(next.timeline.tracks[0].clips[0]).toMatchObject({ mediaId: 'asset-1' });
  });

  it('leaves the project unchanged when archive relink entries are empty or invalid', () => {
    const project = makeProject();

    expect(applyArchiveRelinkPlan(project, [])).toBe(project);
    expect(applyArchiveRelinkPlan(project, [{ assetId: '', newPath: '   ' }])).toBe(project);
  });
});

function asset(id: string, path: string, width: number, height: number): MediaAsset {
  return {
    id,
    type: 'video',
    name: path.split('/').pop() ?? `${id}.mp4`,
    path,
    duration: 12,
    width,
    height,
    videoCodec: 'h264'
  };
}

function duplicateCandidate(media: MediaAsset, size: number, frameHashes = ['ffff0000ffff0000', '0000ffff0000ffff', 'f0f0f0f00f0f0f0f']) {
  return {
    asset: media,
    size,
    duration: media.duration,
    frameHashes,
    createdAt: '2026-06-17T12:00:00.000Z'
  };
}
