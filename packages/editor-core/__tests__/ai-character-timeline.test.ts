import { describe, expect, it } from 'vitest';
import {
  calculateIOU,
  calculateJaccardSimilarity,
  clusterCharactersInClip,
  matchCharactersAcrossClips,
  parseCharacterDetectionResponse,
  calculateFrameSampleTimes,
  buildCharacterDetectionPrompt,
  renameCharacter,
  IOU_THRESHOLD,
  JACCARD_THRESHOLD,
  type CharacterBoundingBox,
  type CharacterFrameResult,
  type CharacterTimeline,
  type ClusteredCharacter
} from '../src';

describe('calculateIOU', () => {
  it('returns 1 for identical boxes', () => {
    const box: CharacterBoundingBox = { x: 0, y: 0, w: 10, h: 10 };
    expect(calculateIOU(box, box)).toBeCloseTo(1.0);
  });

  it('returns 0 for non-overlapping boxes', () => {
    const a: CharacterBoundingBox = { x: 0, y: 0, w: 5, h: 5 };
    const b: CharacterBoundingBox = { x: 10, y: 10, w: 5, h: 5 };
    expect(calculateIOU(a, b)).toBe(0);
  });

  it('returns correct IOU for partially overlapping boxes', () => {
    const a: CharacterBoundingBox = { x: 0, y: 0, w: 10, h: 10 };
    const b: CharacterBoundingBox = { x: 5, y: 0, w: 10, h: 10 };
    // Intersection: 5*10=50, Union: 100+100-50=150, IOU=50/150=1/3
    expect(calculateIOU(a, b)).toBeCloseTo(1 / 3);
  });

  it('returns 0 for adjacent boxes (touching edge)', () => {
    const a: CharacterBoundingBox = { x: 0, y: 0, w: 5, h: 5 };
    const b: CharacterBoundingBox = { x: 5, y: 0, w: 5, h: 5 };
    expect(calculateIOU(a, b)).toBe(0);
  });

  it('handles zero-area boxes', () => {
    const a: CharacterBoundingBox = { x: 0, y: 0, w: 0, h: 0 };
    const b: CharacterBoundingBox = { x: 0, y: 0, w: 10, h: 10 };
    expect(calculateIOU(a, b)).toBe(0);
  });

  it('boundary: IOU just above threshold', () => {
    // Create two boxes with IOU just above 0.4
    const a: CharacterBoundingBox = { x: 0, y: 0, w: 10, h: 10 };
    // Overlap area needs to be > 0.4 * union
    // If b starts at x=4, overlap = 6*10=60, union=100+100-60=140, IOU=60/140≈0.428
    const b: CharacterBoundingBox = { x: 4, y: 0, w: 10, h: 10 };
    expect(calculateIOU(a, b)).toBeGreaterThan(IOU_THRESHOLD);
  });

  it('boundary: IOU just below threshold', () => {
    const a: CharacterBoundingBox = { x: 0, y: 0, w: 10, h: 10 };
    // If b starts at x=6, overlap = 4*10=40, union=100+100-40=160, IOU=40/160=0.25
    const b: CharacterBoundingBox = { x: 6, y: 0, w: 10, h: 10 };
    expect(calculateIOU(a, b)).toBeLessThan(IOU_THRESHOLD);
  });
});

describe('calculateJaccardSimilarity', () => {
  it('returns 1 for identical tag sets', () => {
    expect(calculateJaccardSimilarity(['a', 'b'], ['a', 'b'])).toBeCloseTo(1.0);
  });

  it('returns 0 for disjoint tag sets', () => {
    expect(calculateJaccardSimilarity(['a'], ['b'])).toBe(0);
  });

  it('returns 0.5 for half-overlap', () => {
    expect(calculateJaccardSimilarity(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3);
  });

  it('is case-insensitive', () => {
    expect(calculateJaccardSimilarity(['Hello'], ['hello'])).toBeCloseTo(1.0);
  });

  it('handles empty arrays', () => {
    expect(calculateJaccardSimilarity([], [])).toBe(1);
    expect(calculateJaccardSimilarity(['a'], [])).toBe(0);
    expect(calculateJaccardSimilarity([], ['a'])).toBe(0);
  });

  it('boundary: just above JACCARD_THRESHOLD', () => {
    // Need Jaccard > 0.6
    // 3 shared out of 4 total = 3/4 = 0.75
    const a = ['glasses', 'male', 'shirt'];
    const b = ['glasses', 'male', 'hat'];
    // intersection=2, union=4, jaccard=0.5 < 0.6
    expect(calculateJaccardSimilarity(a, b)).toBeLessThan(JACCARD_THRESHOLD);
    // 3 shared out of 3 total = 1.0
    const c = ['glasses', 'male', 'shirt'];
    expect(calculateJaccardSimilarity(a, c)).toBeGreaterThan(JACCARD_THRESHOLD);
  });

  it('boundary: exactly at JACCARD_THRESHOLD is not matched (> not >=)', () => {
    // 2 shared out of 5 total = 0.4 < 0.6
    const a = ['a', 'b', 'c'];
    const b = ['a', 'b', 'd', 'e'];
    // intersection=2, union=5, jaccard=0.4
    expect(calculateJaccardSimilarity(a, b)).toBeLessThan(JACCARD_THRESHOLD);
  });
});

describe('clusterCharactersInClip', () => {
  it('returns empty for no frames', () => {
    expect(clusterCharactersInClip([], 'clip-1')).toEqual([]);
  });

  it('clusters same character across adjacent frames by IOU', () => {
    const frames: CharacterFrameResult[] = [
      { time: 0, characters: [{ descriptorTags: ['glasses', 'male'], box: { x: 0.2, y: 0.2, w: 0.3, h: 0.5 } }] },
      { time: 2, characters: [{ descriptorTags: ['glasses', 'male'], box: { x: 0.21, y: 0.21, w: 0.3, h: 0.5 } }] },
    ];
    const result = clusterCharactersInClip(frames, 'clip-1');
    expect(result.length).toBe(1);
    expect(result[0].appearances.length).toBe(1);
    expect(result[0].appearances[0].startTime).toBe(0);
    expect(result[0].appearances[0].endTime).toBe(2);
  });

  it('creates separate clusters for different characters', () => {
    const frames: CharacterFrameResult[] = [
      {
        time: 0,
        characters: [
          { descriptorTags: ['glasses', 'male'], box: { x: 0.1, y: 0.1, w: 0.2, h: 0.4 } },
          { descriptorTags: ['red_dress', 'female'], box: { x: 0.6, y: 0.1, w: 0.2, h: 0.4 } },
        ],
      },
    ];
    const result = clusterCharactersInClip(frames, 'clip-1');
    expect(result.length).toBe(2);
  });

  it('merges descriptor tags from different frames', () => {
    const frames: CharacterFrameResult[] = [
      { time: 0, characters: [{ descriptorTags: ['glasses'], box: { x: 0.2, y: 0.2, w: 0.3, h: 0.5 } }] },
      { time: 2, characters: [{ descriptorTags: ['male'], box: { x: 0.21, y: 0.21, w: 0.3, h: 0.5 } }] },
    ];
    const result = clusterCharactersInClip(frames, 'clip-1');
    expect(result.length).toBe(1);
    expect(result[0].descriptorTags).toContain('glasses');
    expect(result[0].descriptorTags).toContain('male');
  });
});

describe('matchCharactersAcrossClips', () => {
  it('creates separate characters for dissimilar clips', () => {
    const clipClusters = [
      {
        clipId: 'clip-1',
        characters: [
          { id: 0, descriptorTags: ['glasses', 'male', 'blue_shirt'], appearances: [{ clipId: 'clip-1', startTime: 0, endTime: 4, confidence: 0.8 }] },
        ],
      },
      {
        clipId: 'clip-2',
        characters: [
          { id: 0, descriptorTags: ['red_dress', 'female', 'long_hair'], appearances: [{ clipId: 'clip-2', startTime: 0, endTime: 4, confidence: 0.8 }] },
        ],
      },
    ];
    const result = matchCharactersAcrossClips(clipClusters);
    expect(Object.keys(result.characters).length).toBe(2);
  });

  it('merges same character across clips when Jaccard > threshold', () => {
    const clipClusters = [
      {
        clipId: 'clip-1',
        characters: [
          { id: 0, descriptorTags: ['glasses', 'male', 'blue_shirt'], appearances: [{ clipId: 'clip-1', startTime: 0, endTime: 4, confidence: 0.8 }] },
        ],
      },
      {
        clipId: 'clip-2',
        characters: [
          { id: 0, descriptorTags: ['glasses', 'male', 'blue_shirt'], appearances: [{ clipId: 'clip-2', startTime: 0, endTime: 4, confidence: 0.8 }] },
        ],
      },
    ];
    const result = matchCharactersAcrossClips(clipClusters);
    expect(Object.keys(result.characters).length).toBe(1);
    expect(Object.values(result.characters)[0].appearances.length).toBe(2);
  });

  it('generates character IDs as character_1, character_2, ...', () => {
    const clipClusters = [
      {
        clipId: 'clip-1',
        characters: [
          { id: 0, descriptorTags: ['glasses', 'male'], appearances: [{ clipId: 'clip-1', startTime: 0, endTime: 4, confidence: 0.8 }] },
          { id: 1, descriptorTags: ['red_dress', 'female'], appearances: [{ clipId: 'clip-1', startTime: 0, endTime: 4, confidence: 0.8 }] },
        ],
      },
    ];
    const result = matchCharactersAcrossClips(clipClusters);
    const ids = Object.keys(result.characters).sort();
    expect(ids).toEqual(['character_1', 'character_2']);
  });
});

describe('parseCharacterDetectionResponse', () => {
  it('parses valid response', () => {
    const json = JSON.stringify({
      frames: [
        { time: 0, characters: [{ descriptorTags: ['glasses'], box: { x: 0.2, y: 0.2, w: 0.3, h: 0.5 } }] },
      ],
    });
    const result = parseCharacterDetectionResponse(json);
    expect(result).not.toBeNull();
    expect(result!.frames.length).toBe(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parseCharacterDetectionResponse('not json')).toBeNull();
  });

  it('returns null for missing frames array', () => {
    expect(parseCharacterDetectionResponse('{"foo":"bar"}')).toBeNull();
  });

  it('returns null for invalid frame structure', () => {
    const json = JSON.stringify({ frames: [{ time: 'bad', characters: [] }] });
    expect(parseCharacterDetectionResponse(json)).toBeNull();
  });
});

describe('calculateFrameSampleTimes', () => {
  it('returns [0] for zero duration', () => {
    expect(calculateFrameSampleTimes(0)).toEqual([0]);
  });

  it('includes middle frame and endpoints', () => {
    const times = calculateFrameSampleTimes(10);
    expect(times).toContain(5); // middle
    expect(times).toContain(0); // start
    expect(times[times.length - 1]).toBeCloseTo(9.9, 0);
  });
});

describe('buildCharacterDetectionPrompt', () => {
  it('includes sample times in prompt', () => {
    const prompt = buildCharacterDetectionPrompt([0, 2, 4]);
    expect(prompt).toContain('0.0s');
    expect(prompt).toContain('2.0s');
    expect(prompt).toContain('4.0s');
  });
});

describe('renameCharacter', () => {
  it('renames an existing character', () => {
    const timeline: CharacterTimeline = {
      characters: {
        character_1: { label: 'glasses, male', appearances: [] },
      },
      lastAnalyzedAt: '',
    };
    const result = renameCharacter(timeline, 'character_1', '张三');
    expect(result.characters.character_1.label).toBe('张三');
  });

  it('returns unchanged timeline for non-existent character', () => {
    const timeline: CharacterTimeline = {
      characters: { character_1: { label: 'x', appearances: [] } },
      lastAnalyzedAt: '',
    };
    const result = renameCharacter(timeline, 'character_999', 'new');
    expect(result).toBe(timeline);
  });

  it('does not mutate the original timeline', () => {
    const timeline: CharacterTimeline = {
      characters: { character_1: { label: 'old', appearances: [] } },
      lastAnalyzedAt: '',
    };
    renameCharacter(timeline, 'character_1', 'new');
    expect(timeline.characters.character_1.label).toBe('old');
  });
});
