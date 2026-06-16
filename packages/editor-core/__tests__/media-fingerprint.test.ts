import { describe, expect, it } from 'vitest';
import {
  calculateFingerprintDistance,
  calculatePerceptualHash,
  collectFingerprintReferences,
  createAudioRmsFingerprint,
  createVideoFingerprint,
  detectCrossProjectFingerprintMatches,
  findProjectFingerprintSourcePaths,
  listFingerprintSourcePaths,
  areMediaFingerprintsEquivalent
} from '../src';
import { makeProject } from './test-utils';

describe('media fingerprints', () => {
  it('keeps perceptual hash distance small for similar image samples', () => {
    const base = Array.from({ length: 64 }, (_, index) => (index % 8) * 24 + Math.floor(index / 8) * 3);
    const similar = base.map((value, index) => value + (index % 5 === 0 ? 2 : 0));

    const baseHash = calculatePerceptualHash({ width: 8, height: 8, data: base });
    const similarHash = calculatePerceptualHash({ width: 8, height: 8, data: similar });

    expect(calculateFingerprintDistance(createVideoFingerprint([baseHash]), createVideoFingerprint([similarHash]))).toBeLessThanOrEqual(2);
    expect(calculateFingerprintDistance(createVideoFingerprint(['f']), createVideoFingerprint(['0']))).toBe(4);
  });

  it('detects cross-project fingerprint matches', () => {
    const current = [{ assetId: 'asset-a', name: 'a.mp4', path: 'C:/Media/a.mp4', fingerprint: createVideoFingerprint(['ffff0000ffff0000']) }];
    const shared = [{ assetId: 'shared-a', name: 'mirror.mp4', path: 'D:/Shared/mirror.mp4', fingerprint: createVideoFingerprint(['ffff0000ffff0000']), source: 'shared-library' as const }];

    expect(detectCrossProjectFingerprintMatches(current, shared)).toEqual([
      {
        assetId: 'asset-a',
        path: 'C:/Media/a.mp4',
        matches: shared
      }
    ]);
  });

  it('handles invalid samples mismatched kinds and empty targets defensively', () => {
    expect(calculatePerceptualHash({ width: 0, height: 0, data: [] })).toBe('0000000000000000');
    expect(calculateFingerprintDistance(undefined, createVideoFingerprint(['ffff']))).toBe(Number.POSITIVE_INFINITY);
    expect(calculateFingerprintDistance(createVideoFingerprint(['ffff']), createAudioRmsFingerprint([0.1, 0.2]))).toBe(Number.POSITIVE_INFINITY);
    expect(areMediaFingerprintsEquivalent(undefined, createVideoFingerprint(['ffff']))).toBe(false);
    expect(listFingerprintSourcePaths(undefined, [{ assetId: 'a', name: 'a.mp4', path: 'C:/a.mp4' }])).toEqual([]);
  });

  it('compares audio rms fingerprints and hash fallbacks', () => {
    const audio = createAudioRmsFingerprint([0.2, 0.4, 0.6]);
    const audioSimilar = createAudioRmsFingerprint([0.21, 0.41, 0.61]);
    const audioDifferent = createAudioRmsFingerprint([0.6, 0.1, 0.1]);

    expect(calculateFingerprintDistance(audio, audioSimilar)).toBeLessThanOrEqual(0.02);
    expect(areMediaFingerprintsEquivalent(audio, audioSimilar)).toBe(true);
    expect(areMediaFingerprintsEquivalent(audio, audioDifferent)).toBe(false);
    expect(calculateFingerprintDistance({ version: 1, kind: 'audio', hash: 'abc', algorithm: 'rms' }, { version: 1, kind: 'audio', hash: 'abc', algorithm: 'rms' })).toBe(0);
  });

  it('lists all local source paths with the same fingerprint', () => {
    const project = makeProject();
    project.media.push({ ...project.media[0], id: 'asset-2', name: 'copy.mp4', path: 'D:/Copies/copy.mp4' });
    project.mediaMetadata = {
      'asset-1': { fingerprint: createAudioRmsFingerprint([0.2, 0.4, 0.6]) },
      'asset-2': { fingerprint: createAudioRmsFingerprint([0.2, 0.4, 0.6]) }
    };

    expect(findProjectFingerprintSourcePaths(project, 'asset-1')).toEqual(['C:\\Videos\\sample.mp4', 'D:/Copies/copy.mp4']);
    expect(collectFingerprintReferences(project.media, project.mediaMetadata)).toHaveLength(2);
  });
});
